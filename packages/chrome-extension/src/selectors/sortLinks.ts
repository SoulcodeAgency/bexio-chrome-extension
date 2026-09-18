// bexio's column headers sort through links like
// `/index.php/filter/sort/f/MonitoringFilter/m/monitoring/a/list/v/monitoring.DATE/o/asc`:
// `f`, `m` and `a` name the list, `v` the column (`monitoring.DATE`, `task.FINISH_DATE`), `o` the
// direction the click sorts to.
const DATE_SORT_HREF = /\/filter\/sort\/.*\/v\/[^/]*DATE[^/]*\/o\/(asc|desc)$/;
const TIME_ENTRY_DATE_SORT_HREF = /\/filter\/sort\/.*\/v\/monitoring\.DATE\/o\/(asc|desc)$/;

const getSortLinks = (root: ParentNode, href: RegExp) =>
  Array.from(root.querySelectorAll<HTMLAnchorElement>("thead th a[href*='/filter/sort/']")).filter((link) =>
    href.test(link.getAttribute("href") ?? ""),
  );

/** Returns the sort links of all date columns below `root`, sorted or not. */
export const getDateSortLinks = (root: ParentNode = document) => getSortLinks(root, DATE_SORT_HREF);

/** Returns the sort links of the time entries' date column (`monitoring.DATE`) below `root`. */
export const getTimeEntryDateSortLinks = (root: ParentNode = document) => getSortLinks(root, TIME_ENTRY_DATE_SORT_HREF);

/** Names the list a sort link belongs to: the link without its direction. */
export const getListKey = (link: HTMLAnchorElement) => link.getAttribute("href")!.replace(/\/o\/(asc|desc)$/, "");

/** Returns the block bexio replaces as a whole on every sort, paging and filter change of a list. */
export const getListBlock = (link: HTMLAnchorElement) => link.closest(".lf_content") ?? link.closest("table")!;

/**
 * bexio marks the column a table is sorted by with a `span.caret` inside that column's link.
 * Scoped to the header on purpose: the rows carry carets of their own (action dropdowns).
 */
export const isSortedColumn = (link: HTMLAnchorElement) => link.querySelector("span.caret") !== null;

/** `true` when any column of the tables below `root` is the sorted one. */
export const hasSortedColumn = (root: ParentNode = document) => root.querySelector("thead th a span.caret") !== null;
