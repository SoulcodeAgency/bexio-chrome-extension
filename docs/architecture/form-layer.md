# Architecture: Form-Manipulation Layer

## Why this layer exists

Bexio's time-tracking edit form (`/index.php/monitoring/edit`) is built on
jQuery, select2 (dropdowns with AJAX-backed option lists), and jQuery-UI
(autocomplete for the contact field, datepicker for the date, timepicker for
the duration). You cannot interact with these widgets by simply setting
`input.value` — the widgets maintain their own internal state and only respond
to synthetic DOM events in a specific sequence. This layer encapsulates that
synthetic-event recipe so the rest of the extension can call one function per
field.

---

## Field map

| Bexio label | DOM id / selector | Widget type | Template field |
|---|---|---|---|
| Tätigkeit | `#monitoring_client_service_id` / `#s2id_monitoring_client_service_id` | select2 | `work` (always filled with the literal string `"work"`) |
| Status | `#monitoring_monitoring_status_id` / `#s2id_monitoring_monitoring_status_id` | select2 | `status` |
| Kontakt | `#monitoring_contact_id` (hidden) + `#autocomplete_monitoring_contact_id` (text) | jQuery-UI autocomplete | `contact` |
| Kontaktperson | `#monitoring_sub_contact_id` / `#s2id_monitoring_sub_contact_id` | select2 | `contactPerson` |
| Projekt | `#monitoring_pr_project_id` / `#s2id_monitoring_pr_project_id` | select2 (AJAX options) | `project` |
| Arbeitspaket | `#monitoring_pr_package_id` / `#s2id_monitoring_pr_package_id` | select2 (AJAX options) | `package` |
| abrechenbar | `#monitoring_allowable_bill` | checkbox | `billable` |
| Datum | `#monitoring_date` | jQuery-UI datepicker | `date` |
| Dauer | `#monitoring_duration` | jQuery-UI timepicker | `duration` |
| Bemerkungen | `#monitoring_text` + iframe `#monitoring_text_ifr` → `body#tinymce` | TinyMCE | — |

The select2 containers follow the naming pattern `#s2id_monitoring_<field_id>`,
and each contains a focusser `<input class="select2-focusser">` plus a hidden
search-box `<input class="select2-input">` inside `.select2-drop`.

---

## Synthetic-event recipe per field type

### select2 fields (`triggerField`)

1. Call `waitForSelectOptions(selectorId)` — polls every 1000 ms until the
   sibling `<select>` has more than one option (the AJAX load has completed).
   **No timeout — polls indefinitely.** (See Known Issues.)
2. Set the focusser input's `.value` to the target string.
3. Dispatch the shared `pressEnter` `KeyboardEvent` (`keyCode: 13`, **not**
   `key: "Enter"`) on the focusser — triggers select2 to open the drop and run
   a search.
4. Call `waitForSearchBoxField()` — polls every 1000 ms until
   `#select2-drop input` appears. **No timeout.**
5. Set the drop input's `.value` to the target string.
6. Dispatch `pressEnter` on the drop input — selects the first result.
7. Call `waitForSearchBoxFieldToBeRemoved()` — polls every 1000 ms until
   `#select2-drop input` disappears (drop closes). **No timeout.**

Early-return: if `value === null || value.trim() === ""` the function returns
immediately (the field is left unchanged).

### contact autocomplete field (`triggerContactField`)

1. Set `contactField.value` to the target string.
2. Call `.click()` three times (jQuery-UI autocomplete trigger idiom).
3. Call `waitForContacts()` — polls every 1000 ms until `.ac_results` is
   visible. **No timeout.**
4. Dispatch `pressEnter` on `contactField` — accepts the first suggestion.
5. `await delay(1000)` — hard-coded wait for the UI to settle.
   **Known issue:** this is a fixed delay, not a condition check.

### checkbox (`triggerCheckbox`)

Sets `selector.checked = checked`. **Does NOT dispatch a `change` event.**
(See Known Issues.)

### date field (`triggerDate`)

Sets the datepicker input's `.value` and dispatches `change` and `input`
events. Read `triggerDate.ts` for the exact event sequence.

### duration field (`triggerDuration`)

