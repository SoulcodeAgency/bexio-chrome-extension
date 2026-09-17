const BEXIO_MONITORING_TIMETRACKING = "https://office.bexio.com/index.php/monitoring/edit";
const BEXIO_MONITORING_LIST = "https://office.bexio.com/index.php/monitoring/list";
const BEXIO_MONITORING_SIDEBAR = "https://office.bexio.com/index.php/monitoring";

// Clicking extension icon will open the browser on the bexio time tracking page
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({ url: BEXIO_MONITORING_TIMETRACKING });
});

// Allows users to open the side panel by clicking on the action toolbar icon
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  // The extension holds no broad "tabs" permission, only a host permission for
  // office.bexio.com. Chrome therefore populates `tab.url` for bexio tabs only —
  // for every other tab it is `undefined`. A missing url consequently means
  // "not a bexio tab", which must disable the side panel rather than bail out.
  if (tab.url && tab.url.startsWith(BEXIO_MONITORING_SIDEBAR)) {
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

// The injected Templates block has an "open side panel" button. Content scripts
// cannot call chrome.sidePanel, so they send this message and the worker opens the
// panel for the sender's tab. sidePanel.open() is only allowed in response to a user
// gesture, and that gesture does not survive an `await` — so nothing asynchronous
// may run before the call.
chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message || message.mode !== "openSidePanel") return;
  const tabId = sender.tab && sender.tab.id;
  if (tabId === undefined) return;
  chrome.sidePanel.open({ tabId }).catch((error) => console.error(error));
});
