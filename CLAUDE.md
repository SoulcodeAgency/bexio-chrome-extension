# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Chrome Manifest V3 extension that augments bexio's time tracking pages (`office.bexio.com`): save/load form data as templates, import time entries from ManicTime via a browser side panel, and replace bexio's tooltip icons with inline text. Published on the Chrome Web Store.

## Repository layout (npm workspaces)

This is an npm workspaces monorepo. Sub-projects live in `packages/`:

- `packages/chrome-extension` (`@bexio-chrome-extension/chrome-extension`) — the MV3 extension: content scripts, service worker, manifest. Built with Vite + `@crxjs/vite-plugin`. Plain TS, no framework.
- `packages/sidePanel-import` (`@bexio-chrome-extension/side-panel-import`) — the React 19 + antd app rendered inside Chrome's side panel. Built with Vite + `@vitejs/plugin-react`. This is the only package with ESLint configured.
- `packages/shared` (`@bexio-chrome-extension/shared`) — TypeScript-only library (no build step) consumed by both other packages. Imported as `@bexio-chrome-extension/shared` and via subpaths like `@bexio-chrome-extension/shared/types` or `@bexio-chrome-extension/shared/chromeStorageSettings`. Wraps `chrome.storage.local`, defines shared types, template sorting/naming.

Both Vite builds emit into the repo-root `unpacked/` directory (`unpacked/` = the loadable unpacked extension; the side panel goes to `unpacked/sidePanel-import/`). `dist/` holds the zipped package for store upload. Both are git-ignored and recreated by builds.

## Commands

Install: `npm run npm:installProject` (= `npm i --workspaces --include-workspace-root`). CI: `npm run npm:ciProject`.

Build (orchestrated by `Build.ps1`, PowerShell — this is a Windows-first repo):
- `npm run build:project` — production build of both packages into `unpacked/`.
- `npm run build:project -- -Development` — development-mode build (non-minified).
- `npm run build:newExtensionRelease` — production build **plus** zip to `dist/bexio-chrome-extension.zip` (and opens the Chrome dev console).
- Flags pass through `Build.ps1`: `-IgnoreExtension`, `-IgnoreSidePanel`, `-Development`, `-CreatePackage`.
- `npm run build:cleanup` — remove `dist/` and `unpacked/`.

Per-package builds (run from repo root):
- `npm run build -w @bexio-chrome-extension/chrome-extension` (also `build:dev`, `build:watch`)
- `npm run build -w @bexio-chrome-extension/side-panel-import` (also `build:dev`, `build:watch`, `dev` for a standalone Vite dev server, `lint`)

Lint (side panel only): `npm run lint -w @bexio-chrome-extension/side-panel-import`.

There is **no test suite** — `npm test` in `packages/shared` is a stub. "Test" in the release docs means manual testing in the browser.

Loading locally: build, then in Chrome → Extensions → Load unpacked → select the `unpacked/` folder.

## Releases

Run `npm run createRelease` (`CreateRelease.ps1`); see `RELEASE.md`. It bumps the version (`version:patch|minor|major`, which only edits `package.json` — `--no-git-tag-version`), runs `build:newExtensionRelease`, regenerates `CHANGELOG.md` via `git-cliff` (config in `cliff.toml`), runs `version:updateManifest` (`updateManifest.js` copies `package.json` version into `packages/chrome-extension/public/manifest.json` and stamps the build date into `package.json`), then commits as `Release: <version>`, tags, and fast-forward-merges the tag into `main`. The dev branch is `develop`.

## Architecture notes

- **Content scripts** are declared in `packages/chrome-extension/public/manifest.json`, keyed by bexio URL:
  - `monitoring/edit*` → `src/apps/bexioTimetrackingTemplates/index.ts` — the template save/apply UI injected into the time-entry form.
  - `monitoring/list`, `pr_project/listMonitoring/*`, `pr_project/showPackage/*`, `kb_invoice/show/id/*` → `src/apps/bexioProjectList/index.ts` — the tooltip→text replacement (`convertPopover`), driven by `MutationObserver`s because bexio re-renders tables.
- **Service worker** (`public/service_worker.js`, plain JS): opens the bexio time tracking tab on toolbar-icon click, and enables/configures the side panel (`/sidePanel-import/index.html`) only on `office.bexio.com/index.php/monitoring*` tabs.
- **Side panel ↔ content script messaging**: the React app sends `chrome.runtime.sendMessage` payloads typed as `ExchangeRequestData` (`packages/shared/types.ts`: `mode: "template" | "time+duration" | "reload"`). The content script handles them in `src/eventListeners/onMessage.ts`, which calls `fillForm` (apply a template), `triggerDuration`/`triggerDate`/`triggerDescription`/`triggerCheckbox` (apply a ManicTime entry), or re-initializes the page UI.
- **Manipulating bexio's form** is fiddly: the page uses jQuery/select2 widgets, so `src/utils/trigger*.ts` and `src/utils/waitFor*.ts` simulate input events and poll for async-loaded options; `src/selectors/` centralizes the DOM selectors. When bexio markup changes, those two folders are where breakage lives.
- **Persistence**: everything is `chrome.storage.local` via `packages/shared/chromeStorage*.ts` — `chromeStorageTemplateEntries` (templates), `chromeStorageImportData` (ManicTime import buffer), `chromeStorageSettings` (UI prefs like active tab, "apply notes"). Templates are `TemplateEntry` objects (`types.ts`).
- **ManicTime import flow** lives in `packages/sidePanel-import/src/components/ImportEntries/` — clipboard CSV is parsed (`utils/csvParser.ts`), entries are auto-matched to templates (`AutoMapTemplatesV3.ts`, also checks template `keywords`), and applying an entry posts an `EntryExchangeData` (and optionally a `TemplateExchangeData`) message to the content script.

## Conventions

- Prettier: 2-space indent, no tabs, `printWidth` 120 (`.prettierrc`).
- Vite alias `~` → that package's `src/` in `sidePanel-import`.
- `.npmrc` sets `save-exact=true` and `ignore-scripts=true`; dependency versions in `package.json` files are pinned (no `^`). The root pins `rollup`/`esbuild` via `overrides`.
- Do not edit `manifest.json`'s `version` by hand — it's generated by `updateManifest.js` during release. The display strings in `package.json` `description`/`date` are likewise touched by tooling.
