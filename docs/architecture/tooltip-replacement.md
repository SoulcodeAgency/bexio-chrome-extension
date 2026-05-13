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
| `/index.php/kb_invoice/show/id` | `#jqDialog` (modal) | `observeBillingPage()` **[deferred / unverified]** |

### Deferred: `kb_invoice/show/id`

The `observeBillingPage()` function and its inner `observeBillingModalTable()` were written to
handle invoice detail pages where additional time entries are shown in a modal. **This branch is
unverified against the current bexio application.** The "weitere Positionen → erfasste Zeit"
navigation path that was the original entry point appears to have changed in current bexio; the
`#jqDialog` modal may no longer appear, or its structure may differ. No fixture was captured for
this path. A follow-up task should verify whether the path still exists and, if so, capture a
fixture.

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

**Important limitation (KNOWN ISSUE):** `renderHtml()` crashes at
`globalSearchListElement.insertAdjacentHTML(...)` with a `TypeError` if no `.globalsearch` element
is present in the DOM. The available test fixtures do not include the full bexio nav bar, so the
button cannot be injected in unit tests. The crash is an unhandled async rejection (because
`initializeExtension()` is called without `await` at module level) and is suppressed in
`test/apps/bexioProjectList.test.ts` by mocking `renderHtml`.

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
  undefined (reading 'insertAdjacentHTML')` — the content script assumes a full bexio page
  layout with the standard nav bar. Logged in `test/apps/bexioProjectList.test.ts`.
- **`kb_invoice/show/id` branch unverified:** `observeBillingPage()` and
  `observeBillingModalTable()` target `#jqDialog` and `.list.block` inside it. The path in
  current bexio is unconfirmed; the `observeBillingModalTable` function references
  `jqDialog.getElementsByClassName("list block")[0]` (note the space — this is a two-class
  selector, not a compound class) which may not match the actual element structure.
- **`monitoring-list.html` was captured post-conversion:** the raw capture was taken while the
  extension was active in Text mode (popovers hidden, `.new-popover-text` divs already injected,
  extension-set `<td>` background-colors present). The committed fixture was **decontaminated**
  back to the pristine pre-conversion bexio state (divs removed, `<i>`s un-hidden, backgrounds
  cleared) so `test/utils/convertPopover.test.ts` exercises the real first-render conversion path.
  See `packages/chrome-extension/test/fixtures/bexio/_raw/__build-fixtures.cjs` (git-ignored) for
  exactly how the fixtures were produced.
