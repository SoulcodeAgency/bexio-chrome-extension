// bexio's time tracking since 2026-09: the Angular list, where new entries are created in a modal.
// The menu's "Projekte → Zeiten" opens it.
const BEXIO_TIME_TRACKING = "https://office.bexio.com/index.php/time-tracking";
const SIDE_PANEL_PATH = "/sidePanel-import/index.html";

// The pages whose content script can fill a time entry, as URL prefixes. The old
// `monitoring/*` pages are still served (just no longer linked from the menu); the others host
// the new time entry modal. Keep in sync with the templates content script in manifest.json.
const SIDE_PANEL_URL_PREFIXES = [
  "https://office.bexio.com/index.php/monitoring",
  BEXIO_TIME_TRACKING,
  "https://office.bexio.com/index.php/pr_project/show/id/",
  "https://office.bexio.com/index.php/pr_project/listTimeTrackingSpa/",
  "https://office.bexio.com/index.php/pr_project/showPackage/",
];

// Clicking extension icon will open the browser on the bexio time tracking page
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({ url: BEXIO_TIME_TRACKING });
});

// Allows users to open the side panel by clicking on the action toolbar icon
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));

// Enables the side panel for a tab on a bexio time tracking page, disables it
// everywhere else. The extension holds no broad "tabs" permission, only a host
// permission for office.bexio.com. Chrome therefore populates `tab.url` for
// bexio tabs only — for every other tab it is `undefined`. A missing url
// consequently means "not a bexio tab", which must disable the side panel
// rather than bail out.
async function configureSidePanel(tabId, url) {
  if (url && SIDE_PANEL_URL_PREFIXES.some((prefix) => url.startsWith(prefix))) {
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
  const tabs = await chrome.tabs.query({ url: SIDE_PANEL_URL_PREFIXES.map((prefix) => `${prefix}*`) });
  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    await configureSidePanel(tab.id, tab.url);
  }
}

chrome.runtime.onInstalled.addListener(enableSidePanelOnOpenMonitoringTabs);
chrome.runtime.onStartup.addListener(enableSidePanelOnOpenMonitoringTabs);

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
