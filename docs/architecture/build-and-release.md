# Build & Release Tooling

This document covers the workspace layout, build pipeline, release sequence, and known gotchas for the `bexio-chrome-extension` monorepo.

> **Looking for the automated CI release path?** This doc focuses on the build pipeline and the manual `CreateRelease.ps1` flow. The automated path (`release-please` → GitHub Actions → Chrome Web Store) has its own dedicated doc at `docs/architecture/publishing.md`. The two release paths are designed to coexist; pick one per release.

---

## Workspace Layout

The repository uses **npm workspaces** with three packages:

| Package | Name | Purpose | Build step? |
|---|---|---|---|
| `packages/shared` | `@bexio-chrome-extension/shared` | Shared TypeScript utilities and types (chrome storage wrappers, template helpers) consumed by both other packages | None — source files are imported directly via the workspace symlink |
| `packages/chrome-extension` | `@bexio-chrome-extension/chrome-extension` | The Chrome extension content scripts and popup | `vite build` / `vite build --mode development` |
| `packages/sidePanel-import` | `@bexio-chrome-extension/side-panel-import` | The React side-panel app that lives in the Chrome Side Panel | `vite build` / `vite build --mode development` |

`shared` has no build step. Its `package.json` `"main"` points to `index.ts` and the other packages import it via the npm workspace symlink (`node_modules/@bexio-chrome-extension/shared → packages/shared`). In tests, Vitest's path aliases replicate this resolution (see `vitest.config.ts`).

---

## TypeScript

`tsc` never emits anything in this repo — Vite/Rolldown does all the transpiling, and every `tsconfig.json` sets `noEmit`. Type checking is a separate gate: `npm run typecheck` (root) fans out to a per-package `typecheck` script, and CI runs it between install and build.

| Project | Config | Strict? |
|---|---|---|
| `packages/shared` | `tsconfig.json` | yes |
| `packages/chrome-extension` | `tsconfig.json` | yes |
| `packages/sidePanel-import` | `tsconfig.json` (app) + `tsconfig.node.json` (`vite.config.ts`) | yes |

### Strict mode in `chrome-extension`

Strict mode was switched on as a **behaviour-preserving** change, not a bug-fixing one. The build output was verified byte-identical except for one deliberate line (below), so nothing about how the extension behaves in the browser changed.

The rule followed, and the one to keep following:

> Where strict flagged a possible `null`/`undefined`, the fix is a non-null assertion (`!`) or a type-level cast — **not** a runtime guard.

That looks lazy but is the deliberate choice. Adding `if (!x) return` would convert a loud, visible crash into a silent no-op: `fillForm` would leave the loader spinning forever instead of throwing, `swapDisplayStyle` would quietly stop toggling. The existing crash is better failure behaviour than silent nothing, and the test suite pins current behaviour on purpose (see `docs/architecture/testing.md`). Each `!` carries a comment explaining why the value is expected to exist.

The single intentional runtime change is in `convertPopover.ts`: `DOMPurify.sanitize(popoverText ?? "")`. `getPopoverNodeText` genuinely returns `null` when the icon has no `data-content`. This is safe because `sanitize(null)` and `sanitize("")` both return `""` — verified against the pinned DOMPurify version, and the unminified bundle diff for the whole change is exactly this one line.

Strict also surfaced two latent bugs that were **left in place** and marked `// KNOWN ISSUE:` rather than fixed, because fixing them changes user-visible behaviour and belongs in its own change. Both are tracked as issues:

| Where | What | Issue |
|---|---|---|
| `readFormData.ts` | `trimAll(workField)` passes the work *element*, not the `work` string read from it, so `.length` is `undefined`, that link in the `templateName` chain is dead, and the suggested name always falls through to `"New Template"`. | #72 |
| `fillForm.ts` | `templateEntries.find(...)` returns `undefined` for an unknown `id` and the destructuring then throws, leaving the loader spinning. | #73 |

A third finding turned out **not** to be a bug: `keywords` is intentionally never set by `readFormData`. It is a side-panel-only override with no counterpart in the bexio form, so there is nothing there to read it from — templates start without it and gain it when edited in the side panel. `TemplateEntry` still declares it required, which is part of why the object literal in `readFormData` needs its `as TemplateEntry` cast.

### Two TypeScript versions, on purpose

