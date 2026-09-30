/**
 * bexio's new time tracking grids (#168): an ag-grid on `/index.php/time-tracking`, on a project's
 * "Zeiten" tab (`pr_project/listTimeTrackingSpa/…`) and on a work package's time tracking tab
 * (`#tab-time-tracking` on `pr_project/showPackage/…`).
 *
 * The remarks column renders an icon per row whose `aria-label` holds the **full** remark (plain
 * text, line breaks as `\n`) — that is what the tooltip shows and what the "Text" mode prints.
 * Everything here is looked up at call time: ag-grid renders rows lazily and recycles them.
 */

/** The page paths that show only the new grids (a work package page shows old and new). */
const NEW_GRID_PATH_PREFIXES = [
  "/index.php/time-tracking",
  "/index.php/pr_project/show/id/",
  "/index.php/pr_project/listTimeTrackingSpa/",
];

/** `true` on a page whose time entries are listed by the new grid only. */
export const isNewGridPage = () => NEW_GRID_PATH_PREFIXES.some((prefix) => location.pathname.startsWith(prefix));

/** `true` on a page that may show a new grid — including a work package page. */
export const mayShowNewGrid = () =>
  isNewGridPage() || location.pathname.startsWith("/index.php/pr_project/showPackage/");

export const REMARKS_RENDERER_SELECTOR = "bexio-time-entry-remarks-cell-renderer";

/** The remark icons currently rendered, one per visible row that has a remark. */
export const getGridRemarkIcons = (root: ParentNode = document) =>
  Array.from(root.querySelectorAll<HTMLElement>(`${REMARKS_RENDERER_SELECTOR} fa-icon[aria-label]`));

/** The grid's "Spalten" (columns) button, next to which the "Text | Tooltip" toggle goes. */
export const getGridColumnsButton = (): HTMLElement | null =>
  Array.from(document.querySelectorAll<HTMLElement>("button")).find(
    (button) => button.textContent?.replace(/\s+/g, " ").trim() === "Spalten",
  ) ?? null;

/**
 * The attribute on `<html>` through which the isolated-world content script tells the MAIN-world
 * grid script (`apps/bexioGridColumns/index.iife.ts`) which remarks mode is active: `"text"` widens
 * the remarks column, anything else restores bexio's widths. The two worlds share the DOM, not JS.
 */
export const REMARKS_MODE_ATTRIBUTE = "data-soulcode-remarks";
