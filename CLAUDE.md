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

**In a git worktree** (`.claude/worktrees/<name>/`, e.g. every session in the Claude Code desktop app), run `npm run npm:ciProject` inside the worktree before anything else. A worktree is a fresh checkout without `node_modules`, and Node then resolves upward into the *main checkout's* `node_modules` — which belongs to whatever branch that checkout last installed. Nothing warns you: `vitest` and the chrome-extension build keep working on the borrowed packages, while `npm run typecheck` and the build smoke test fail for `sidePanel-import` as if the code were broken. Use `npm ci`, not `npm i`, so `package-lock.json` stays untouched.

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

Typecheck: `npm run typecheck` (root; fans out to all three packages, also run in CI). `tsc` never emits here — Vite does the transpiling and every tsconfig sets `noEmit`. The packages are on TypeScript 7 (the Go-native compiler) while ESLint still parses with a root-level TypeScript 5.x that npm auto-installs for `typescript-eslint`'s peer range. All three packages are `strict`. Read the "TypeScript" section of `docs/architecture/build-and-release.md` before touching a `tsconfig.json` — in particular the rules for `chrome-extension`, where strict mode was reached by pinning existing behaviour (`!`/casts) rather than adding runtime guards.

Tests: there is now a Vitest suite — `npm test` (all projects, including a slow build smoke test that shells out to `Build.ps1`), `npm run test:fast` (Vitest minus `*.slow.test.ts`), `npm run test:watch`, plus `npm run test:e2e` (Playwright smoke + behaviour specs in `e2e/` — runs in CI via Xvfb; locally needs `npx playwright install chromium` once and a built `unpacked/`, and opens a visible Chromium window because MV3 service workers don't surface headlessly). See `docs/architecture/testing.md`. Tests pin **current** behaviour (bugs included, flagged `// KNOWN ISSUE:`). DOM-dependent tests load anonymised captured bexio HTML from `packages/chrome-extension/test/fixtures/bexio/`. "Test" in the release docs (`RELEASE.md`) still refers to the manual in-browser walkthrough — that checklist is in `docs/architecture/testing.md`.

Loading locally: build, then in Chrome → Extensions → Load unpacked → select the `unpacked/` folder.

## Releases

Run `npm run createRelease` (`CreateRelease.ps1`); see `RELEASE.md`. It bumps the version (`version:patch|minor|major`, which only edits `package.json` — `--no-git-tag-version`), runs `build:newExtensionRelease`, regenerates `CHANGELOG.md` via `git-cliff` (config in `cliff.toml`), runs `version:updateManifest` (`updateManifest.js` copies `package.json` version into `packages/chrome-extension/public/manifest.json` and stamps the build date into `package.json`), then commits as `Release: <version>`, tags, and fast-forward-merges the tag into `main`. The dev branch is `develop`. For the automated CI release path (`release-please` → Chrome Web Store via GitHub Actions, recommended), see `docs/architecture/publishing.md`.

## Architecture notes

- **Content scripts** are declared in `packages/chrome-extension/public/manifest.json`, keyed by bexio URL:
  - `monitoring/edit*` → `src/apps/bexioTimetrackingTemplates/index.ts` — the template save/apply UI injected into the time-entry form.
  - `monitoring/list`, `pr_project/listMonitoring/*`, `pr_project/showPackage/*`, `kb_invoice/show/id/*` → `src/apps/bexioProjectList/index.ts` — the tooltip→text replacement (`convertPopover`), driven by `MutationObserver`s because bexio re-renders tables.
- **Service worker** (`public/service_worker.js`, plain JS): opens the bexio time tracking tab on toolbar-icon click, and enables/configures the side panel (`/sidePanel-import/index.html`) only on `office.bexio.com/index.php/monitoring*` tabs.
- **Side panel ↔ content script messaging**: the React app sends `chrome.tabs.sendMessage` payloads typed as `ExchangeRequestData` (`packages/shared/types.ts`: `mode: "template" | "time+duration" | "reload"`) through the single helper `packages/sidePanel-import/src/utils/sendToBexioTab.ts`, which reports "no tab" / "no content script" failures to the user via an antd `message` toast. The content script handles them in `src/eventListeners/onMessage.ts` — a sync dispatcher that returns `true` and always answers with an `ExchangeResponse` (`{ ok: true }` / `{ ok: false, error }`) — calling `fillForm` (apply a template), `triggerDuration`/`triggerDate`/`triggerDescription`/`triggerCheckbox` (apply a ManicTime entry), or re-initializing the page UI. The contract is documented in `docs/architecture/form-layer.md` ("Messaging contract").
- **Manipulating bexio's form** is fiddly: the page uses jQuery/select2 widgets, so `src/utils/trigger*.ts` and `src/utils/waitFor*.ts` simulate input events and poll for async-loaded options; `src/selectors/` centralizes the DOM selectors. When bexio markup changes, those two folders are where breakage lives.
- **Persistence**: everything is `chrome.storage.local` via `packages/shared/chromeStorage*.ts` — `chromeStorageTemplateEntries` (templates), `chromeStorageImportData` (ManicTime import buffer), `chromeStorageSettings` (UI prefs like active tab, "apply notes"). Templates are `TemplateEntry` objects (`types.ts`). Both the side panel and the content script write the `"entries"` key, so `TemplateProvider.tsx` subscribes to `chrome.storage.onChanged` and re-reads when it changes — that is what makes a template saved on the bexio page show up in an already-open side panel (and matchable by "Auto map templates"). The 🔄 button in the panel header is the manual version of the same reload. See `docs/architecture/storage.md`.
- **ManicTime import flow** lives in `packages/sidePanel-import/src/components/ImportEntries/` — clipboard CSV is parsed (`utils/csvParser.ts`), entries are auto-matched to templates (`AutoMapTemplatesV3.ts`, also checks template `keywords`), and applying an entry posts an `EntryExchangeData` (and optionally a `TemplateExchangeData`) message to the content script.
  - `handleCsvData` (the TSV parser) normalizes the whole pasted block once — strips every `\r`, `trimEnd()`s, splits on `\n` and drops blank lines — so the header, the data rows and the footer are treated identically. The **last non-empty line is always the footer** (the ManicTime totals row): it is display-only and must never end up in `importData`, because data rows render ▶️ apply buttons in their date columns and a click books that duration into bexio. Every data row must then have exactly the header's column count; a mismatch throws, and the message surfaces through `ImportEntries`' `parseStatus`. Downstream consumers (`autoMapTemplatesV3`, `getNotes`) still fall back to `""` for a missing cell, because an import buffer persisted by an older version can hold a short row.

## Architecture deep-dives

Detailed, behaviour-pinned docs for the topics that have a test suite — **read the relevant one before changing the corresponding code**:

- `docs/architecture/storage.md` — `chrome.storage.local` model, the `entries` key, settings keys, the `TemplateEntry` shape, the array-only assumptions in `chromeStorage.remove`/`update`, known issues.
- `docs/architecture/form-layer.md` — the bexio jQuery/select2/jQuery-UI form, the synthetic-event recipe per field type (`trigger*`), the `waitFor*` polling, the `fillForm` order + `timeEntryBillable` rule, the read-back path, the module-load quirk, and a "blast radius" map of fragile selectors.
- `docs/architecture/tooltip-replacement.md` — which bexio pages get the tooltip→text treatment, the per-page `MutationObserver` setup, the convert/revert cycle, the "Text mode" toggle, known issues (incl. the unverified `kb_invoice/show` branch).
- `docs/architecture/build-and-release.md` — the workspace layout, `Build.ps1` flag matrix, the Vite + `@crxjs/vite-plugin` quirks, the `createRelease.ps1` sequence, the gotchas (`Build.ps1`'s fail-fast exit codes and package assertion).
- `docs/architecture/testing.md` — the three test layers, the commands, the chrome fake, the module-load quirk, the fixture-capture procedure, and the manual real-bexio walkthrough checklist.
- `docs/architecture/publishing.md` — the two release paths, the `release-please` Release-PR concept, conventional-commit rules, the Chrome Web Store workflow + its secrets, and the recovery procedures.

The design spec and implementation plan that produced this suite are in `docs/superpowers/specs/` and `docs/superpowers/plans/`.

## Conventions

- Prettier: 2-space indent, no tabs, `printWidth` 120 (`.prettierrc`).
- Vite alias `~` → that package's `src/` in `sidePanel-import`.
- `.npmrc` sets `save-exact=true` and `ignore-scripts=true`; dependency versions in `package.json` files are pinned (no `^`).
- Do not edit `manifest.json`'s `version` by hand — it's generated by `updateManifest.js` during release. The display strings in `package.json` `description`/`date` are likewise touched by tooling.