All three packages pin **typescript 7.x**, which is the Go-native compiler. The npm package for TS 7 no longer exports the compiler's JavaScript API (`require("typescript")` yields only `{ version, versionMajorMinor }`), and `typescript-eslint` still needs that API to parse — its peer range is `>=4.8.4 <6.1.0`.

npm resolves this on its own: TS 7 installs **nested** under each package (`packages/*/node_modules/typescript`), and a TS 5.x is auto-installed at the **root** to satisfy `typescript-eslint`'s peer requirement. So `npm run typecheck` runs on 7 while `npm run lint` parses on 5. The root copy is not declared in any `package.json` — it tracks whatever `typescript-eslint` peers on, and is pinned by the lockfile. Do not add an explicit root `typescript` dependency; that would need its own Dependabot hold to stop it being bumped to 7 and breaking the linter.

Collapse this back to a single version once `typescript-eslint` supports TS 7.

### Things TypeScript 7 changed that bit this repo

- **`strict` defaults to `true`.** `packages/chrome-extension` was written against the old non-strict default, and turning it on surfaced 35 pre-existing nullability and implicit-`any` errors concentrated in the fragile DOM/form layer. All three packages are now strict — see "Strict mode in `chrome-extension`" below for the rules that were followed getting there.
- **`@types/*` packages are no longer auto-included.** TS 7 stopped pulling in every `node_modules/@types/*` package it could find, so each `tsconfig.json` now lists what it needs via `"types"` (`chrome`, plus `node` for the side panel's `process.env` usage). Symptom when this is missing: `Cannot find name 'chrome'`.
- **`target: "es5"` and `baseUrl` were removed.** `chrome-extension` moved to `target: "ES2022"` (no effect on output — Vite's `build.target` governs that, and the codebase has no classes, so the `useDefineForClassFields` default flip is inert). `sidePanel-import` dropped `baseUrl` and lets its `paths` resolve relative to the tsconfig, which is what it wanted anyway.
- **`sidePanel-import` no longer uses project references.** `tsconfig.node.json` was `composite: true` and referenced from the app config. Nothing in the repo ever ran `tsc -b`, and a composite project without `noEmit` writes a `vite.config.js` next to `vite.config.ts` — which Vite would then load in preference to the source. The reference and `composite` are gone; `tsconfig.node.json` is now checked standalone as the second half of the package's `typecheck` script.

---

## `Build.ps1` Flag Matrix

`Build.ps1` (repo root) orchestrates both package builds. Invoke it via the root npm script `npm run build:project`.

| Flag | Effect |
|---|---|
| *(none)* | Builds both `chrome-extension` and `sidePanel-import` in **production** mode (`vite build`) |
| `-Development` | Builds both packages in **development** mode (`vite build --mode development`); output is not minified |
| `-IgnoreExtension` | Skips the `chrome-extension` build |
| `-IgnoreSidePanel` | Skips the `sidePanel-import` build |
| `-CreatePackage` | After both builds, zips `unpacked/` into `dist/bexio-chrome-extension.zip` and opens the Chrome Web Store developer console |

Flags can be combined. For example, to build only the side panel in dev mode:
```powershell
npm run build:project -- -Development -IgnoreExtension
```

Or via PowerShell directly:
```powershell
powershell -File Build.ps1 -Development -IgnoreExtension
```

---

## Output Directories

| Directory | Contents | Audience |
|---|---|---|
| `unpacked/` | The loadable, unpacked Chrome extension (manifest + built JS/CSS/assets + side-panel sub-directory) | Load via `chrome://extensions` → "Load unpacked"; used as the smoke-test target |
| `unpacked/sidePanel-import/` | The built React side-panel app nested inside `unpacked/` | Served by Chrome as a side-panel page; referenced by the extension's manifest |
| `dist/` | A zip of `unpacked/` named `bexio-chrome-extension.zip` | Chrome Web Store upload (created only when `-CreatePackage` is passed) |

Both `unpacked/` and `dist/` are git-ignored.

---

## Vite + `@crxjs/vite-plugin` Pipeline

Both packages build with **Vite 8**, which bundles with **Rolldown** internally (Vite ≤ 7 used Rollup for bundling and esbuild for transforms; Vite 8 has no esbuild dependency at all). The `rollupOptions` keys in both configs are still honoured — Rolldown accepts them as compatible aliases.

### `chrome-extension` build (`packages/chrome-extension/vite.config.js`)

- Uses [`@crxjs/vite-plugin`](https://crxjs.dev/) which reads the source `manifest.json` and performs several transformations: it rewrites `content_scripts[].js` entry paths from `.ts` source files to the built `.js` output names, and injects HMR glue in development mode.
- **`assetsDir: ""`** — disables Vite's default `assets/` sub-folder for JS chunks, keeping all scripts at the `unpacked/` root. Without this, content-script paths in the built manifest would include the sub-folder.
- **`chunkFileNames: "[name].js"` / `entryFileNames: "[name].js"`** — strips the content hash from output filenames. This is required because Chrome extensions load scripts by exact filename from the manifest; hash-suffixed names would break on every build.
- **`outDir: "../../unpacked"`** — the build outputs to the repo-level `unpacked/` directory (two levels up from `packages/chrome-extension/`).
- **`emptyOutDir: true`** — clears `unpacked/` before each build (only in the extension build; see note on race conditions below).
- **`minify: mode === "production"`** — minification only in production builds.
- **`withUniqueChunkNames(...)`** — a local wrapper around the `crx()` plugin array that works around a Rolldown incompatibility in `@crxjs/vite-plugin` (as of 2.7.1): Rolldown derives `emitFile` refIds from the chunk `name` alone, and the plugin emits every content script under its basename. Both content scripts are `index.ts`, so their refIds collided and the build failed with `Content script fileName is undefined`. The wrapper rewrites colliding `index.*` chunk names to the entry's parent directory name, so the content-script bundles come out as `bexioTimetrackingTemplates.js` and `bexioProjectList.js` (under Vite 5/Rollup they were `index.ts.js` and `index.ts2.js`). The built manifest references small `*-loader.js` files that dynamically import these chunks — that indirection is standard `@crxjs` output, and the chunk names stay hash-free via `entryFileNames`/`chunkFileNames` as before. If a future `@crxjs/vite-plugin` release emits unique chunk names itself, the wrapper can be deleted.

The source `manifest.json` lives at `packages/chrome-extension/public/manifest.json`. The `@crxjs` plugin reads it at build time and writes a transformed copy to `unpacked/manifest.json`. The source manifest must have its `version` field in sync with `package.json` before a build — this sync is performed by `updateManifest.js` (see Release Sequence below). If they diverge, the built `unpacked/manifest.json` will carry the source manifest's (stale) version; the smoke test in Task 2.2 catches this invariant.

### `sidePanel-import` build (`packages/sidePanel-import/vite.config.ts`)

- **`base: "/sidePanel-import/"`** — sets the public base URL so asset references in the HTML are absolute from the extension root.
- **`outDir: "../../unpacked/sidePanel-import"`** — outputs into the `sidePanel-import/` sub-directory inside `unpacked/`.
- **React deduplication aliases** — the config pins `react` and `react-dom` to `../../node_modules/react` and `../../node_modules/react-dom` (the root workspace's copies). This prevents duplicate React instances when `shared` or other packages also import React transitively.
- **`manualChunks: undefined`** — disables the bundler's default code-splitting for the side panel; the entire app bundles into a single JS file. Rolldown still honours this key under Vite 8.

### The `overrides` block is gone — do not bring it back

The root `package.json` used to force `esbuild` and `rollup` versions via an `overrides` block (added in `becd607`, "Fix security issue") because Vite 5 declared support only for older esbuild versions. Forcing a build tool's dependencies past their declared range is exactly what broke the build when Dependabot proposed esbuild 0.28.1. Vite 8 bundles Rolldown and depends on neither esbuild nor rollup, so the overrides — and the matching Dependabot `ignore` entries — were removed. If a security advisory ever hits a Vite-internal dependency again, upgrade Vite instead of overriding.

---

## Release Sequence (`createRelease.ps1`)

The script is interactive and must be run manually from the `develop` branch (or a feature branch). Steps in order:

1. **Version bump prompt** — asks `patch`, `minor`, or `major`; runs the corresponding `npm run version:{patch|minor|major}` script, which calls `npm --no-git-tag-version version <type>`. This bumps the `version` field in the **root `package.json` only** (the `--no-git-tag-version` flag suppresses the automatic git commit and tag that `npm version` normally creates).

2. **Confirmation** — prints the new version and waits for Enter before proceeding.

3. **`build:newExtensionRelease`** (`npm run build:project -- -createPackage`) — triggers `Build.ps1 -CreatePackage`, which builds both packages in **production** mode and zips the result to `dist/bexio-chrome-extension.zip`.

4. **Changelog generation** — runs `npx git-cliff --tag <version> > CHANGELOG.md`. `git-cliff` reads `cliff.toml` (see below) to format conventional commits since the last tag into a human-readable changelog.

5. **`version:updateManifest`** (`node updateManifest.js`) — reads `./package.json` for the new version, regex-replaces the `"version"` field in `packages/chrome-extension/public/manifest.json`, and stamps today's date (en-US locale: `"May 13, 2026"`) into `package.json`'s `"date"` field.

6. **Commit, tag, merge** — stages everything (`git add .`), waits for confirmation, commits as `Release: <version>`, creates a git tag `<version>` (bare, no `v` prefix), checkouts `main`, merges the tag, runs `git push --all`, and returns to `develop`.

### `cliff.toml`

`cliff.toml` (repo root) configures `git-cliff` for changelog generation:

- Parses commits following the **Conventional Commits** spec (`conventional_commits = true`).
- Groups commits into sections: Features, Bug Fixes, Documentation, Performance, Refactor, Styling, Testing, Miscellaneous Tasks, Security, Revert.
- Includes non-conventional commits (`filter_unconventional = false`, `filter_commits = false`) so no commit is silently dropped from the changelog.
- Tag pattern `[0-9.]*` matches bare version tags like `1.3.6` (no `v` prefix).
- Output format: `## [version] - YYYY-MM-DD` sections.

---

## Gotchas

### `Build.ps1` swallows sub-build errors

Each build step is wrapped in a `try/catch`. If `vite build` exits with a non-zero code (e.g. a TypeScript error), PowerShell's `catch` block prints a red warning message but **does not re-throw or exit**. The script continues to the next step and reports success. As a result:

- A failing extension build followed by a successful side-panel build will print "OK" for both.
- `unpacked/` may be stale or partially built.
- The exit code of `npm run build:project` will be **0** even when a sub-build failed.

The smoke test (Task 2.2) guards against the most visible symptom (missing or wrong-versioned files), but it cannot distinguish a genuinely fresh build from a stale one if `unpacked/` already existed from a prior run.

### `@swc/core` appears vestigial

`@swc/core@1.15.8` is listed as a `dependency` in both `packages/chrome-extension/package.json` and `packages/sidePanel-import/package.json`. Recent commits (`fix(build) Fix esbuild manually`, `fix(build) Getting rid of swc`) suggest that the SWC-based transform was removed. Neither Vite config references `@swc/core` directly. It is likely safe to remove, but doing so is out of scope here — the dependency is noted for a future cleanup.

### `.npmrc`: `save-exact` + `ignore-scripts`

The `.npmrc` at repo root sets:

```ini
save-exact=true
ignore-scripts=true
```

- **`save-exact=true`** — every `npm install --save[-dev]` pins an exact version (no `^` or `~`). This ensures reproducible installs.
- **`ignore-scripts=true`** — npm lifecycle scripts (`postinstall`, `prepare`, etc.) are not run automatically. This means tools that require a post-install step — such as `@playwright/test` (which needs `playwright install` to download browser binaries) — must be set up manually after installation.

### Branch model

- Active development happens on the **`develop`** branch (and feature branches branching from it).
- Releases land on **`main`** via the `createRelease.ps1` merge step.
- Never commit directly to `main`; it should only ever receive fast-forward merges of tagged release commits.

---

## What the Tests Guard

- **Task 2.1** (`test/updateManifest.test.ts`) — pins that `updateManifest.js` correctly copies the `version` from `package.json` into `manifest.json` and stamps today's date into `package.json`, without touching other manifest fields. Runs in a temp directory so it cannot corrupt the real files.
- **Task 2.2** (`test/build-smoke.slow.test.ts`) — runs an actual `Build.ps1 -Development` end-to-end and asserts: `unpacked/manifest.json` exists and parses; its `version` matches root `package.json`; every JS/CSS file referenced in `content_scripts` and `background.service_worker` exists in `unpacked/`; `unpacked/sidePanel-import/index.html` exists. This test is tagged `.slow` and excluded from `npm run test:fast`; it runs as part of the full `npm test` suite.
