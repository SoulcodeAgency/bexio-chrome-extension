import { getTabsApi } from "~/utils/getTabsApi";

/** The old time entry form. Still served, but no longer linked from bexio's menu (#168). */
export const BEXIO_MONITORING_TIMETRACKING = "https://office.bexio.com/index.php/monitoring/edit";

/**
 * bexio's time tracking list since 2026-09 (#168). New entries are created in a modal on this page,
 * which the content script opens itself — so this is where the side panel navigates to.
 */
export const BEXIO_TIME_TRACKING = "https://office.bexio.com/index.php/time-tracking";

/**
 * The pages of the new UI that host the time entry modal, as URL prefixes — the same as the
 * `…*` patterns of the template content script in packages/chrome-extension/public/manifest.json.
 */
export const NEW_UI_TIME_TRACKING_URL_PREFIXES = [
  BEXIO_TIME_TRACKING,
  "https://office.bexio.com/index.php/pr_project/show/id/",
  "https://office.bexio.com/index.php/pr_project/listTimeTrackingSpa/",
  "https://office.bexio.com/index.php/pr_project/showPackage/",
];

/**
 * How long we wait for the tab to finish loading the time tracking page before
 * giving up. Generous enough for a slow bexio page load, short enough that a
 * session that redirected to the login page (or a user who navigated away)
 * fails visibly instead of leaving the caller waiting forever.
 */
export const NAVIGATION_TIMEOUT_MS = 15000;

/** Grace period after "complete" so bexio can finish rendering the form. */
const RENDER_SETTLE_MS = 500;

/** True for a page of bexio's new time tracking UI, where the content script opens the modal itself. */
export function isNewUiTimeTrackingUrl(url: string | undefined): boolean {
  if (!url) return false;
  return NEW_UI_TIME_TRACKING_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
}

/**
 * True for the URLs the template content script is registered on
 * (`content_scripts` in packages/chrome-extension/public/manifest.json):
 *   https://office.bexio.com/index.php/monitoring/edit
 *   https://office.bexio.com/index.php/monitoring/edit/id/*
 * plus the new UI's pages ({@link NEW_UI_TIME_TRACKING_URL_PREFIXES}).
 * Chrome ignores the fragment when matching, and the `/id/*` pattern also covers
 * any query string. Everything else (a login redirect, the monitoring list, ...)
 * must not count as "we are there" — the content script does not run there.
 */
export function isTimeTrackingPageUrl(url: string | undefined): boolean {
  if (!url) return false;
  const withoutFragment = url.split("#")[0];
  return (
    withoutFragment === BEXIO_MONITORING_TIMETRACKING ||
    withoutFragment.startsWith(`${BEXIO_MONITORING_TIMETRACKING}/id/`) ||
    isNewUiTimeTrackingUrl(withoutFragment)
  );
}

/**
 * Navigates the active tab to bexio's time tracking ({@link BEXIO_TIME_TRACKING}) and resolves once
 * that tab has loaded it. Rejects if there is no tab to navigate, if the
 * navigation itself fails, or if the page has not loaded within
 * NAVIGATION_TIMEOUT_MS. The `chrome.tabs.onUpdated` listener is removed on
 * every exit path.
 *
 * Resolves `false` when there is no `chrome.tabs` at all — the standalone Vite
 * dev server. That is not an error: there is simply no tab to navigate, and the
 * caller should carry on with whatever the click was for.
 */
async function openBexioTimeTrackingPage(): Promise<boolean> {
  const tabsApi = getTabsApi();
  if (!tabsApi) {
    console.log("no chrome.tabs — not running inside the extension, skipping navigation");
    return false;
  }

  const [tab] = await tabsApi.query({
    active: true,
    lastFocusedWindow: true,
  });

  // Only the plain edit URL counts as "already there" in the old UI: an `/edit/id/<id>` page
  // edits an *existing* time entry, so we still navigate to a fresh form. In the new UI every
  // page with the modal counts: the content script opens a fresh "Neue Zeiterfassung" itself and
  // refuses to apply an entry into an open "Zeiterfassung bearbeiten".
  if (tab?.url === BEXIO_MONITORING_TIMETRACKING || isNewUiTimeTrackingUrl(tab?.url)) {
    console.log("already on timetracking page");
    return true;
  }

  const tabId = tab?.id;
  if (tabId === undefined) {
    throw new Error("No tab found");
  }

  console.log("not on timetracking page, trying to open it...");
  await new Promise<void>((resolve, reject) => {
    // Attach the event listener first, so we cannot miss the load event.
    const onUpdated = (updatedTabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, updatedTab: chrome.tabs.Tab) => {
      if (updatedTabId !== tabId) return;
      if (changeInfo.status !== "complete") return;
      if (!isTimeTrackingPageUrl(updatedTab.url)) return;
      console.log("Tab has loaded completely");
      finish();
    };

    // Single exit point: whoever settles the promise goes through here, so the
    // listener and the timer can never be left behind.
    const finish = (error?: unknown) => {
      clearTimeout(timeoutId);
      tabsApi.onUpdated.removeListener(onUpdated);
      if (error) reject(error);
      else resolve();
    };

    const timeoutId = setTimeout(
      () => finish(new Error(`Timed out after ${NAVIGATION_TIMEOUT_MS}ms waiting for ${BEXIO_TIME_TRACKING}`)),
      NAVIGATION_TIMEOUT_MS,
    );

    tabsApi.onUpdated.addListener(onUpdated);
    // Open the page
    tabsApi.update(tabId, { url: BEXIO_TIME_TRACKING }).catch((error: unknown) => finish(error));
  });

  // Wait a little bit, so the rendering can be finished. (Not sure how easy we
  // could track this, maybe with a message and an other listener here)
  await new Promise((resolve) => setTimeout(resolve, RENDER_SETTLE_MS));
  return true;
}

export default openBexioTimeTrackingPage;
