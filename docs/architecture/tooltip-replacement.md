# Tooltip Replacement (Topic 4)

## Overview

The `bexioProjectList` content script replaces bexio's native popover-style tooltip icons
(`<i rel="popover" data-content="...">`) with inline readable text. The feature is toggled by
the `removePopoversSetting` flag (default `false`) and controlled via a "Text | Tooltip" toggle
injected into bexio's page title bar.

---

## Which bexio pages the content script matches

The `bexioProjectList` content script is injected on the four `office.bexio.com` paths listed in
the manifest's second `content_scripts` block, and its observers and UI injection then branch on
the page URL:

| Path prefix                            | Element observed                                  | Source function                                       |
| -------------------------------------- | ------------------------------------------------- | ----------------------------------------------------- |
| `/index.php/monitoring/list`           | `#monitoring_content`                             | `observerTimeTrackingPage()`                          |
| `/index.php/pr_project/listMonitoring` | `.listBlock` (first)                              | `observerProjectPage()`                               |
| `/index.php/pr_project/showPackage`    | the "Zeiten" tab panel (`getPackageTimesPanel()`) | `observerProjectWorkPackagePage()`                    |
| `/index.php/kb_invoice/show/id`        | `#jqDialog` (modal) → `.block.list` inside it     | `observeBillingPage()` → `observeBillingModalTable()` |

### `monitoring/list` — opened through bexio's sidebar

The manifest matches `monitoring/list` **and** `monitoring/list/*`. bexio's sidebar link "Zeiten"
does not open `/index.php/monitoring/list` but `/index.php/monitoring/list/resetListView/1`; the
server answers that URL directly (no redirect), and bexio then rewrites the address bar to
`/monitoring/list` through the History API. Chrome matches the two halves of the content-script
entry at different moments: `bexioProjectList.css` against the URL that was loaded, the script
(`document_idle`) against the rewritten one. With only the exact `monitoring/list` pattern the
script ran but the stylesheet did not, so the toggle showed no active option (both buttons white)
while the conversion itself worked. Checked on live bexio 2026-09-17: loading `/monitoring/list`
directly styled the active option, the sidebar URL did not. Pinned by `test/manifest.test.ts` and
the "opened through bexio's sidebar" test in `e2e/extension-behaviour.spec.ts`, which serves the
fixture at the sidebar URL and rewrites the address the same way.

### `pr_project/showPackage` — the "Zeiten" tab panel

A work package lists its time entries in the lower jQuery-UI tab widget (`#tabs.listBlock`,
tabs "Aufgaben" / "Zeiten"). jQuery UI gives each panel a generated id (`ui-id-N`, numbered in
initialisation order), so the id is not stable: the code observed a hard-coded `#ui-id-5` until
2026-09, when bexio's page had the panel at `#ui-id-4` and the conversion silently stopped
working there. `selectors/packageTimesPanel.ts` now resolves the panel through its tab link
(`a[href*='/pr_project/listMonitorings/']` → closest `<li>` → `aria-controls`); the ids exist
when the content script starts. Checked on the live page (2026-09-17): opening the tab and
sorting inside it both replace the panel's own children, so the shallow `childList` observer
on the panel sees every reload. Pinned in `test/apps/bexioProjectList.test.ts`, including a
case with a renumbered panel id.

### `kb_invoice/show/id` — the "Zeiten importieren" modal

The `observeBillingPage()` function and its inner `observeBillingModalTable()` handle the invoice
detail page where a modal lists tracked time entries that can be imported as invoice line items.
Original docs referred to this as "weitere Positionen → erfasste Zeit"; in current bexio the
navigation is **Verkauf → Rechnungen → \<invoice\> → Positionen → "Weitere Positionen" →
"Zeit/Leistung"**, which opens the `#jqDialog` modal titled "Zeiten importieren". `observeBillingPage`
watches `#jqDialog` itself (so we can re-attach when the modal opens), and `observeBillingModalTable`
then watches the `.block.list` wrapper inside it (so we re-convert when the user paginates/filters
within the modal). Fixture: `kb_invoice-show.html`. Note that the content script's class lookup is
`getElementsByClassName("list block")[0]` (with a space — a two-class match), which works regardless
of the actual class order; in the current capture the wrapper is `class="block list"`.