Sets the timepicker input's `.value` and dispatches `change` and `input`
events. Read `triggerDuration.ts` for the exact event sequence.

### pressEnter

`pressEnter` is a module-level `KeyboardEvent` **instance** (not a function),
created once at import time with `{ bubbles: true, cancelable: true, keyCode: 13 }`.
Note: the `key` property is `""` (not `"Enter"`) because the constructor init
dict only specifies `keyCode`. The same object is reused for every dispatch.

---

## Why the `waitFor*` polling exists

Select2 loads its option lists via AJAX after the page renders. The
`waitForSelectOptions` helper polls until the backing `<select>` has options.
Similarly, opening the select2 drop is asynchronous from jsdom's perspective —
`waitForSearchBoxField` and `waitForSearchBoxFieldToBeRemoved` wait for the
drop to appear / disappear. The jQuery-UI autocomplete results likewise appear
asynchronously, hence `waitForContacts`.

**None of the `waitFor*` helpers have a timeout.** They poll on
`setTimeout` with a default interval of 1000 ms and will loop forever if the
condition never becomes true. This is a known issue.

---

## `fillForm` orchestration

Source: `packages/chrome-extension/src/utils/fillForm.ts`

```
fillForm(id, timeEntryBillable?)
  ├── toggleDisplayLoader()                         // show loader (on)
  ├── try {
  │     ├── load templates from chrome.storage.local
  │     ├── find entry by id
  │     └── if (entry) {                            // no match → skip the whole block
  │           ├── destructure:
  │           │     contact, contactPerson = null, project = null,
  │           │     status = null, billable = true, package (as packageValue ?? null)
  │           ├── triggerField(workFieldID, "work") // always the literal "work"
  │           ├── triggerField(statusFieldID, status)
  │           ├── triggerContactField(contactField, contact)
  │           ├── triggerField(contactPersonID, contactPerson)
  │           ├── triggerField(projectFieldID, project)
  │           ├── triggerField(packageFieldID, packageValue)
  │           ├── triggerCheckbox(billableCheckbox, timeEntryBillable ?? billable)
  │           │     // timeEntryBillable (from the sidePanel import) overrides the
  │           │     // template's billable flag; billable defaults to true when absent
  │           └── document.getElementById("MonitoringForm")
  │                 .getElementsByClassName("save")[0].focus() // focus submit button
  │         }
  │   } finally {
  │     └── toggleDisplayLoader(false)              // hide loader (off) — always
  │   }
  └── if (!entry)                                   // stale id, form untouched
        ├── initializeExtension()                   // re-render template list
        └── alert("This template does not exist anymore. …")
```

The `timeEntryBillable ?? billable` rule: when the caller passes a boolean
`timeEntryBillable` (e.g. from a ManicTime import entry), that overrides the
template. When it is `undefined` (the common interactive case), the template's
`billable` field is used, defaulting to `true` if absent from the template.

