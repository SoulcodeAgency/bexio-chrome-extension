import * as packageInfo from "../../../../package.json";

/**
 * The version Chrome actually loaded — which is the only one that identifies a build.
 *
 * `npm run build:test` stamps a fourth part into the built `manifest.json` *only*
 * (`1.8.2.7`), so that several test builds can be told apart on chrome://extensions
 * without any tracked file changing. Reading `package.json` here would therefore always
 * print the release version and never say *which* test build is on the page. The manifest
 * is the same file Chrome shows, so the two can no longer disagree.
 *
 * Falls back to `package.json` outside an extension context — `vite dev`, and any test
 * whose chrome fake does not stub `getManifest` (the fake's guard throws on an unstubbed
 * member, so this has to catch, not just optional-chain).
 */
function loadedVersion(): string {
  try {
    return globalThis.chrome?.runtime?.getManifest().version ?? packageInfo.version;
  } catch {
    return packageInfo.version;
  }
}

export const VERSION = loadedVersion();
export const DATE = packageInfo.date ?? "Jan 4, 2024";
