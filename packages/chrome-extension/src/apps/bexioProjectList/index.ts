import renderHtml from "./renderHtml";
import renderDateSortToggle from "./renderDateSortToggle";
import convertPopover from "../../utils/convertPopover";
import { autoSortByDate, preferDescendingDateSort } from "../../utils/dateSort";
import { getPackageTasksPanel, getPackageTimesPanel } from "../../selectors/packageTabPanels";
import { getProjectTimesList } from "../../selectors/projectTimesList";
import { getTimeTrackingList } from "../../selectors/timeTrackingList";

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
 */
export async function initializeExtension() {
  renderHtml();
  renderDateSortToggle(); // after renderHtml(): both insert left of the primary action button
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

// We need to watch for changes in the table, if the table is reloaded, we need to reinitialize the extension
function observingTableModifications() {
  observerTimeTrackingPage();
  observerProjectPage();
  observerProjectWorkPackagePage();
  observeBillingPage();
}

initializeExtension();
observingTableModifications();
