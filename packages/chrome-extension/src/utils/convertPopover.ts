import { chromeStorageSettings } from "@bexio-chrome-extension/shared";
import { getPopoverNodes, getPopoverNodeText } from "../selectors/projectTable_TextCell";

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

export async function convertPopoverToText(popoverNodes) {
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
    tempDiv.innerHTML = popoverText;
    cellTextContent.textContent = tempDiv.textContent;

    popoverParent.appendChild(cellTextContent);
    popoverParent.style.backgroundColor = index % 2 === 0 ? "#ffe2bc" : "antiquewhite";
  });
}

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
