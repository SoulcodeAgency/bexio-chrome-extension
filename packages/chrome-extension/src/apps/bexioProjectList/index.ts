import { chromeStorageSettings } from "@bexio-chrome-extension/shared";
import renderHtml from "./renderHtml";
import convertPopover from "../../utils/convertPopover";

export async function initializeExtension() {
  renderHtml();
  const isRemovePopoversSettingEnabled =
    await chromeStorageSettings.loadRemovePopoversSetting();
  convertPopover(isRemovePopoversSettingEnabled);
}

const observerOptions = { attributes: false, childList: true, subtree: false };

// Options for the observer (which mutations to observe)
// Callback function to execute when mutations are observed
var callback = function (mutationsList, observer) {
  for (let mutation of mutationsList) {
    if (mutation.type === "childList") {
      (window as any).initializeExtension();
    }
  }
};
// Create an observer instance linked to the callback function
var initExtensionObserver = new MutationObserver(callback);

// We need to watch for changes in the table, if the table is reloaded, we need to reinitialize the extension
function observingTableModifications() {
  observerTimeTrackingPage();
  observerProjectPage();
  observeBillingPage();
}

function observerTimeTrackingPage() {
  // Start observing the target node for configured mutations
  // Select the node that will be observed for mutations
  // Time tracking view
  if (location.pathname.startsWith("/index.php/monitoring/list")) {
    var monitoring_List_TargetNode =
      document.getElementById("monitoring_content");
    monitoring_List_TargetNode &&
      initExtensionObserver.observe(
        monitoring_List_TargetNode,
        observerOptions
      );
  }
}

function observerProjectPage() {
  // Project view
  if (location.pathname.startsWith("/index.php/pr_project/listMonitoring")) {
    var prProject_listMonitoring_TargetNode =
      document.getElementsByClassName("listBlock")[0];
    prProject_listMonitoring_TargetNode &&
      initExtensionObserver.observe(
        prProject_listMonitoring_TargetNode,
        observerOptions
      );
  }
}

function observeBillingPage() {
  if (!location.pathname.startsWith("/index.php/kb_invoice/show/id")) {
    return;
  }

  var callback = function (mutationsList, observer) {
    // Only execute the callback ONCE if we detect changes in the jqDialog
    let jqDialogChanged = false;
    for (let mutation of mutationsList) {
      if (mutation.type === "childList") {
        jqDialogChanged = true;
      }
    }
    if (jqDialogChanged) {
      observeBillingPageModal();
    }
  };
  // Create an observer instance linked to the callback function
  var dialogObserver = new MutationObserver(callback);
  const jqDialog = document.getElementById("jqDialog");
  dialogObserver.observe(jqDialog, observerOptions);
}

function observeBillingPageModal() {
  console.log("observing billing page modal");
  // var callback = function (mutationsList, observer) {
  //   for (let mutation of mutationsList) {
  //     if (mutation.type === "childList") {
  //       (window as any).initializeExtension();
  //     }
  //   }
  // };
  // Create an observer instance linked to the callback function
  // var observer = new MutationObserver(callback);
  const jqDialog = document.getElementById("jqDialog");
  var tableListWithinPopup = jqDialog.getElementsByClassName("list block")[0];
  initExtensionObserver.observe(tableListWithinPopup, observerOptions);
}

// Add the initializeExtension function to the window object
(window as any).initializeExtension = initializeExtension;

initializeExtension();
observingTableModifications();
