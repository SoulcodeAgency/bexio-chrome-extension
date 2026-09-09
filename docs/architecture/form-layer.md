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

| Bexio label   | DOM id / selector                                                                | Widget type            | Template field  |
| ------------- | -------------------------------------------------------------------------------- | ---------------------- | --------------- |
| Tätigkeit     | `#monitoring_client_service_id` / `#s2id_monitoring_client_service_id`           | select2                | `work`          |
| Status        | `#monitoring_monitoring_status_id` / `#s2id_monitoring_monitoring_status_id`     | select2                | `status`        |
| Kontakt       | `#monitoring_contact_id` (hidden) + `#autocomplete_monitoring_contact_id` (text) | jQuery-UI autocomplete | `contact`       |
| Kontaktperson | `#monitoring_sub_contact_id` / `#s2id_monitoring_sub_contact_id`                 | select2                | `contactPerson` |
| Projekt       | `#monitoring_pr_project_id` / `#s2id_monitoring_pr_project_id`                   | select2 (AJAX options) | `project`       |
| Arbeitspaket  | `#monitoring_pr_package_id` / `#s2id_monitoring_pr_package_id`                   | select2 (AJAX options) | `package`       |
| abrechenbar   | `#monitoring_allowable_bill`                                                     | checkbox               | `billable`      |
| Datum         | `#monitoring_date`                                                               | jQuery-UI datepicker   | `date`          |
| Dauer         | `#monitoring_duration`                                                           | jQuery-UI timepicker   | `duration`      |
| Bemerkungen   | `#monitoring_text` + iframe `#monitoring_text_ifr` → `body#tinymce`              | TinyMCE                | —               |

The select2 containers follow the naming pattern `#s2id_monitoring_<field_id>`,
and each contains a focusser `<input class="select2-focusser">` plus a hidden
search-box `<input class="select2-input">` inside `.select2-drop`.

---

## Synthetic-event recipe per field type

### select2 fields (`triggerField`)

