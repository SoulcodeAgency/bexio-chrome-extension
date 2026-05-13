# Tooltip Replacement (Topic 4)

## Overview

The `bexioProjectList` content script replaces bexio's native popover-style tooltip icons
(`<i rel="popover" data-content="...">`) with inline readable text. The feature is toggled by
the `removePopoversSetting` flag (default `false`) and controlled via a "Text mode / Popover mode"
button injected into the page nav.

---

## Which bexio pages the content script matches

The `bexioProjectList` content script runs on every bexio page (`matches` is broadly scoped in
the manifest), but its observers and UI injection only activate when the page URL matches one of
these patterns:

| Path prefix | Element observed | Source function |
|---|---|---|
| `/index.php/monitoring/list` | `#monitoring_content` | `observerTimeTrackingPage()` |
| `/index.php/pr_project/listMonitoring` | `.listBlock` (first) | `observerProjectPage()` |
| `/index.php/pr_project/showPackage` | `#ui-id-5` | `observerProjectWorkPackagePage()` |
| `/index.php/kb_invoice/show/id` | `#jqDialog` (modal) → `.block.list` inside it | `observeBillingPage()` → `observeBillingModalTable()` |

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

## The "Text mode / Popover mode" toggle button

`renderHtml.ts` injects the toggle button **once per page load** (guarded by checking for
`document.getElementById("PopoverTextSwitcher")`):

- **Selector:** `#PopoverTextSwitcher`
- **Tag:** `<button type="button" id="PopoverTextSwitcher" class="btn btn-info">`
- **Label:** `"👀 Text mode"` when `removePopoversSetting` is `true`; `"🙈 Popover mode"` when `false`.
- **Placement:** inserted as a child of a `<li class="nav-item pull-right">` element, appended
  after `.globalsearch` (the bexio global-search nav item) via `insertAdjacentHTML("afterend", ...)`.
- **Click handler:** toggles `removePopoversSetting` in storage, updates the button label, and
  calls `convertPopover()` to immediately apply the new state.

**Fragility:** `renderHtml()` crashes at `globalSearchListElement.insertAdjacentHTML(...)`
with a `TypeError` if no `.globalsearch` element is present — the content script silently
assumes the full bexio nav bar is there. The `monitoring-list.html` fixture is captured
from `document.body.outerHTML` precisely so `.globalsearch` is included; the crash is itself
exercised as a negative test in `test/apps/bexioProjectList.test.ts` (we strip `.globalsearch`
from the fixture and assert the unhandled rejection surfaces). The Playwright extension-smoke
test (`e2e/extension-smoke.spec.ts`) covers the success path against the same fixture.

---

## How to add coverage for a new page

1. Capture the bexio page HTML (`copy(document.documentElement.outerHTML)` in DevTools).
2. Anonymise and trim it following the conventions in `test/fixtures/bexio/README.md`.
3. Save it as `packages/chrome-extension/test/fixtures/bexio/<slug>.html`.
4. Add a row to the fixture loop in
   `test/selectors/projectTable_TextCell.test.ts` ("works the same on…" test).
5. If the page introduces a new observer target, add an `observer*` function in
   `src/apps/bexioProjectList/index.ts`, call it from `observingTableModifications()`, and
   add a test in `test/apps/bexioProjectList.test.ts` that stubs `location.pathname` to the
   new prefix and asserts the module imports cleanly.

---

## Known issues

- **`renderHtml` crashes without `.globalsearch` in DOM:** `TypeError: Cannot read properties of
  undefined (reading 'insertAdjacentHTML')` — the content script silently assumes the full bexio
  nav bar is present. The `monitoring-list.html` fixture includes it, so the happy path is
  covered, but a future bexio redesign that drops/renames `.globalsearch` will break this code.
  Both the success path and the negative path are pinned in `test/apps/bexioProjectList.test.ts`.
- **`kb_invoice/show/id` modal table selector is class-order-dependent — but coincidentally works:**
  `observeBillingModalTable` uses `jqDialog.getElementsByClassName("list block")[0]` (with a space —
  a two-class match, not a compound `.list.block` selector). The current bexio markup wraps the
  table in `<div class="block list">` (block first), which still matches because
  `getElementsByClassName` is order-independent. Pinned by the `kb_invoice-show.html` fixture.
- **`monitoring-list.html` was captured post-conversion:** the raw capture was taken while the
  extension was active in Text mode (popovers hidden, `.new-popover-text` divs already injected,
  extension-set `<td>` background-colors present). The committed fixture was **decontaminated**
  back to the pristine pre-conversion bexio state (divs removed, `<i>`s un-hidden, backgrounds
  cleared) so `test/utils/convertPopover.test.ts` exercises the real first-render conversion path.
  See `packages/chrome-extension/test/fixtures/bexio/_raw/__build-fixtures.cjs` (git-ignored) for
  exactly how the fixtures were produced.
