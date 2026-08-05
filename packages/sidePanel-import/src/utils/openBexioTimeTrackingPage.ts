export const BEXIO_MONITORING_TIMETRACKING = "https://office.bexio.com/index.php/monitoring/edit";

/**
 * How long we wait for the tab to finish loading the time tracking page before
 * giving up. Generous enough for a slow bexio page load, short enough that a
 * session that redirected to the login page (or a user who navigated away)
 * fails visibly instead of leaving the caller waiting forever.
 */
export const NAVIGATION_TIMEOUT_MS = 15000;

/** Grace period after "complete" so bexio can finish rendering the form. */
const RENDER_SETTLE_MS = 500;

/**
 * True for the URLs the template content script is registered on
 * (`content_scripts` in packages/chrome-extension/public/manifest.json):
 *   https://office.bexio.com/index.php/monitoring/edit
 *   https://office.bexio.com/index.php/monitoring/edit/id/*
 * Chrome ignores the fragment when matching, and the `/id/*` pattern also covers
 * any query string. Everything else (a login redirect, the monitoring list, ...)
 * must not count as "we are there" — the content script does not run there.
 */
export function isTimeTrackingPageUrl(url: string | undefined): boolean {
  if (!url) return false;
  const withoutFragment = url.split("#")[0];
  return (
    withoutFragment === BEXIO_MONITORING_TIMETRACKING ||
    withoutFragment.startsWith(`${BEXIO_MONITORING_TIMETRACKING}/id/`)
  );
}

/**
 * Navigates the active tab to the bexio time tracking form and resolves once
 * that tab has loaded it. Rejects if there is no tab to navigate, if the
 * navigation itself fails, or if the page has not loaded within
 * NAVIGATION_TIMEOUT_MS. The `chrome.tabs.onUpdated` listener is removed on
 * every exit path.
 */
async function openBexioTimeTrackingPage(): Promise<boolean> {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });

  // Only the plain edit URL counts as "already there": an `/edit/id/<id>` page
  // edits an *existing* time entry, so we still navigate to a fresh form.
  if (tab?.url === BEXIO_MONITORING_TIMETRACKING) {
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
      chrome.tabs.onUpdated.removeListener(onUpdated);
      if (error) reject(error);
      else resolve();
    };

    const timeoutId = setTimeout(
      () =>
        finish(new Error(`Timed out after ${NAVIGATION_TIMEOUT_MS}ms waiting for ${BEXIO_MONITORING_TIMETRACKING}`)),
      NAVIGATION_TIMEOUT_MS,
    );

    chrome.tabs.onUpdated.addListener(onUpdated);
    // Open the page
    chrome.tabs.update(tabId, { url: BEXIO_MONITORING_TIMETRACKING }).catch((error: unknown) => finish(error));
  });

  // Wait a little bit, so the rendering can be finished. (Not sure how easy we
  // could track this, maybe with a message and an other listener here)
  await new Promise((resolve) => setTimeout(resolve, RENDER_SETTLE_MS));
  return true;
}

export default openBexioTimeTrackingPage;
