/**
 * `npm run build:test` — builds the extension from the current checkout (main or any worktree)
 * and puts it into the ONE folder Chrome loads for manual testing: the main checkout's
 * `unpacked/`. Its path decides the extension id, and with it `chrome.storage.local` (templates,
 * settings), so it never changes; after a build, reloading the extension on chrome://extensions
 * is all that is needed.
 *
 * 1. `Build.ps1 -Development` in the current checkout (NODE_ENV=development, so React's console
 *    warnings are in the bundle), into that checkout's own `unpacked/`.
 * 2. Its content replaces the content of `<main checkout>/unpacked/` (skipped when both are the
 *    same folder).
 * 3. Only there, `manifest.json` gets the version `<release version>.<build number>`; the number
 *    is counted in the git common dir, which all worktrees share. No tracked file changes.
 * 4. `build-info.json` next to it records what was built.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { assertReplaceableTarget, isSameDirectory, nextBuildNumber, testBuildVersion } from "./test-build.ts";

const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();

const checkoutRoot = resolve(git("rev-parse", "--show-toplevel"));
const gitCommonDir = resolve(git("rev-parse", "--path-format=absolute", "--git-common-dir"));
const mainCheckoutRoot = dirname(gitCommonDir);
const source = join(checkoutRoot, "unpacked");
const target = join(mainCheckoutRoot, "unpacked");

const build = spawnSync(
  process.platform === "win32" ? "powershell" : "pwsh",
  ["-NoProfile", "-File", join(checkoutRoot, "Build.ps1"), "-Development"],
  { cwd: checkoutRoot, stdio: "inherit", env: { ...process.env, NODE_ENV: "development" } },
);
if (build.status !== 0) {
  console.error(`\nFAILED Build.ps1 exited with ${build.status ?? build.error}. ${target} was not touched.`);
  process.exit(build.status ?? 1);
}

if (!isSameDirectory(source, target)) {
  const entries = existsSync(target) ? readdirSync(target) : undefined;
  assertReplaceableTarget(target, entries);
  // Replace the content, not the folder: Chrome keeps pointing at the same path either way.
  mkdirSync(target, { recursive: true });
  for (const entry of entries ?? []) rmSync(join(target, entry), { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
}

const counterFile = join(gitCommonDir, "bexio-test-build-number");
const buildNumber = nextBuildNumber(existsSync(counterFile) ? readFileSync(counterFile, "utf8") : undefined);
writeFileSync(counterFile, `${buildNumber}\n`);

const manifestFile = join(target, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
const releaseVersion: string = manifest.version;
manifest.version = testBuildVersion(releaseVersion, buildNumber);
writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);

const branch = git("branch", "--show-current") || "(detached HEAD)";
const commit = git("rev-parse", "--short", "HEAD");
const uncommittedChanges = git("status", "--porcelain").length > 0;
writeFileSync(
  join(target, "build-info.json"),
  `${JSON.stringify(
    {
      version: manifest.version,
      branch,
      commit,
      uncommittedChanges,
      checkout: checkoutRoot,
      builtAt: new Date().toISOString(),
    },
    null,
    2,
  )}\n`,
);

console.log(`
OK Test build ${manifest.version} is ready in ${target}
   built from ${branch} @ ${commit}${uncommittedChanges ? " + uncommitted changes" : ""} (${checkoutRoot})
   Chrome: chrome://extensions → "${manifest.name}" → reload. It must then show version ${manifest.version}.`);
