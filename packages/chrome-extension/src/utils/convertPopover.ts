import { chromeStorageSettings } from "@bexio-chrome-extension/shared";
import { getPopoverNodes, getPopoverNodeText } from "../selectors/projectTable_TextCell";
import DOMPurify from 'dompurify';

/**
 * Main entry point for the tooltip-replacement feature. Reads `removePopoversSetting`
 * from storage at call time and either converts or reverts all popover icons.
 *
 * **Setting gate:** when `removePopoversSetting` is `false` (the default), this
 * function delegates immediately to `revertPopover()` so the page is restored to
 * its native popover-icon state.
 *
 * **Idempotency:** when the setting is `true`, only *visible* popover nodes
 * (`style.display !== "none"`) are processed. A second call on an already-converted
 * table finds no visible nodes and exits early — preventing double-injection of
 * `.new-popover-text` elements. This is important because bexio's MutationObserver
 * integration calls `convertPopover()` on every table re-render.
 *
 * **Sanitise + decode flow:** each node's `data-content` value is sanitised via
 * `DOMPurify.sanitize()` and then decoded to plain text via a temporary `<div>`
 * element, so the final `.new-popover-text` content is always plain text.
 */
export default async function convertPopover() {
  // Check if we should convert the popovers or revert them
  const isRemovePopoversSettingEnabled = await chromeStorageSettings.loadRemovePopoversSetting();
  if (!isRemovePopoversSettingEnabled) {
    return revertPopover();
  }

  // Check for popover nodes which are still visible
  // In case the convertPopover function is called multiple times, we should not apply the conversion multiple times
  const popoverNodes = getPopoverNodes();
  const visiblePopoverNodes = Array.from(popoverNodes).filter((popoverNode) => popoverNode.style.display !== "none");
  console.log("[bexio extension] Visible popover nodes found: ", visiblePopoverNodes.length);
  if (visiblePopoverNodes.length > 0) {
    // Do something with the visible popover nodes
    convertPopoverToText(visiblePopoverNodes);
  } else {
    console.log("[bexio extension] No visible popover nodes found");
  }
}

// Takes an array rather than a NodeList: the only caller passes the `.filter`ed
// result of Array.from(getPopoverNodes()).
export async function convertPopoverToText(popoverNodes: HTMLElement[]) {
  // iterate over the rows, replacing the text cell content with the data-content attribute
  popoverNodes.forEach((popoverNode, index) => {
    const popoverText = getPopoverNodeText(popoverNode);
    const popoverParent = popoverNode.parentElement as HTMLElement;

    // Hide the cells i-child element
    popoverNode.style.display = "none";

    const cellTextContent = document.createElement("div");
    cellTextContent.className = "new-popover-text";

    // Set the innerHTML to the popoverText to convert the html entities to text (&amp; -> & etc.)
    const tempDiv = document.createElement("div");
    // getPopoverNodeText returns null when the icon has no data-content attribute.
    // `?? ""` is behaviour-preserving here, not a fix: DOMPurify.sanitize(null) and
    // DOMPurify.sanitize("") both return "" (verified against the pinned version).
    tempDiv.innerHTML = DOMPurify.sanitize(popoverText ?? "");
    cellTextContent.textContent = tempDiv.textContent;

    popoverParent.appendChild(cellTextContent);
    popoverParent.style.backgroundColor = index % 2 === 0 ? "#ffe2bc" : "antiquewhite";
  });
}

/**
 * Reverts all popover icons to their original state: removes `.new-popover-text`
 * siblings, restores `display: inline-block` on each `<i rel="popover">`, and
 * clears the alternating background colours from their parent elements.
 *
 * Called automatically by `convertPopover()` when `removePopoversSetting` is `false`.
 * Also exported for direct use by the "Text mode" toggle button click handler.
 */
export async function revertPopover() {
  // iterate over the rows, replacing the text cell content with the data-content attribute
  getPopoverNodes().forEach((popoverNode, index) => {
    const popoverParent = popoverNode.parentElement as HTMLElement;

    // Hide the cells i-child element
    popoverNode.style.display = "inline-block";

    // Remove the new-popover-text element
    const cellTextContent = popoverParent.querySelector(".new-popover-text");
    cellTextContent && cellTextContent.remove();

    // remove the background color on the parent element
    popoverParent.style.backgroundColor = "";
  });
}
