# bexio's new time tracking UI (#168)

Since 2026-09 bexio's menu entry "Projekte → Zeiten" opens an Angular page,
`/index.php/time-tracking?sortBy=date:desc&filter=all&filterBy=`. Time entries are listed in an
ag-grid and created or edited in an Angular Material **dialog** on that page; the URL does not
change. A project's "Zeiten" tab (`pr_project/listTimeTrackingSpa/projectId/N`) and a work
package's time tracking tab (`#tab-time-tracking` on `pr_project/showPackage/packageId/N`) use the
same grid, and their "Zeit erfassen" button (`.fe-create-time-entry-btn`) opens the same dialog.

The old pages are still served, only no longer linked from the menu — `monitoring/edit`,
`monitoring/list`, `pr_project/listMonitoring`, and the invoice's "Zeiten importieren" modal,
which did not change at all. **Both UIs are supported side by side.** Every old code path is
unchanged; each feature decides which UI the page has:

| Feature                   | Old UI                                  | New UI                                                       | Decided by                                      |
| ------------------------- | --------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| Templates block           | in `#MonitoringForm`                    | a column in every time entry dialog                          | `hasMonitoringForm()`                           |
| Apply template            | `fillForm` → `trigger*` / `waitFor*`    | `fillForm` → `fillEditorModal` → `selectMatOption`           | `hasMonitoringForm()` in `fillForm`             |
| Apply ManicTime entry     | `triggerDate` / `triggerDuration` / …   | `applyEntryToEditorModal`                                    | `hasMonitoringForm()` in `onMessage`            |
| 📤 submit                 | `submitMonitoringForm`                  | `submitEditorModal`                                          | `hasMonitoringForm()` in `onMessage`            |
| "form-submitted" to ✅    | `submit` event of `#MonitoringForm`     | click on "Eintrag speichern", then the dialog leaves the DOM | `initializeExtension`                           |
| Save as / update template | `readCurrentFormValues` (select2 texts) | `readEditorModalValues` (`mat-select` texts)                 | `hasMonitoringForm()`                           |
| Remarks as text           | `convertPopover`                        | `convertGridRemarks` + MAIN-world column widths              | the page path (`selectors/timeTrackingGrid.ts`) |
| "Newest first"            | `autoSortByDate`                        | not offered — the grids sort by date, descending, themselves | the page path                                   |

The facts below come from a read-only probe of live bexio on 2026-09-30, recorded in issue #168.
**The unit and e2e tests run against synthetic fixtures** built from that probe
(`test/fixtures/bexio/*.synthetic.html`) and a stand-in for Angular Material — whether bexio's
Angular components accept the extension's input is the manual check in `testing.md` § 5.6.

---

## Entry points

- **Manifest.** The templates script (`bexioTimetrackingTemplates/index.ts`) also matches
  `index.php/time-tracking*`, `pr_project/show/id/*`, `pr_project/listTimeTrackingSpa/*` and
  `pr_project/showPackage/*`. It stays **one** entry: its `onMessage` listener must exist once per
  page, or every side-panel request would be applied twice (pinned in `test/manifest.test.ts`). The
  list script (`bexioProjectList/index.ts`) additionally matches the new list and project pages.
  A third entry runs `bexioGridColumns/index.iife.ts` in the **MAIN world** (below).
- **Service worker.** The side panel is enabled on those pages too (`SIDE_PANEL_URL_PREFIXES`, the
  same list in `configureSidePanel` and in the install/startup sweep). The toolbar icon opens
  `/index.php/time-tracking`.
- **Side panel.** `openBexioTimeTrackingPage` navigates to `/index.php/time-tracking` and treats
  every new-UI page as "already there" — the content script opens a dialog itself.
  `isTimeTrackingPageUrl` accepts old and new URLs. The "no content script" toast names
  "Projekte → Zeiten".

Content scripts are injected on page loads only. If bexio's Angular shell ever routes to
`/time-tracking` without a page load, nothing is injected until the page is reloaded.

---

## The time entry dialog

`mat-dialog-container > … > div.time-entries-dialog--editor` (header with the title, body with the
fields, footer with "Eintrag speichern"), title "Neue Zeiterfassung" or "Zeiterfassung bearbeiten".
`bexio-time-entry-editor-modal` is **not** the dialog: that component stays an empty host in the
page, outside the overlay, and renders the dialog through a portal (verified live 2026-10-02). Everything is plain Angular in the light DOM — no shadow DOM, no
iframe — so the isolated-world content script drives it with DOM events. Selectors live in
`src/selectors/timeEntryModal.ts` and are all resolved **at call time** (no module-load capture):
the dialog comes and goes without a page load.

