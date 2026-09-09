/**
 * `chrome.tabs` is missing when the app runs outside the extension (the standalone Vite dev
 * server) and the test fake throws on unimplemented members, so the lookup itself is guarded.
 *
 * This is the check every caller that wants to talk to the bexio tab has to make. It is
 * deliberately *not* keyed on `process.env.NODE_ENV`: a development *build* of the extension
 * has `chrome.tabs` just like a production build does.
 */
export function getTabsApi(): typeof chrome.tabs | undefined {
  try {
    return typeof chrome !== "undefined" && chrome.tabs ? chrome.tabs : undefined;
  } catch {
    return undefined;
  }
}

export default getTabsApi;
