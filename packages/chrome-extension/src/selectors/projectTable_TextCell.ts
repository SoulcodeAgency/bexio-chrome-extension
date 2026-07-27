/**
 * Returns all `<i rel="popover">` tooltip-icon elements currently in the document.
 *
 * This query runs **at call time** against the live `document`, so it reflects
 * whatever rows are present when called (e.g. after bexio's AJAX re-renders the
 * table). The caller (typically `convertPopover`) is responsible for calling this
 * after the target table has been populated.
 *
 * @returns A `NodeListOf<HTMLElement>` matching `i[rel='popover']`.
 */
export const getPopoverNodes = () =>
  document.querySelectorAll<HTMLElement>("i[rel='popover']");

/**
 * Reads the raw `data-content` attribute from a popover icon element.
 *
 * The returned string is the attribute value as stored in the DOM — HTML entities
 * (e.g. `&amp;`) are already decoded by the browser/jsdom parser, so the value
 * may contain `&`, `<`, etc. as literal characters. Callers that inject this text
 * as HTML must sanitise it first (e.g. via DOMPurify); callers that set
 * `.textContent` directly are already safe.
 *
 * @param node - The `<i rel="popover">` element to read.
 * @returns The decoded `data-content` string, or `null` if the attribute is absent.
 */
export const getPopoverNodeText = (node: Element) =>
  node.getAttribute("data-content");
