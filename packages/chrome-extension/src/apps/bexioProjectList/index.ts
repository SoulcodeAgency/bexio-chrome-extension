import renderHtml from "./renderHtml";
import convertPopover from "../../utils/convertPopover";

const observerOptions = { attributes: false, childList: true, subtree: false };

/**
 * Bootstraps the extension on the current page: injects the "Text mode" toggle
 * button via `renderHtml()` and performs the initial popover conversion via
 * `convertPopover()`.
 *
 * Both calls are fire-and-forget (not awaited) because this function is invoked at
 * module-evaluation time, where top-level `await` is not available. Any errors in
 * `renderHtml()` (e.g. missing `.globalsearch` nav element) will surface as
 * unhandled promise rejections.
 */
export async function initializeExtension() {
  renderHtml();
  convertPopover(); // convert already for the initial load
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
    const monitoring_List_TargetNode = document.getElementById("monitoring_content");
    if (monitoring_List_TargetNode) {
      createObserverWithCallback(convertPopover).observe(monitoring_List_TargetNode, observerOptions);
    }
  }
}

function observerProjectPage() {
  // Project view
  if (location.pathname.startsWith("/index.php/pr_project/listMonitoring")) {
    const prProject_listMonitoring_TargetNode = document.getElementsByClassName("listBlock")[0];
    if (prProject_listMonitoring_TargetNode) {
      createObserverWithCallback(convertPopover).observe(prProject_listMonitoring_TargetNode, observerOptions);
    }
  }
}

function observerProjectWorkPackagePage() {
  // Project view
  if (location.pathname.startsWith("/index.php/pr_project/showPackage")) {
    const prProject_listMonitoring_TargetNode = document.getElementById("ui-id-5");
    if (prProject_listMonitoring_TargetNode) {
      createObserverWithCallback(convertPopover).observe(prProject_listMonitoring_TargetNode, observerOptions);
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
  // at least once. (The kb_invoice/show branch is flagged as unverified in
  // docs/architecture/tooltip-replacement.md.)
  const jqDialog = document.getElementById("jqDialog")!;
  const modalTable = jqDialog.getElementsByClassName("list block")[0];
  createObserverWithCallback(convertPopover).observe(modalTable, observerOptions);
  convertPopover(); // Convert the initial modal
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