1. Call `waitForSelectOptions(selectorId, undefined, value)` — polls every
   250 ms until the sibling `<select>` has more than one option (the AJAX load
   has completed) **and** holds an option that select2's search for `value`
   could match (#84). Rejects after 20 s.
2. Set the focusser input's `.value` to the target string.
3. Dispatch the shared `pressEnter` `KeyboardEvent` (`keyCode: 13`, **not**
   `key: "Enter"`) on the focusser — triggers select2 to open the drop and run
   a search.
4. Call `waitForSearchBoxField()` — polls every 250 ms until
   `#select2-drop input` appears. Rejects after 20 s.
5. Set the drop input's `.value` to the target string.
6. Dispatch `pressEnter` on the drop input — selects the first result.
7. Call `waitForSearchBoxFieldToBeRemoved()` — polls every 250 ms until
   `#select2-drop input` disappears (drop closes). Rejects after 20 s — this is
   the one that fires when the search matched nothing, because select2 then
   keeps the drop open.

Early-return: if `value === null || value.trim() === ""` the function returns
immediately (the field is left unchanged).

### contact autocomplete field (`triggerContactField`)

1. Set `contactField.value` to the target string.
2. Call `.click()` three times (jQuery-UI autocomplete trigger idiom).
3. Call `waitForContacts()` — polls every 250 ms until `.ac_results` is
   visible. Rejects after 20 s.
4. Dispatch `pressEnter` on `contactField` — accepts the first suggestion.
5. `await delay(1000)` — hard-coded wait for the UI to settle.
   **Known issue:** this is a fixed delay, not a condition check.

Early-return: if `value == null || value.trim() === ""` the function returns
immediately (the field is left unchanged) — same guard as `triggerField`. The
loose `== null` also catches `undefined`, which templates saved before the field
existed can carry and which would otherwise be coerced to the literal string
`"undefined"`. Without this guard an empty query never opens `.ac_results`, so
the timeout-less `waitForContacts` polls forever and `fillForm`'s loader overlay
never comes down (#82).

### checkbox (`triggerCheckbox`)

Sets `selector.checked = checked`. **Does NOT dispatch a `change` event.**
(See Known Issues.)

### date field (`triggerDate`) and duration field (`triggerDuration`)

Both are two lines and identical apart from the selector: set the input's
`.value`, then dispatch the shared `pressEnter` `KeyboardEvent` on it.

```ts
dateField.value = value;
dateField.dispatchEvent(pressEnter);
```

**No `change` and no `input` event is dispatched** — only that one `keydown`.
If a datepicker/timepicker update stops taking effect, the event to look for
is the `keydown` (`keyCode: 13`), not a `change`. Neither function guards
against an empty `value`: `triggerDuration("")` clears the field.
Pinned in `test/utils/triggerDate.test.ts` and `test/utils/triggerDuration.test.ts`.

### description field (`triggerDescription`)

`getDescriptionField()` reaches through the TinyMCE iframe
(`#monitoring_text_ifr` → `body#tinymce`) and `triggerDescription` assigns
`descriptionField.textContent = value`. That is the whole recipe: **no synthetic
events are dispatched** and the backing `<textarea id="monitoring_text">` is not
touched. Markup in the value is stored as literal text, and an empty string
clears the field (there is no early-return guard). Pinned in
`test/utils/triggerDescription.test.ts`. (See Known Issues.)

### pressEnter

`pressEnter` is a module-level `KeyboardEvent` **instance** (not a function),
created once at import time with `{ bubbles: true, cancelable: true, keyCode: 13 }`.
Note: the `key` property is `""` (not `"Enter"`) because the constructor init
dict only specifies `keyCode`. The same object is reused for every dispatch.

---

## Why the `waitFor*` polling exists

Select2 loads its option lists via AJAX after the page renders. The
`waitForSelectOptions` helper polls until the backing `<select>` has options.

`waitForSelectOptions(selector, timeToWait = 250, expectedValue = null, valueWaitBudgetMs = 5000, timeoutMs = 20000)`:

- The base condition: the sibling `<select>` exists and has more than one
  `<option>`. Like every `waitFor*`, this rejects with a `WaitForTimeoutError`
  after `timeoutMs` (#83).
- With `expectedValue` (what `triggerField` is about to search for), the option
  list must additionally contain a match. The comparison mirrors select2's own
  default matcher — a case-insensitive substring test — on whitespace-collapsed,
  trimmed text, so a positive check means the search that follows can hit
  something. Case-insensitivity is load-bearing: templates can store a value
  whose casing differs from the option label (e.g. `work` vs `Work`).
- **Why:** Kontaktperson and Arbeitspaket are repopulated by AJAX after their
  parent field (Kontakt / Projekt) changes. Until that response arrives the
  select still holds the _previous_ selection's options, and `options.length > 1`
  cannot tell a stale list from a fresh one. That is harmless on a pristine form
  but not when editing an existing entry or applying a second template.
- **Termination:** the value wait is bounded by `valueWaitBudgetMs`
  (`VALUE_WAIT_BUDGET_MS`, **5 000 ms**, counted from the moment the base
  condition first holds). When the value is genuinely absent — a deleted
  package, a template that no longer matches the contact — the helper resolves
  anyway and degrades to the plain "options are loaded" behaviour instead of
  failing the whole fill.
- The independent fields (Tätigkeit, Status) are not AJAX-repopulated: their
  options are in the page from the start, so the check passes on the first poll.

Similarly, opening the select2 drop is asynchronous from jsdom's perspective —
`waitForSearchBoxField` and `waitForSearchBoxFieldToBeRemoved` wait for the
drop to appear / disappear. The jQuery-UI autocomplete results likewise appear
asynchronously, hence `waitForContacts`.

All four are thin wrappers around one primitive, `pollUntil(label, check,
intervalMs, timeoutMs)` in `src/utils/pollUntil.ts`. It runs `check` immediately,
then every `intervalMs` (`POLL_INTERVAL_MS`, **250 ms**), and rejects with a
`WaitForTimeoutError` naming `label` once `timeoutMs` (`POLL_TIMEOUT_MS`,
**20 000 ms**) has elapsed (#83). Each `waitFor*` keeps its original signature and
takes the interval and the deadline as optional trailing arguments, so callers
did not change.

Why those numbers:

- **250 ms interval** — the checks are plain DOM reads, so polling four times a
  second costs nothing, and the first check is synchronous either way. At the
  old 1000 ms a full `fillForm` (≈15 waits) could spend ~15 s purely waiting for
  the next poll tick.
- **20 s deadline, per wait** — must survive bexio's slowest select2 AJAX load on
  a large account over a bad connection, since a false timeout aborts a fill that
  would have succeeded. It is a budget per wait, not for the whole fill.

`triggerContactField`'s trailing `await delay(1000)` is _not_ a poll and has no
deadline — it is a fixed wait (see Known issues).

---

## Getting to the form (side panel → tab navigation)

Source: `packages/sidePanel-import/src/utils/openBexioTimeTrackingPage.ts`

The side panel can only apply an import entry when the tab it messages actually
runs the template content script. `TableCellTrackingDay`'s ▶️ button therefore
awaits `openBexioTimeTrackingPage()` (in production builds only —
`utils/development.ts`) before calling its `onButtonClick`.

The function queries the active tab of the last focused window and:

- resolves right away if that tab is already on the plain
  `https://office.bexio.com/index.php/monitoring/edit` URL. `/edit/id/<id>` is
  deliberately **not** treated as "already there": that form edits an _existing_
  time entry, so we navigate to a fresh one instead;
- otherwise registers a `chrome.tabs.onUpdated` listener, calls
  `chrome.tabs.update(tabId, { url })`, and resolves when **that tab id** reports
  `status === "complete"` on a URL that `isTimeTrackingPageUrl` accepts. That
  predicate mirrors the manifest's content-script patterns
  (`…/monitoring/edit` and `…/monitoring/edit/id/*`, fragment ignored) — matching
  anything wider would resolve on a page where the content script does not run;
- waits a further 500 ms so bexio can finish rendering, then resolves `true`;
- rejects if there is no tab, if `chrome.tabs.update` fails, or after
  `NAVIGATION_TIMEOUT_MS` (15 s) — an expired session redirecting to the login
  page used to leave this promise pending forever _and_ leak one permanent
  `onUpdated` listener per click (#88). A single `finish()` helper is the only
  exit: it clears the timer and removes the listener on success, timeout and
  error alike.

The caller catches the rejection, logs it and does **not** apply the entry (the
content script is not there to receive the message). Pinned in
`packages/sidePanel-import/test/openBexioTimeTrackingPage.test.ts`.

**Note:** the service worker independently gates the side panel on
`office.bexio.com/index.php/monitoring*` (`public/service_worker.js`), which is
wider than the edit form — the side panel is visible on the monitoring list too,
which is exactly why this navigation step exists.

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
  │           │     contact = null, work = null, contactPerson = null, project = null,
  │           │     status = null, billable = true, package (as packageValue ?? null)
  │           ├── triggerField(workFieldID, work)   // the template's own Tätigkeit
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
  │   } catch (error) {
  │     ├── if (!(error instanceof WaitForTimeoutError)) throw error
  │     └── remember it                             // a waitFor* gave up (#83)
  │   } finally {
  │     └── toggleDisplayLoader(false)              // hide loader (off) — always
  │   }
  ├── if (!entry)                                   // stale id, form untouched
  │     ├── initializeExtension()                   // re-render template list
  │     └── alert("This template does not exist anymore. …")
  └── if (timeout)                                  // form left half-filled
        ├── console.error(…)
        └── alert("The template could not be applied completely: …")
```

**The `work` (Tätigkeit) value (#81):** `fillForm` used to pass the literal string
`"work"` to the select2, ignoring the template's stored `work` value entirely. On
accounts whose activity names do not contain "work" (e.g. "Beratung",
"Entwicklung") the search matched nothing, so `waitForSearchBoxFieldToBeRemoved()`
— which has no timeout — polled forever and the loader overlay never came down.
It now passes the template's own `work`, defaulting to `null` for legacy templates
saved before the field existed; `triggerField`'s empty-value early-return then
leaves the Tätigkeit untouched instead of hanging.

The `timeEntryBillable ?? billable` rule: when the caller passes a boolean
`timeEntryBillable` (e.g. from a ManicTime import entry), that overrides the
template. When it is `undefined` (the common interactive case), the template's
`billable` field is used, defaulting to `true` if absent from the template.

**The loader is hidden in a `finally` (#73).** That is the only place it is
switched off. Everything between the two toggles can throw — changed bexio markup,
a missing save button, a select2 widget that is gone — and the overlay covers the
whole viewport, so a failure used to look like an endless "Loading…" to the user.
The `finally` does not catch: the error keeps propagating to the caller
(which is `renderHtml`'s click handler or `onMessage`, neither of which awaits, so
it surfaces as an unhandled rejection in the console — loud, as intended; see
"Messaging contract" below for why `onMessage` still does not await it).

**`WaitForTimeoutError` is the one exception (#83).** Since the `waitFor*` helpers
got deadlines, a bexio AJAX failure, an offline browser or a select2 search with no
result ends the fill with a `WaitForTimeoutError` instead of hanging forever. That
error _is_ caught: neither caller awaits `fillForm`, so rethrowing would produce an
unhandled rejection the user never sees, and the form is left half-filled — which
needs saying out loud. It is reported the same way as the stale-id case, after the
`finally` so the `alert()` does not pop up over a still-visible overlay:
`console.error` plus an `alert()` naming the condition that timed out. Every other
error still propagates untouched. Both paths are pinned in
`test/utils/fillForm.test.ts`.

**The unknown-`id` guard (#73):** `id` comes from outside — the side panel's
template list or the injected buttons on the page — and can be stale when the
template was deleted in another tab or window. Before the guard existed, `find`
returned `undefined` and the destructuring threw. The guard skips the whole fill
block, so the form is left untouched; the feedback then runs _after_ the `finally`
so the `alert()` does not pop up over a still-visible overlay. It also calls
`initializeExtension()` so the stale button disappears from the page list.

Note that the guard makes `fillForm` import the app entry module — a cycle
(`index → renderHtml → fillForm → index`), which is fine because
`initializeExtension` is a hoisted function declaration only called at runtime,
and is the same pattern `onMessage.ts` and `confirmTemplateDeletion.ts` already
use. Tests that import `fillForm` must `vi.mock` that entry module, otherwise its
top-level `initializeExtension()` call runs on import.

The side panel's own list is _not_ refreshed by this — there is no
content-script → side-panel message channel; it re-reads storage on its own
`reloadData`. Both behaviours are pinned in `test/utils/fillForm.test.ts`.

---

## Messaging contract (side panel ↔ content script)

Source: `packages/chrome-extension/src/eventListeners/onMessage.ts`,
`packages/sidePanel-import/src/utils/sendToBexioTab.ts`,
`packages/shared/types.ts` (`ExchangeRequestData`, `ExchangeResponse`).

### Receiving half — `onMessage`

```
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  handleExchangeRequest(request).then(
    () => sendResponse({ ok: true }),
    (error) => sendResponse({ ok: false, error: error.message })
  );
  return true;            // keep the message channel open for the async sendResponse
});
```

The listener is **synchronous** and returns `true`; `handleExchangeRequest` is the exported async
dispatcher that does the work. It used to be an `async` listener that never called `sendResponse`,
which left the response semantics up to the Chrome version — the side panel's `await
chrome.tabs.sendMessage(...)` had nothing reliable to resolve with.

`{ ok: true }` is a **dispatch acknowledgement**, not "the form is filled":

- `mode: "time+duration"` — `triggerDuration` / `triggerDate` / `triggerCheckbox` run synchronously,
  then the two description settings are awaited before `triggerDescription`. The response follows.
  `applyNotesSetting` decides whether a description is written at all; when it is, and
  `uppercaseFirstLetterSetting` is on (its default), `request.notes` is passed through
  `capitalizeFirstLetter` first — the first non-whitespace character is uppercased, nothing else
  changes. Both settings are read here rather than in the side panel, so a switch flipped in the
  panel takes effect on the next applied entry and `ExchangeRequestData` stays unchanged. The
  message therefore always carries the raw ManicTime text, which is also what the panel's table
  shows.
- `mode: "template"` — `fillForm` is called but deliberately **not** awaited. Its `waitFor*` helpers
  have no timeout (see Known issues), so awaiting it could hold the message channel open forever and
  hang the side panel. A `fillForm` failure therefore still surfaces as an unhandled rejection in the
  page console, exactly as before.
- `mode: "reload"` — `initializeExtension()` re-renders the injected template list.

Anything that throws (or rejects) inside `handleExchangeRequest` is turned into
`{ ok: false, error }` instead of an unhandled rejection.

### Sending half — `sendToBexioTab`

Every side-panel message goes through `sendToBexioTab(data, options)`
(`applyTemplate`, `reloadExtension` and `ImportEntries.applyImportEntry` are thin wrappers around
it). It returns `{ ok: true, tabId }` or `{ ok: false, error }` and reports each failure to the user
with an antd `message` toast — the three paths used to be detached
`(async () => { ... })()` IIFEs with no `catch`, so a failed apply looked like a dead button (#86).

| Situation                                                                                              | User-visible feedback                                               |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `chrome.tabs` missing (standalone Vite dev server)                                                     | error: "Chrome extension APIs are unavailable here…"                |
| `chrome.tabs.query` returns `[]` or a tab without an `id` (e.g. a detached DevTools window is focused) | error: "No active browser tab found…"                               |
| `chrome.tabs.sendMessage` rejects with "Receiving end does not exist"                                  | error: "Open the bexio time-tracking page (monitoring/edit) first…" |
| The content script answers `{ ok: false, error }`                                                      | error: "The bexio page could not apply the data: …"                 |

The "receiving end does not exist" case is **normal**, not exotic: the service worker enables the
side panel on every `office.bexio.com/index.php/monitoring*` tab, but the `onMessage` listener is
only injected on `monitoring/edit*`. Pressing Apply from `monitoring/list` therefore always lands
in that row. Callers can override the text and severity for it — `reloadExtension` does, because
the storage write it follows up has already succeeded, so it warns ("The template list on the bexio
page was not refreshed — reload that tab…") instead of erroring.

`applyTemplate` does **not** call `openBexioTimeTrackingPage` first (the way
`TableCellTrackingDay` does before applying an import entry): that helper never rejects when the
navigation does not complete, so reusing it would trade a clear error message for a possible
silent hang. See issue #88.

Pinned in `packages/sidePanel-import/test/sendToBexioTab.test.ts`,
`packages/sidePanel-import/test/importEntries.test.tsx` and
`packages/chrome-extension/test/eventListeners/onMessage.test.ts`.

---

## Read-back path (`readFormData`)

`readFormData()` reads the current form state and saves it as a new template:

1. `readTextFromSelect2(field)` — takes the focusser `<input>` element, walks
   up to `.closest(".input")`, then queries for `.select2-chosen` to get the
   displayed text.
2. `contactField.value` — reads the autocomplete input's current value; takes
   only the first two space-separated words (bexio adds extra context).
3. `trimAll(packageValue) || trimAll(project) || trimAll(contact) || trimAll(work) || "New Template"`
   — constructs a suggested template name. `trimAll` strips _all_ whitespace, so
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
`#bexioTimetrackingTemplates-entries` _after_ the static block has been inserted.

This is deliberate and must stay that way (#85). Template names and ids are
untrusted:

- the name is _suggested_ from bexio field values — project, package and contact
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

| Consumer                                      | How it finds the buttons                                                   |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| click handler wiring in `renderHtml`          | `#bexioTimetrackingTemplates-entries` → `querySelectorAll("button.entry")` |
| active-template highlight                     | `.template-button` / `.template-button--active`                            |
| `confirmTemplateDeletion.ts`                  | `document.getElementById(buttonId)` and `.template-button--active`         |
| filter / reset inputs                         | the same `domButtons` NodeList, matching on `button.textContent`           |
| CSS (`public/bexioTimetrackingTemplates.css`) | `.template-button`, `#bexioTimetrackingTemplates-entries`                  |
| e2e specs                                     | `button#<id>`, `button.template-button`                                    |

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

| Assumption                   | Selector / pattern                                                             | Breaks if...                                                                                                                            | Test that catches it                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| select2 container IDs        | `#s2id_monitoring_*`                                                           | bexio renames the underlying `<select>` IDs                                                                                             | `test/selectors/formSelectors.test.ts`                                                                                                                           |
| select2-chosen text read     | `.closest(".input") .select2-chosen`                                           | bexio restructures the select2 widget HTML                                                                                              | `test/utils/readFormData.test.ts` (readTextFromSelect2 tests)                                                                                                    |
| Contact autocomplete         | `#autocomplete_monitoring_contact_id`                                          | bexio renames or replaces the autocomplete field                                                                                        | `test/selectors/formSelectors.test.ts`                                                                                                                           |
| Save button selector         | `#MonitoringForm .getElementsByClassName("save")[0]`                           | bexio removes the `save` class from the submit button                                                                                   | `test/utils/fillForm.test.ts` (save-button focus assertion)                                                                                                      |
| TinyMCE iframe               | `#monitoring_text_ifr` + `#tinymce` body                                       | bexio upgrades TinyMCE or changes the iframe id                                                                                         | `test/selectors/formSelectors.test.ts` (getDescriptionField throw) + `test/utils/triggerDescription.test.ts` (success path, against the captured iframe fixture) |
| Loader element               | `#SoulcodeExtensionLoader`                                                     | The extension's injected loader is missing from the DOM                                                                                 | `test/utils/misc-utils.test.ts` (toggleDisplayLoader)                                                                                                            |
| `#select2-drop input` global | the drop uses a single global `#select2-drop` container                        | bexio changes select2 version where each drop has a unique id                                                                           | `test/utils/triggerField.test.ts` (waitForSearchBoxField behaviour)                                                                                              |
| Dependent-select freshness   | `waitForSelectOptions` matches the searched value against the `<option>` texts | bexio labels an option differently from the string a template stored (then the wait burns its budget and degrades to the old behaviour) | `test/utils/waitFor.test.ts`, `test/utils/triggerField.test.ts` (#84 tests)                                                                                      |

---

## Known issues

- **`triggerCheckbox` does not dispatch a `change` event.** The function only
  sets `.checked`; any listener registered for the `change` event will not fire.
  Pinned in: `test/utils/triggerCheckbox.test.ts`.

- **`triggerDescription` dispatches no events and never syncs the textarea.**
  It only sets `body#tinymce`'s `textContent`, so TinyMCE is not told the content
  changed and the hidden `<textarea id="monitoring_text">` — the field bexio
  actually submits — is left as it was. Pinned in
  `test/utils/triggerDescription.test.ts`.

- **`triggerDescription`'s `if (descriptionField)` guard is dead code.**
  `getDescriptionField()` _throws_ when the iframe body is missing instead of
  returning a falsy value, so the guard never sees `undefined` and the call
  rejects rather than silently no-op'ing. `onMessage` neither awaits nor catches
  it, so on a page without the TinyMCE iframe this surfaces as an unhandled
  rejection. Pinned in `test/utils/triggerDescription.test.ts`.

- ~~**None of the `waitFor*` helpers have a timeout.**~~ Resolved in #83: they
  now reject with a `WaitForTimeoutError` after `POLL_TIMEOUT_MS` (20 s), so
  `fillForm`'s `finally` hides the loader and the user gets an `alert()`. Pinned
  in: `test/utils/waitFor.test.ts` and `test/utils/fillForm.test.ts`. Residual
  caveat: the deadline is _per wait_, so a fill that is merely very slow can
  still take minutes in total before any single wait gives up, and a timeout
  leaves the form partially filled — the alert says so, but nothing rolls the
  already-applied fields back. (The one _routine_ trigger — a template with an
  empty contact — was separately closed by the `triggerContactField` guard, #82.)

- **A template without a `work` value leaves the Tätigkeit untouched.** `fillForm`
  applies the template's stored `work` (#81), but templates saved before that field
  existed — or with an empty Tätigkeit — fall back to `null`, and `triggerField`
  returns early. The field then keeps whatever bexio pre-selected. Pinned in:
  `test/utils/fillForm.test.ts` (absent-field test).

- **The stale-options guard is a heuristic, not a handshake.** If the value the
  new template searches for happens to be present in the _previous_ selection's
  option list too, `waitForSelectOptions` still resolves on the stale list —
  nothing in the DOM marks a list as "freshly loaded". The other direction is
  the bounded degradation above: a value that never arrives costs ~5 s and then
  proceeds as before.

- **`triggerContactField` uses a hard-coded `delay(1000)`** instead of polling
  for a stable DOM condition after the autocomplete accepts an entry. This can
  be both too slow and not slow enough depending on network conditions. Unlike
  the `waitFor*` helpers it has no deadline to blow, because it is a fixed wait
  rather than a poll.

- **`trimAll` throws `TypeError` on `null`** (no null-guard before accessing
  `.length`). It is safe for `undefined` and `string`, but will crash if called
  with `null`. Pinned in: `test/utils/misc-utils.test.ts`.

- **`pressEnter` is a single shared event instance.** The `pressEnter` module
  exports one `KeyboardEvent` object reused across all calls. The `key` property
  is `""` (not `"Enter"`) because the constructor init dict only sets `keyCode`.
  If bexio ever checks `event.key === "Enter"` instead of `event.keyCode === 13`,
  this will stop working. Pinned in: `test/utils/misc-utils.test.ts`.
