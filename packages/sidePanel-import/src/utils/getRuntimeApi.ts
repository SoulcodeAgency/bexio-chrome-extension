/**
 * `chrome.runtime` is missing when the app runs outside the extension (the standalone Vite dev
 * server), so the lookup is guarded the same way as `getTabsApi` / `getStorageApi`.
 */
export function getRuntimeApi(): typeof chrome.runtime | undefined {
  try {
    return typeof chrome !== "undefined" && chrome.runtime ? chrome.runtime : undefined;
  } catch {
    return undefined;
  }
}

export default getRuntimeApi;
