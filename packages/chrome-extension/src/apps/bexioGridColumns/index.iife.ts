/**
 * MAIN-world content script (manifest `"world": "MAIN"`) for bexio's new time tracking grids
 * (#168): widens the remarks column while the "Text" mode is on. Built by crxjs as a
 * self-contained IIFE (the `.iife.ts` name) because its usual loader needs `chrome.runtime`, which
 * the MAIN world does not have. See `gridColumns.ts`.
 *
 * Finds grids as they render (a `MutationObserver`, at most one pass per animation frame), follows
 * the mode attribute the isolated-world script sets on `<html>`, and re-applies on ag-grid's
 * column events. Where the API is not found, nothing happens and the remarks stay in bexio's 88px
 * column.
 */
import { REMARKS_MODE_ATTRIBUTE } from "../../selectors/timeTrackingGrid";
import { getGridApi, syncGrid } from "./gridColumns";

type Grid = Parameters<typeof syncGrid>[0];

const grids = new Map<Element, Grid>();
const mode = () => document.documentElement.getAttribute(REMARKS_MODE_ATTRIBUTE);

function findGrids() {
  for (const root of document.querySelectorAll("ag-grid-angular .ag-root-wrapper")) {
    if (grids.has(root)) continue;
    const api = getGridApi(root);
    if (!api) continue;
    const grid: Grid = { api, originals: undefined, applying: false };
    grids.set(root, grid);
    for (const event of ["gridColumnsChanged", "displayedColumnsChanged"]) {
      api.addEventListener(event, () => syncGrid(grid, mode()));
    }
    syncGrid(grid, mode());
  }
  for (const root of grids.keys()) {
    if (!root.isConnected) grids.delete(root);
  }
}

function syncAll() {
  for (const grid of grids.values()) syncGrid(grid, mode());
}

let scheduled = false;
new MutationObserver(() => {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    findGrids();
  });
}).observe(document.body, { childList: true, subtree: true });

new MutationObserver(syncAll).observe(document.documentElement, {
  attributes: true,
  attributeFilter: [REMARKS_MODE_ATTRIBUTE],
});

findGrids();
