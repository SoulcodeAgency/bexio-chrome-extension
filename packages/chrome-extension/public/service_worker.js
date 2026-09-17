const BEXIO_MONITORING_TIMETRACKING = "https://office.bexio.com/index.php/monitoring/edit";
const BEXIO_MONITORING_LIST = "https://office.bexio.com/index.php/monitoring/list";
const BEXIO_MONITORING_SIDEBAR = "https://office.bexio.com/index.php/monitoring";
const SIDE_PANEL_PATH = "/sidePanel-import/index.html";

// Clicking extension icon will open the browser on the bexio time tracking page
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({ url: BEXIO_MONITORING_TIMETRACKING });
});

// Allows users to open the side panel by clicking on the action toolbar icon
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));

// Enables the side panel for a tab on a bexio monitoring page, disables it
// everywhere else. The extension holds no broad "tabs" permission, only a host
// permission for office.bexio.com. Chrome therefore populates `tab.url` for
// bexio tabs only — for every other tab it is `undefined`. A missing url
// consequently means "not a bexio tab", which must disable the side panel
// rather than bail out.
async function configureSidePanel(tabId, url) {
  if (url && url.startsWith(BEXIO_MONITORING_SIDEBAR)) {
    await chrome.sidePanel.setOptions({
      tabId,
      path: SIDE_PANEL_PATH,
      enabled: true,
    });
  } else {
    // Disables the side panel on all other sites
    await chrome.sidePanel.setOptions({
      tabId,
      enabled: false,
    });
  }
}

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  await configureSidePanel(tabId, tab.url);
});

// `onUpdated` only fires when a tab navigates. A bexio monitoring tab that is
// already open when the extension is installed, loaded unpacked, reloaded or
// when the browser starts would therefore never get its side panel enabled —
// clicking the toolbar icon then does nothing useful. Sweep the existing tabs.
// The url filter is a match pattern; it only matches tabs the extension has
// host access to, which is exactly the bexio tabs we care about.
async function enableSidePanelOnOpenMonitoringTabs() {
  const tabs = await chrome.tabs.query({ url: `${BEXIO_MONITORING_SIDEBAR}*` });
  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    await configureSidePanel(tab.id, tab.url);
  }
}

chrome.runtime.onInstalled.addListener(enableSidePanelOnOpenMonitoringTabs);
chrome.runtime.onStartup.addListener(enableSidePanelOnOpenMonitoringTabs);
