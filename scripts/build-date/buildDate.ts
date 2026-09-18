/**
 * The "last update" date the extension shows — stamped at build time into both bundles as
 * `__BUILD_DATE__` (Vite `define`, see the two `vite.config.*`).
 *
 * It used to be a `date` field in `package.json`, written by `updateManifest.js`. Only the
 * manual release path runs that script, so every release-please release left it alone and the
 * extension kept saying "Jan 5, 2026" — the last manual release — through 1.4.0 to 1.9.0. A build
 * always happens, on every path, so the date belongs there.
 *
 * Swiss time on purpose: the store build runs on a UTC runner, and a release cut in the evening
 * would otherwise carry the previous day.
 */
export function buildDate(now: Date = new Date()): string {
  return now.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Zurich",
  });
}
