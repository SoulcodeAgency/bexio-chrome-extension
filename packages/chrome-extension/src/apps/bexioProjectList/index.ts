import renderHtml from "./renderHtml";

export async function initializeExtension() {
  renderHtml();
}

function observingTableModifications() {
  // Select the node that will be observed for mutations
  var targetNode = document.getElementById("monitoring_content");
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
  // Start observing the target node for configured mutations
  observer.observe(targetNode, config);
}

// Add the initializeExtension function to the window object
(window as any).initializeExtension = initializeExtension;

initializeExtension();
observingTableModifications();
