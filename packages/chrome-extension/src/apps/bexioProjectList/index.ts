import renderHtml from "./renderHtml";
import renderDateSortToggle from "./renderDateSortToggle";
import convertPopover from "../../utils/convertPopover";
import { autoSortByDate, preferDescendingDateSort } from "../../utils/dateSort";
import { getPackageTasksPanel, getPackageTimesPanel } from "../../selectors/packageTabPanels";
import { getProjectTimesList } from "../../selectors/projectTimesList";
import { getTimeTrackingList } from "../../selectors/timeTrackingList";
import { isNewGridPage, mayShowNewGrid } from "../../selectors/timeTrackingGrid";
import convertGridRemarks from "../../utils/convertGridRemarks";
import { isExtensionContextValid } from "../../utils/extensionContext";
import renderGridNotesToggle from "./renderGridNotesToggle";

const observerOptions = { attributes: false, childList: true, subtree: false };

/**
 * Everything the extension does to a bexio table. Runs for the initial render and again from the
 * observers below, because bexio replaces the table on every sort, paging and filter change.
 */
function onTableRendered() {
  convertPopover();
  preferDescendingDateSort();
  autoSortByDate();
}

/**
 * Bootstraps the extension on the current page: injects the "Text | Tooltip" toggle via
 * `renderHtml()`, the "Newest first" toggle via `renderDateSortToggle()` and gives the tables
 * their initial treatment via `onTableRendered()`.
 *
 * The calls are fire-and-forget (not awaited) because this function is invoked at
 * module-evaluation time, where top-level `await` is not available. A page without
 * bexio's title bar gets no toggles (`renderHtml()` logs a warning); the tables are
 * still handled.
 *
 * Pages of bexio's new time tracking (#168) have none of the old tables and no title bar; their
 * grids are handled by `observeTimeTrackingGrids()`. "Newest first" is not offered where the time
 * entries are listed by a new grid (a work package page, too): those grids sort by date,
 * descending, on their own.
 */
export async function initializeExtension() {
  if (isNewGridPage()) return;
  renderHtml();
  if (!mayShowNewGrid()) {
    renderDateSortToggle(); // after renderHtml(): both insert left of the primary action button
  }
  onTableRendered(); // handle the initial load already
}

/**
 * Factory that wraps a callback in a `MutationObserver` configured for `childList`
 * mutations (shallow, no subtree). The observer fires the callback **at most once
 * per mutation batch**: it iterates `mutationsList`, sets a `changeDetected` flag
 * on the first matching record, and calls the callback only if the flag was set.
 *
 * This "once per batch" design prevents redundant `convertPopover()` invocations
 * when bexio replaces many children in a single DOM operation.
 *
 * @param callback - Function to invoke when a `childList` change is detected.
 * @param mutationType - The mutation type to watch for (defaults to `"childList"`).
 * @returns A `MutationObserver` instance (not yet connected — call `.observe()`).
 */
function createObserverWithCallback(callback: () => void, mutationType: MutationRecordType = "childList") {
  return new MutationObserver((mutationsList, observer) => {
    if (!isExtensionContextValid()) {
      observer.disconnect();
      return;
    }
    // Only execute the callback ONCE if we detect changes in the jqDialog
    let changeDetected = false;
    for (let mutation of mutationsList) {
      if (mutation.type === mutationType) {
        changeDetected = true;
      }
    }
    if (changeDetected) {
      callback();
    }
  });
}

function observerTimeTrackingPage() {
  // Time tracking view
  if (location.pathname.startsWith("/index.php/monitoring/list")) {
    // Create an observer which runs the extension code
    const monitoring_List_TargetNode = getTimeTrackingList();
    if (monitoring_List_TargetNode) {
      createObserverWithCallback(onTableRendered).observe(monitoring_List_TargetNode, observerOptions);
    }
  }
}

function observerProjectPage() {
  // Project view
  const prProject_listMonitoring_TargetNode = getProjectTimesList();
  if (prProject_listMonitoring_TargetNode) {
    createObserverWithCallback(onTableRendered).observe(prProject_listMonitoring_TargetNode, observerOptions);
  }
}

function observerProjectWorkPackagePage() {
  // Work package view: bexio (re)loads a tab panel's children on tab open, sort and paging. The
  // "Aufgaben" panel has no notes to convert, but a due date column, and is filled after we ran.
  if (location.pathname.startsWith("/index.php/pr_project/showPackage")) {
    for (const panel of [getPackageTimesPanel(), getPackageTasksPanel()]) {
      if (panel) {
        createObserverWithCallback(onTableRendered).observe(panel, observerOptions);
      }
    }
  }
}

function observeBillingPage() {
  if (location.pathname.startsWith("/index.php/kb_invoice/show/id")) {
    const jqDialog = document.getElementById("jqDialog");
    if (jqDialog) {
      createObserverWithCallback(observeBillingModalTable).observe(jqDialog, observerOptions);
    }
  }
}

function observeBillingModalTable() {
  console.log("[bexio extension] observing billing modal table");
  // Unguarded on purpose — unchanged from before. This callback only fires from the
  // observer that `observeBillingPage` attached to #jqDialog, so the element existed
  // at least once. (Checked on live bexio 2026-09-17: opening "Zeiten importieren"
  // converted all of the modal's tooltips.)
  const jqDialog = document.getElementById("jqDialog")!;
  const modalTable = jqDialog.getElementsByClassName("list block")[0];
  createObserverWithCallback(onTableRendered).observe(modalTable, observerOptions);
  onTableRendered(); // Handle the initial modal
}

/**
 * The new grids (#168) render after this script ran, render rows lazily and recycle them on scroll,
 * paging and filtering — including updating a recycled row's remark icon in place. So one observer
 * on the body (child lists and `aria-label`s) runs the grid pass, at most once per animation frame.
 * The pass also places the grid's own "Text | Tooltip" toggle once its "Spalten" button exists —
 * unless the page still has the old toggle in its title bar (a work package), which then drives
 * both.
 */
function observeTimeTrackingGrids() {
  if (!mayShowNewGrid()) return;
  let scheduled = false;
  const onGridRendered = () => {
    scheduled = false;
    void convertGridRemarks();
    if (!document.getElementById("PopoverTextSwitcher")) void renderGridNotesToggle();
  };
  new MutationObserver((_mutations, observer) => {
    if (!isExtensionContextValid()) {
      observer.disconnect();
      return;
    }
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(onGridRendered);
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-label"] });
  onGridRendered();
}

// We need to watch for changes in the table, if the table is reloaded, we need to reinitialize the extension
function observingTableModifications() {
  observeTimeTrackingGrids();
  observerTimeTrackingPage();
  observerProjectPage();
  observerProjectWorkPackagePage();
  observeBillingPage();
}

initializeExtension();
observingTableModifications();