---

## Per-page MutationObserver setup and why it exists

`observingTableModifications()` (called once at module load) sets up a `MutationObserver` on the
page-specific container element for each matching path. Each observer is created via
`createObserverWithCallback(convertPopover)` and configured with
`{ attributes: false, childList: true, subtree: false }`.

**Why observers are needed:** bexio re-renders its monitoring/project tables in place via its own
AJAX pagination and filtering — the initial `convertPopover()` call covers the first render, but
subsequent table updates replace `childList` children of the container. The observer fires once
per mutation batch (checking `mutation.type === "childList"`) and calls `convertPopover()` again
to re-apply the conversion on the fresh rows.

---

## The convert/revert cycle

### Setting gate (`removePopoversSetting`, default `false`)

`convertPopover()` reads `chromeStorageSettings.loadRemovePopoversSetting()` at call time (not
at import time). When the setting is `false` (the default), `convertPopover()` immediately
delegates to `revertPopover()` instead.

### Convert path

When `removePopoversSetting` is `true`:

1. `getPopoverNodes()` queries `document.querySelectorAll("i[rel='popover']")`.
2. Filters to only **visible** nodes (`style.display !== "none"`) — this is the idempotency
   guard: a second call on an already-converted table sees no visible popovers and skips.
3. For each visible popover node (`convertPopoverToText()`):
   - Sets `popoverNode.style.display = "none"` (hides the icon).
   - Creates a `<div class="new-popover-text">`.
   - Reads the raw text from `getPopoverNodeText(node)` → `node.getAttribute("data-content")`.
   - Sanitises with `DOMPurify.sanitize(popoverText)` to prevent XSS from bexio's own content.
   - Sets that sanitised HTML as `tempDiv.innerHTML` and then reads `tempDiv.textContent` to
     decode HTML entities (e.g. `&amp;` → `&`).
   - Appends the `<div class="new-popover-text">` to the node's `parentElement`.
   - Sets `parentElement.style.backgroundColor` alternating between `#ffe2bc` (even index) and
     `antiquewhite` (odd index) for visual banding.

### Revert path

`revertPopover()` (also called by `convertPopover()` when the setting is off) iterates all
`i[rel='popover']` nodes (visible or hidden) and:

- Sets `popoverNode.style.display = "inline-block"` (restores the icon).
- Removes the sibling `.new-popover-text` div if present.
- Clears `parentElement.style.backgroundColor`.

---

## DOMPurify sanitisation and entity decoding

The code uses `DOMPurify` to sanitise the `data-content` attribute value before injecting it.
This guards against cases where bexio itself might include HTML in the popover content that could
be malicious if rendered. After sanitisation the HTML string is decoded to plain text via a
temporary `<div>` element:

```ts
const tempDiv = document.createElement("div");
tempDiv.innerHTML = DOMPurify.sanitize(popoverText);
cellTextContent.textContent = tempDiv.textContent;
```

This means the final `.new-popover-text` content is always **plain text**, never raw HTML.

---

## Alternating row colours

Even-indexed (0, 2, 4, …) popover rows get `background-color: #ffe2bc`; odd-indexed rows get
`antiquewhite`. Indexing is over the visible popover nodes at the time of conversion, not over
all table rows — so if some rows lack popovers the colour pattern may differ from a strict
even/odd row banding. jsdom serialises `#ffe2bc` as `rgb(255, 226, 188)` and `antiquewhite` as
`antiquewhite` (named colour preserved).

---

## The "Text | Tooltip" toggle

`renderHtml.ts` injects the toggle **once per page load** (guarded by checking for
`document.getElementById("PopoverTextSwitcher")`, and inserted before its first `await`, so two
overlapping calls cannot both pass that guard):

- **Markup:** bexio's own Bootstrap 2 segmented control —
  `<div id="PopoverTextSwitcher" class="btn-group" role="group">` with two
  `<button type="button" class="btn" data-mode="text|tooltip">`, each with a `halflings` icon
  (`halflings-align-left` / `halflings-info-sign`, the icon bexio uses for the tooltips).