**The loader is hidden in a `finally` (#73).** That is the only place it is
switched off. Everything between the two toggles can throw — changed bexio markup,
a missing save button, a select2 widget that is gone — and the overlay covers the
whole viewport, so a failure used to look like an endless "Loading…" to the user.
(A `waitFor*` that never settles is a different case — see Known issues.)
The `finally` does not catch: the error keeps propagating to the caller
(which is `renderHtml`'s click handler or `onMessage`, neither of which awaits, so
it surfaces as an unhandled rejection in the console — loud, as intended).

**The unknown-`id` guard (#73):** `id` comes from outside — the side panel's
template list or the injected buttons on the page — and can be stale when the
template was deleted in another tab or window. Before the guard existed, `find`
returned `undefined` and the destructuring threw. The guard skips the whole fill
block, so the form is left untouched; the feedback then runs *after* the `finally`
so the `alert()` does not pop up over a still-visible overlay. It also calls
`initializeExtension()` so the stale button disappears from the page list.

Note that the guard makes `fillForm` import the app entry module — a cycle
(`index → renderHtml → fillForm → index`), which is fine because
`initializeExtension` is a hoisted function declaration only called at runtime,
and is the same pattern `onMessage.ts` and `confirmTemplateDeletion.ts` already
use. Tests that import `fillForm` must `vi.mock` that entry module, otherwise its
top-level `initializeExtension()` call runs on import.

The side panel's own list is *not* refreshed by this — there is no
content-script → side-panel message channel; it re-reads storage on its own
`reloadData`. Both behaviours are pinned in `test/utils/fillForm.test.ts`.

---

## Read-back path (`readFormData`)

`readFormData()` reads the current form state and saves it as a new template:

1. `readTextFromSelect2(field)` — takes the focusser `<input>` element, walks
   up to `.closest(".input")`, then queries for `.select2-chosen` to get the
   displayed text.
2. `contactField.value` — reads the autocomplete input's current value; takes
   only the first two space-separated words (bexio adds extra context).
3. `trimAll(packageValue) || trimAll(project) || trimAll(contact) || trimAll(work) || "New Template"`
   — constructs a suggested template name. `trimAll` strips *all* whitespace, so
   the suggestion is the first non-empty field with its spaces removed
   (`"Acme - Back Office"` → `"Acme-BackOffice"`). Each link is pinned in
   `test/utils/readFormData.test.ts`.
4. Calls `prompt()` so the user can confirm or rename the template.
5. SHA-256 hashes the JSON of the entry (excluding `id`) via `generateHash`.
6. Saves via `chromeStorageTemplateEntries.saveTemplates(allEntries)`.
7. Calls `initializeExtension()` to refresh the template button list.

**Note on `readTextFromSelect2`:** it uses `selector.closest(".input")`, which
works because the focusser input is nested inside a `<div class="input">` that
also contains the select2 container with `.select2-chosen`. This traversal is
verified by the tests against `monitoring-edit-filled.html`.

---

## Rendering the injected template UI (`renderHtml`)

Source: `packages/chrome-extension/src/apps/bexioTimetrackingTemplates/renderHtml.ts`

`renderHtml(templateEntries)` removes any previous `#SoulcodeExtensionTemplates`
block and injects a fresh one at the end of `#pr_package`'s
great-grandparent: the header (`Templates (vX.Y.Z)`), the actions row
(`#templateFilter`, `#templateFilterReset`, `#AddNewTemplate`, `#DeleteTemplate`),
the empty entries container `#bexioTimetrackingTemplates-entries`, and the
full-viewport loader overlay `#SoulcodeExtensionLoader`. All of that is **static**
markup and is still inserted with `insertAdjacentHTML`.

**The per-template buttons are built as DOM nodes, never as HTML strings.**
`createTemplateButton(entry)` does `document.createElement("button")`, sets
`type`, `id` (from `entry.id`), `className`
(`entry btn btn-info template-button`) and the inline style, and puts the display
name in via `textContent` (`getTemplateName(entry)`). The buttons are appended to
`#bexioTimetrackingTemplates-entries` *after* the static block has been inserted.

This is deliberate and must stay that way (#85). Template names and ids are
untrusted:

- the name is *suggested* from bexio field values — project, package and contact
  names that any co-worker in the same bexio org can author (`readFormData`),
- it can be typed freely into `prompt()` in `readFormData` or into the side
  panel's template modal, and is stored verbatim in `chrome.storage.local`,
- for entries created before v0.5.x the free-form name **is** the `id`
  (see `getTemplateName` and `docs/architecture/storage.md`).

Interpolating either into an HTML string lets stored markup be parsed into the
live `office.bexio.com` DOM on every `monitoring/edit` load — injected elements,
overlays, and attribute breakout via a `"` in the id. `textContent` and the `id`
property setter cannot be escaped out of. This is the same "sanitise before
HTML" rule the tooltip feature follows (`convertPopover.ts`, see
`docs/architecture/tooltip-replacement.md`), and the reason
`selectors/projectTable_TextCell.ts` documents it on the reader side.

Consumers of the rendered buttons that must keep working when this changes:

| Consumer | How it finds the buttons |
|---|---|
| click handler wiring in `renderHtml` | `#bexioTimetrackingTemplates-entries` → `querySelectorAll("button.entry")` |
| active-template highlight | `.template-button` / `.template-button--active` |
| `confirmTemplateDeletion.ts` | `document.getElementById(buttonId)` and `.template-button--active` |
| filter / reset inputs | the same `domButtons` NodeList, matching on `button.textContent` |
| CSS (`public/bexioTimetrackingTemplates.css`) | `.template-button`, `#bexioTimetrackingTemplates-entries` |
| e2e specs | `button#<id>`, `button.template-button` |

Pinned in `test/apps/bexioTimetrackingTemplates.test.ts` (rendering, the legacy
`id`-as-name fallback, the click → `fillForm` path, and the two injection cases:
a name containing `<img src=x onerror=…>` and an id containing `"`).

---

## Module-load quirk

`packages/chrome-extension/src/selectors/selectors.ts` (and
`billableCheckbox.ts`, `contactField.ts`, etc.) execute `document.querySelector(...)`
**at module top level**, capturing the result in a `const`. This means:

- The content script works because the browser injects it **after** the page
  has fully rendered — the DOM is already populated when the module first runs.
- Tests must load the fixture (`loadFixture("monitoring-edit")`) into
  `document.body` **before** `await import(...)` the selector module.
- Each test calls `vi.resetModules()` in `beforeEach` so the module is
  re-evaluated with a fresh DOM on every test run.

---

## Blast-radius map

The selectors and assumptions most likely to break when bexio changes its markup:

| Assumption | Selector / pattern | Breaks if... | Test that catches it |
|---|---|---|---|
| select2 container IDs | `#s2id_monitoring_*` | bexio renames the underlying `<select>` IDs | `test/selectors/formSelectors.test.ts` |
| select2-chosen text read | `.closest(".input") .select2-chosen` | bexio restructures the select2 widget HTML | `test/utils/readFormData.test.ts` (readTextFromSelect2 tests) |
| Contact autocomplete | `#autocomplete_monitoring_contact_id` | bexio renames or replaces the autocomplete field | `test/selectors/formSelectors.test.ts` |
| Save button selector | `#MonitoringForm .getElementsByClassName("save")[0]` | bexio removes the `save` class from the submit button | `test/utils/fillForm.test.ts` (save-button focus assertion) |
| TinyMCE iframe | `#monitoring_text_ifr` + `#tinymce` body | bexio upgrades TinyMCE or changes the iframe id | `test/selectors/formSelectors.test.ts` (getDescriptionField throw) |
| Loader element | `#SoulcodeExtensionLoader` | The extension's injected loader is missing from the DOM | `test/utils/misc-utils.test.ts` (toggleDisplayLoader) |
| `#select2-drop input` global | the drop uses a single global `#select2-drop` container | bexio changes select2 version where each drop has a unique id | `test/utils/triggerField.test.ts` (waitForSearchBoxField behaviour) |

---

## Known issues

- **`triggerCheckbox` does not dispatch a `change` event.** The function only
  sets `.checked`; any listener registered for the `change` event will not fire.
  Pinned in: `test/utils/triggerCheckbox.test.ts`.

- **None of the `waitFor*` helpers have a timeout.** They poll forever if the
  awaited DOM condition never becomes true (e.g. if bexio's AJAX call fails or
  the markup changes). Pinned in: `test/utils/waitFor.test.ts`. Note that
  `fillForm`'s `finally` does **not** save the user here: a promise that never
  settles never reaches the `finally`, so the loader still stays up. The `finally`
  covers failures that *throw*; a hanging `waitFor*` needs a timeout of its own.

- **`triggerContactField` uses a hard-coded `delay(1000)`** instead of polling
  for a stable DOM condition after the autocomplete accepts an entry. This can
  be both too slow and not slow enough depending on network conditions.

- **`trimAll` throws `TypeError` on `null`** (no null-guard before accessing
  `.length`). It is safe for `undefined` and `string`, but will crash if called
  with `null`. Pinned in: `test/utils/misc-utils.test.ts`.

- **`pressEnter` is a single shared event instance.** The `pressEnter` module
  exports one `KeyboardEvent` object reused across all calls. The `key` property
  is `""` (not `"Enter"`) because the constructor init dict only sets `keyCode`.
  If bexio ever checks `event.key === "Enter"` instead of `event.keyCode === 13`,
  this will stop working. Pinned in: `test/utils/misc-utils.test.ts`.
