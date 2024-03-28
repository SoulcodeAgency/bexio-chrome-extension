import { chromeStorageSettings } from "@bexio-chrome-extension/shared";
import renderHtml from "./renderHtml";
import convertPopover from "../../utils/convertPopover";

const observerOptions = { attributes: false, childList: true, subtree: false };

export async function initializeExtension() {
  renderHtml();
  convertPopover(); // convert already for the initial load
}

// Create an observer instance, executing a callback when changes are detected
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
  const jqDialog = document.getElementById("jqDialog");
  const modalTable = jqDialog.getElementsByClassName("list block")[0];
  createObserverWithCallback(convertPopover).observe(modalTable, observerOptions);
}

// We need to watch for changes in the table, if the table is reloaded, we need to reinitialize the extension
function observingTableModifications() {
  observerTimeTrackingPage();
  observerProjectPage();
  observeBillingPage();
}

initializeExtension();
observingTableModifications();
