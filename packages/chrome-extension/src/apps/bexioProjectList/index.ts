import { chromeStorageSettings } from "@bexio-chrome-extension/shared";
import renderHtml from "./renderHtml";
import convertPopover from "../../utils/convertPopover";

export async function initializeExtension() {
  renderHtml();
  const isRemovePopoversSettingEnabled =
    await chromeStorageSettings.loadRemovePopoversSetting();
  convertPopover(isRemovePopoversSettingEnabled);
}

// We need to watch for changes in the table, if the table is reloaded, we need to reinitialize the extension
function observingTableModifications() {
  // Options for the observer (which mutations to observe)
  var config = { attributes: false, childList: true, subtree: false };
  // Callback function to execute when mutations are observed
  var callback = function (mutationsList, observer) {
    for (let mutation of mutationsList) {
      if (mutation.type === "childList") {
        (window as any).initializeExtension();
      }
    }
  };
  // Create an observer instance linked to the callback function
  var observer = new MutationObserver(callback);

  // Select the node that will be observed for mutations
  // time bookings
  var monitoring_List_TargetNode =
    document.getElementById("monitoring_content");
  var prProject_ListMonitoring_TargetNode =
    document.getElementsByClassName("listBlock")[0];

  // Start observing the target node for configured mutations
  monitoring_List_TargetNode &&
    observer.observe(monitoring_List_TargetNode, config);
  prProject_ListMonitoring_TargetNode &&
    observer.observe(prProject_ListMonitoring_TargetNode, config);
}

// Add the initializeExtension function to the window object
(window as any).initializeExtension = initializeExtension;

initializeExtension();
observingTableModifications();