### Field map

| Field           | Selector                                                                          | Widget                                                   | Written by                        |
| --------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------- |
| Datum           | `bexio-simple-datepicker input` (no `data-for-test`)                              | mat-datepicker input, `dd.MM.yyyy`                       | `setModalDate`                    |
| Dauer           | `[data-for-test=time-entry-editor-duration]` → its `input`                        | `bexio-time-entry-hh-mm-input`, `maxlength=5`            | `setModalDuration`                |
| Tätigkeit       | `mat-select[data-for-test=time-entry-editor-activity]`                            | mat-select + ngx-mat-select-search                       | `selectMatOption("activity")`     |
| Status          | `…-status`                                                                        | same                                                     | `selectMatOption("status")`       |
| Kontakt         | `…-contact`                                                                       | same; the search filters client-side                     | `selectMatOption("contact")`      |
| Projekt         | `…-project`                                                                       | same; `aria-disabled=true` until a contact is set        | `selectMatOption("project")`      |
| Arbeitspaket    | `…-work-package`                                                                  | same; disabled until a project is set                    | `selectMatOption("work-package")` |
| Ansprechpartner | `…-sub-contact`                                                                   | same; defaults to the current user, `Lastname Firstname` | `selectMatOption("sub-contact")`  |
| Bemerkungen     | `bexio-ngx-editor[data-for-test=time-entry-editor-remarks]` → `[contenteditable]` | ngx-editor (ProseMirror)                                 | `setModalRemarks`                 |
| verrechenbar    | `bexio-slide-toggle input[type=checkbox]` (the one labelled "verrechenbar")       | slide toggle                                             | `setModalBillable`                |
| Save            | button "Eintrag speichern" in the `mat-dialog-container`                          | `disabled` until the required fields are valid           | `submitEditorModal`               |

### Recipes

- **Inputs** (`modalFields.ts`): focus, set `.value`, dispatch `input`, `change`, `blur` and
  `focusout`. Angular's value accessors read the DOM value on `input`; the datepicker also parses on
  `change` / `blur`. ManicTime's `dd/MM/yyyy` becomes `dd.MM.yyyy`, a one-digit hour is padded
  (`1:30` → `01:30`).
- **Dauer is typed, not set.** bexio's hh:mm inputs (Dauer, Start, Ende) cancel each digit's
  `keydown` and write it into their own model; that model is what gets saved, and Ende is derived
  from it when Dauer loses focus. A `.value` write plus `input` is only displayed — such entries
  were saved as 0:01 with Ende unchanged (verified live 2026-10-03, as was the fix: an entry typed
  this way saved as 1:15, "Bis 01:15"). So `setModalDuration` selects the field, dispatches one
  `keydown` per digit of `hhmm`, then `blur` / `focusout`, and throws when the field does not show
  the value afterwards. Where nothing cancels the first keystroke (jsdom) it falls back to the input
  recipe.
- **Remarks**: a selection over the whole editor, then `document.execCommand("insertText")` per line
  and `insertParagraph` between lines — ProseMirror handles that like typing, and bexio's character
  counter follows. When `execCommand` is missing or the text did not arrive, the paragraphs are
  written into the DOM and an `input` event dispatched; ProseMirror's DOM observer reads such
  changes back.
- **verrechenbar**: a `click()` on the checkbox, only when its state differs.
- **Selects** (`selectMatOption.ts`), one field at a time:
  1. wait for the field and for it to be enabled;
  2. skip when it already shows the value exactly;
  3. click `.mat-mdc-select-trigger`, wait for the **live** panel;
  4. find the best option in the full list (`optionMatch.ts`, below). After
     `SEARCH_FALLBACK_AFTER_MS` (1 s) without a match, the value's first word goes into the search
     input (`input` event) for a list that only shows what was searched;
  5. click the option and wait until the field shows its text and the panel is closed.

  A value that is not among the options for `VALUE_WAIT_BUDGET_MS` (5 s, counted from the first
  option seen) closes the panel again (Escape, then the backdrop) and rejects with a
  `WaitForTimeoutError` naming value and field — `fillForm` reports it like every other timeout.
  All waits go through `pollUntil`; a poll check never throws, because `pollUntil` calls it from a
  timer where a throw would escape the promise.

### Gotchas

- Closed `mat-select` panels stay in `.cdk-overlay-container` **with the same id** as the next one.
  `getLiveSelectPanel` looks the `aria-controls` id up among all overlay panels and takes the last.