- **State:** the option matching `removePopoversSetting` has `aria-pressed="true"` (`text` when
  the setting is `true`), the other one `"false"`. `public/bexioProjectList.css` (declared for
  this content script in `manifest.json`) paints the pressed option in bexio's link blue
  (`#00acf0`); everything else is bexio's `.btn` styling.
- **Placement:** in the page title bar (`.bx-breadcrumb-container .bx-card-title`), wrapped in
  bexio's `div.bx-flex-block.bx-shrink.bx-flex-align-middle-left` and inserted directly before
  the block that holds the page's primary action `a.js-first-btn` ("Neue Zeiterfassung",
  "Neues Projekt", "Neue Rechnung") — `selectors/pageTitleBar.ts`. The title bar is
  server-rendered on all four pages, so it exists when the content script starts.
- **Click handler:** a click on the non-pressed option updates `aria-pressed`, stores the new
  `removePopoversSetting`, and calls `convertPopover()`. A click on the pressed option does nothing.
- **No title bar:** `renderHtml()` logs a `console.warn` and returns without a toggle; the
  conversion itself still runs with the stored setting.

**History.** Until 2026-09 the toggle was a single `button.btn.btn-info` ("👀 Text mode" /
"🙈 Popover mode", naming the current state) inserted after `.globalsearch` in bexio's top
navigation. bexio's sidebar layout keeps that navigation in the markup but hides it with
`.use-new-nav .lgcy-topbar-nav-office { display: none }` (`use-new-nav` sits on `<html>`), so the
button was still found by every test and invisible to every user. The e2e smoke test therefore
adds that rule to the fixture page and asserts the toggle is _visible_
(`BEXIO_HIDES_LEGACY_TOP_NAVIGATION` in `e2e/support.ts`). The new top bar and sidebar were ruled
out as places for the toggle: bexio's Angular app draws them in the browser (the server HTML has
empty `bexio-application-*-root` elements), so they are not guaranteed to exist when the content
script starts, and the bell next to the search is a third-party Chameleon widget positioned over
the bar.

---

## How to add coverage for a new page

1. Capture the page with the capture script in `test/fixtures/bexio/README.md`.
2. Add a job for it to `scripts/bexio-fixtures/build.ts` and run `npm run fixtures:build`,
   which writes `packages/chrome-extension/test/fixtures/bexio/<slug>.html` and its `.md`.
3. Read through the new fixture for names `anonymise.local.json` does not know yet.
4. Add a row to the fixture loop in
   `test/selectors/projectTable_TextCell.test.ts` ("works the same on…" test) and to
   `TOOLTIP_PAGES` in `test/apps/bexioProjectList.test.ts` (toggle placement).
5. If the page introduces a new observer target, add an `observer*` function in
   `src/apps/bexioProjectList/index.ts`, call it from `observingTableModifications()`, and
   add a test in `test/apps/bexioProjectList.test.ts` that stubs `location.pathname` to the
   new prefix and asserts the module imports cleanly.

---

## Known issues

- **The toggle is out of reach while the invoice modal is open:** on `kb_invoice/show/id` the
  tooltips being converted are inside the modal "Zeiten importieren", whose overlay covers the page
  title bar. Switch before opening the modal. (The legacy navigation had the same problem.)
- **`kb_invoice/show/id` modal table selector is class-order-dependent — but coincidentally works:**
  `observeBillingModalTable` uses `jqDialog.getElementsByClassName("list block")[0]` (with a space —
  a two-class match, not a compound `.list.block` selector). The current bexio markup wraps the
  table in `<div class="block list">` (block first), which still matches because
  `getElementsByClassName` is order-independent. Pinned by the `kb_invoice-show.html` fixture.
- **The tooltip fixtures are captured from pages the extension already changed:** the capture
  runs in a tab where the content script is active (bexio forbids framing the pages, so there is
  no clean copy to take). The capture script in `test/fixtures/bexio/README.md` undoes the
  extension's changes on a clone — `.new-popover-text` removed, the icons' `style` and the cells'
  background colour removed (bexio renders neither), the toggle removed — so
  `test/utils/convertPopover.test.ts` exercises the real first-render conversion path.
