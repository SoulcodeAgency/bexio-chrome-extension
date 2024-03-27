import {
  getPopoverNodes,
  getPopoverNodeText,
} from "../selectors/projectTable_TextCell";

export default async function convertPopover(toText: boolean) {
  if (toText) {
    return convertPopoverToText();
  }
  return revertPopover();
}

export async function convertPopoverToText() {
  // iterate over the rows, replacing the text cell content with the data-content attribute
  getPopoverNodes().forEach((popoverNode, index) => {
    const popoverText = getPopoverNodeText(popoverNode);
    const popoverParent = popoverNode.parentElement as HTMLElement;

    // Hide the cells i-child element
    popoverNode.style.display = "none";

    const cellTextContent = document.createElement("div");
    cellTextContent.className = "new-popover-text";
    cellTextContent.textContent = popoverText;

    popoverParent.appendChild(cellTextContent);
    popoverParent.style.backgroundColor =
      index % 2 === 0 ? "#ffe2bc" : "antiquewhite";
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
