const BEXIO_MONITORING_TIMETRACKING =
  "https://office.bexio.com/index.php/monitoring/edit";
const BEXIO_MONITORING_LIST =
  "https://office.bexio.com/index.php/monitoring/list";
const BEXIO_MONITORING_SIDEBAR =
  "https://office.bexio.com/index.php/monitoring";

// Clicking extension icon will open the browser on the bexio time tracking page
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({ url: BEXIO_MONITORING_TIMETRACKING });
});

// // Allows users to open the side panel by clicking on the action toolbar icon
// chrome.sidePanel
//     .setPanelBehavior({ openPanelOnActionClick: true })
//     .catch((error) => console.error(error));

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!tab.url) return;
  if (tab.url.startsWith(BEXIO_MONITORING_SIDEBAR)) {
    await chrome.sidePanel.setOptions({
      tabId,
      path: "/sidePanel-import/index.html",
      enabled: true,
    });
  } else {
    // Disables the side panel on all other sites
    await chrome.sidePanel.setOptions({
      tabId,
      enabled: false,
    });
  }
});
