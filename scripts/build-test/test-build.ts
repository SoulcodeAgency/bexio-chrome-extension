import { posix, win32 } from "node:path";

/**
 * Helpers for `npm run build:test` (see `build-test.ts`): the version number and the safety
 * check for the one folder Chrome loads the test build from.
 */

const MAX_VERSION_PART = 65535; // Chrome's limit for each dot-separated part of `manifest.version`

/**
 * The version a test build carries in its manifest: the release version plus the build number
 * as a fourth part (`1.8.2` → `1.8.2.7`). Chrome shows it on chrome://extensions, which is how a
 * loaded test build is told apart from the previous one — without touching any tracked file.
 */
export function testBuildVersion(baseVersion: string, buildNumber: number): string {
  const parts = baseVersion.split(".");
  if (parts.length < 3 || parts.length > 4 || parts.some((part) => !/^\d+$/.test(part))) {
    throw new Error(`Cannot derive a test build version from "${baseVersion}".`);
  }
  if (!Number.isInteger(buildNumber) || buildNumber < 0 || buildNumber > MAX_VERSION_PART) {
    throw new Error(`Build number ${buildNumber} is outside Chrome's 0–${MAX_VERSION_PART} range for a version part.`);
  }
  return [...parts.slice(0, 3), String(buildNumber)].join(".");
}

/** The build number after the stored one; 1 when nothing (readable) is stored yet. */
export function nextBuildNumber(stored: string | undefined): number {
  const previous = Number.parseInt(stored?.trim() ?? "", 10);
  return Number.isInteger(previous) && previous >= 0 ? previous + 1 : 1;
}

/**
 * Throws unless `directory` (given by its entries, `undefined` when it does not exist) is
 * missing, empty, or a previous extension build: its whole content is about to be replaced.
 */
export function assertReplaceableTarget(directory: string, entries: string[] | undefined): void {
  if (entries === undefined || entries.length === 0 || entries.includes("manifest.json")) {
    return;
  }
  throw new Error(
    `${directory} is not empty and holds no manifest.json, so it is not a previous extension build. Refusing to replace its content.`,
  );
}

export function isSameDirectory(a: string, b: string, platform: NodeJS.Platform = process.platform): boolean {
  if (platform === "win32") {
    const normalise = (path: string) => win32.resolve(path).replace(/\\+$/, "").toLowerCase();
    return normalise(a) === normalise(b);
  }
  return posix.resolve(a).replace(/\/+$/, "") === posix.resolve(b).replace(/\/+$/, "");
}
