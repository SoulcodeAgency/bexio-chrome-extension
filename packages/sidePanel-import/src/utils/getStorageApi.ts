/**
 * `chrome.storage` is missing when the app runs outside the extension (the standalone Vite dev
 * server) and the test fake throws on unimplemented members, so the lookup itself is guarded.
 *
 * Its presence is what separates "running inside the extension" from "running in a plain browser
 * tab" — deliberately *not* `process.env.NODE_ENV`, which only says how the bundle was built. A
 * development build of the extension has `chrome.storage` and must read the user's real data.
 */
export function getStorageApi(): typeof chrome.storage | undefined {
  try {
    return typeof chrome !== "undefined" && chrome.storage ? chrome.storage : undefined;
  } catch {
    return undefined;
  }
}

export default getStorageApi;