- `mat-option-N` / `mat-input-N` / `mat-select-N` ids are generated per render; never select by them.
- The dialog has no `<form>` and fires no `submit`. "Saved" is a click on "Eintrag speichern"
  followed by the dialog leaving the DOM within 15 s (`watchEditorModalSave`, one capture-phase
  click listener on the document). A dialog that stays open — bexio rejected the entry — reports
  nothing, so the side panel keeps 📤. (The old form reported on `submit`, before the POST.)

### Matching template values (`optionMatch.ts`)

Best first: **exact** (whitespace and case normalised), **substring** (select2's rule — what old
templates rely on), **word set** (every word of the value is a word of the option, in any order).
Among equal matches the first in list order wins. The word-set rule exists because the dialog lists
people as `Lastname Firstname`, while the old form showed — and templates stored —
`Firstname Lastname` (and was not even consistent). The old form's select2 path is unchanged and
still matches by substring only.

### Order of a template fill (`fillEditorModal`)

`ensureEditorModal({ allowEdit: true })` → Tätigkeit → Status → Kontakt → Projekt (waits for it to be
enabled) → Arbeitspaket (skipped when the template has none) → Ansprechpartner → verrechenbar
(`timeEntryBillable ?? billable`, `billable` defaulting to `true`, as in the old form) → focus the
save button. Stale ids, timeouts and the loader are handled by `fillForm` for both UIs; the loader
only shows where the Templates column already injected one, and only for a fill that runs longer
than `DIALOG_LOADER_DELAY_MS` (800ms, no view transition) — a dialog fill usually takes 0.4–3s, and
the old page's instant overlay flashed up for each one. The old page keeps its instant loader.

**Kontakt → Projekt waits for bexio's request.** Picking a contact makes bexio load its projects
(`/2.0/timesheet/views/contacts/<id>/projects`), but the Projekt field keeps offering the list it had
before until the answer arrives — the last dialog's list, on a second opening. A project picked from
it is reset when the answer comes and set again without its work packages being loaded, so
Arbeitspaket stays disabled and the fill times out after 20s (reproduced live 2026-10-02, about one
fill in two for "Soulcode - Innovation"). After a _changed_ contact the fill therefore waits until a
`PerformanceObserver` has seen that request finish (`utils/timeEntryModal/bexioRequests.ts`), at most
`CONTACT_PROJECTS_WAIT_MS` (5s), and goes on regardless after that — a renamed API path costs 5s, not
the fill. Nothing in the DOM marks the answer's arrival, hence the request.

### Opening a dialog (`ensureEditorModal`)

The side panel's requests need a dialog. An open one is used; otherwise "Zeit erfassen"
(`.fe-create-time-entry-btn`, else the button with that text) is clicked and the dialog awaited. A
**ManicTime entry never goes into "Zeiterfassung bearbeiten"** — it would overwrite an existing
entry's date and duration (the old UI navigated away from `/edit/id/…` for the same reason); the
request fails with a message asking to close that dialog. A template may be applied to it, as on
the old `/edit/id/…` page.

### The Templates column (`editorModalColumn.ts`)

A `MutationObserver` on `document.body` (one `querySelectorAll` per mutation batch) calls
`renderHtml` for every dialog that opens, into a `#SoulcodeExtensionModalColumn` inserted right after
`.time-entries-dialog--editor`. Classes do the layout (`bexioTimetrackingTemplates.css`): the pane
(`.soulcode-modal-pane`) is widened past its inline `max-width: 720px` to 1020px with `!important`,
the dialog surface becomes a row, bexio's form keeps `flex: 0 1 720px`, the column gets a fixed
300px and lists the templates in one column. `contain: size` keeps the column's content out of the
dialog's height: the column is as tall as bexio's form and scrolls on its own. The panel carries
`template-panel--modal`, which styles its heading, toolbar, buttons and inputs itself — bexio's old
`.btn` / `.row-fluid` stylesheet is not on these pages.

bexio styles the dialog through rules like `.ngBx h2` (the pane carries `ngBx`), and its stylesheet
comes after the content script's, so a rule of equal specificity loses. The first version lost every
tie — the surface stayed a column (Templates below the form), the heading rendered at 56px, the `<hr>`
showed (seen live 2026-10-02). Every dialog rule is therefore anchored on `#SoulcodeExtensionTemplates`
/ `#SoulcodeExtensionModalColumn` or carries `!important`; keep it that way when adding one.

Keydowns in the column stop propagating: Escape in the filter would otherwise close the dialog.

---

