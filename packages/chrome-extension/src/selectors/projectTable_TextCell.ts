export const getPopoverNodes = () =>
  document.querySelectorAll<HTMLElement>("i[rel='popover']");
export const getPopoverNodeText = (node: Element) =>
  node.getAttribute("data-content");
