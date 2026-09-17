import * as packageInfo from "../../../../package.json";

/**
 * The version Chrome actually loaded, for the footer line.
 *
 * `npm run build:test` stamps a fourth part into the built `manifest.json` only
 * (`1.8.2.7`), so `package.json` cannot say which test build is running — the manifest
 * can, and it is the same value chrome://extensions shows.
 *
 * Falls back to `package.json` when there is no extension around it: the standalone
 * `npm run dev` server, and tests whose chrome fake does not stub `getManifest`.
 */
export function loadedVersion(): string {
  try {
    return globalThis.chrome?.runtime?.getManifest().version ?? packageInfo.version;
  } catch {
    return packageInfo.version;
  }
}