## Remarks in the new grids

### Text (isolated world, `convertGridRemarks.ts`)

The remarks column renders `bexio-time-entry-remarks-cell-renderer fa-icon[aria-label]`, and the
`aria-label` holds the **full** remark as plain text with `\n`. In "Text" mode each icon is hidden
and the label printed into a `.soulcode-grid-remarks` div (`textContent` only): `white-space:
pre-line`, 12px/15px, clamped to three lines — what fits the 56px row. A clipped text gets
`.soulcode-grid-remarks--clipped` (a dotted underline) and on hover expands in place as a floating
box over the rows below (`:has()` lifts the row's `z-index` and its cells' `overflow`). A cell
with a printed remark gets the old pages' colours (`convertPopover.ts`), `#ffe2bc` / `antiquewhite`,
picked by the row's `ag-row-even` / `ag-row-odd` class — ag-grid keeps that class current on a
recycled row, where a counter would not be (checked live 2026-10-03: the rule beats the theme).

ag-grid renders rows lazily and **recycles** them on scroll, paging and filtering, updating a
recycled icon's `aria-label` in place. So the conversion is a sync: one observer on the body
(child lists and `aria-label` attributes) runs the pass at most once per animation frame, and a
printed text whose icon now says something else is rewritten. Per-row heights are not an option:
the grid uses the infinite row model, where `setRowHeight` grows one row and overlaps the next
(verified live).

The toggle: on the new pages there is no old title bar, so a separate "Text | Tooltip" group
(`renderGridNotesToggle.ts`, `#GridNotesTextSwitcher`) goes left of the grid's "Spalten" button
(labelled with the column count, "Spalten (8/9)"). It goes before the button's
`div.mat-mdc-menu-trigger`, not next to the button: that wrapper opens the column menu on any click
inside it, so a toggle placed beside the button opened the menu on every switch (seen live
2026-10-03). It is styled in Soulcode green, not bexio's blue, so it reads as the extension's
control. Same setting (`removePopoversSetting`). A work package page still has the old
title bar and toggle; that toggle drives the grid there as well.

### Column widths (MAIN world, `apps/bexioGridColumns/`)

bexio locks the remarks column at `minWidth = maxWidth = 88px`. ag-grid's API is reachable only
through a page-JS expando, `document.querySelector('ag-grid-angular .ag-root-wrapper').__agComponent
.gridOptionsService.api` (ag-grid's pre-v31 API), which the isolated world cannot see. So a third
content script runs with `"world": "MAIN"`. crxjs builds it as a self-contained IIFE because of the
`.iife.ts` name — its usual loader imports the chunk through `chrome.runtime.getURL`, which the
MAIN world does not have.

The two worlds share only the DOM: the isolated script sets `data-soulcode-remarks="text" |
"tooltip"` on `<html>`, the MAIN script watches that attribute and the body (for grids that render
later). In "text" mode it reads `getColumnDefs()` (which include the column state — hidden columns
from "Spalten", sort), records bexio's widths, writes

| Column            | Text mode                           |
| ----------------- | ----------------------------------- |
| `date`            | 165 (keeps "Von: 09:00 Bis: 15:00") |
| `activity`        | 80–100                              |
| `status`          | 110                                 |
| `invoiceable`     | 110 (95 cuts its header)            |
| `project`         | ≤ 190                               |
| `contact_partner` | ≤ 140                               |
| `text` (remarks)  | `flex: 1`, `minWidth` 200           |

with `setColumnDefs` and calls `sizeColumnsToFit()`; "tooltip" writes bexio's widths back. It
re-applies on `gridColumnsChanged` / `displayedColumnsChanged`, because bexio rewrites its
definitions itself; a comparison of the width keys (not the actual `width`, which ag-grid reports as
laid out) stops its own events from looping. A grid without a `text` column, or without the
expected API, is left alone — the remarks then stay in bexio's 88px column, still readable on hover.

---

## Known limits

- **Not verified against bexio's live Angular components yet.** The probe showed which events the
  inputs accept on display; whether the Angular model takes a synthetic duration must be proven
  with a real save (`testing.md` § 5.6, step 3). The same goes for the layout of the widened dialog
  and the MAIN-world column widths.
- The fixtures are synthetic. Recapture them with the procedure in
  `test/fixtures/bexio/README.md` — the dialog needs the overlay container kept, which the capture
  script empties today.
- "Newest first" is not offered on new-grid pages; `dateSort.ts` still serves the old pages
  (direct `monitoring/list` URLs, a project's old `listMonitoring`, the invoice modal).
