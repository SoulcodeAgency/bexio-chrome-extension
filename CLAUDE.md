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

**In a git worktree** (`.claude/worktrees/<name>/`, e.g. every session in the Claude Code desktop app), run `npm run npm:ciProject` inside the worktree before anything else. A worktree is a fresh checkout without `node_modules`, and Node then resolves upward into the _main checkout's_ `node_modules` — which belongs to whatever branch that checkout last installed. Nothing warns you: `vitest` and the chrome-extension build keep working on the borrowed packages, while `npm run typecheck` and the build smoke test fail for `sidePanel-import` as if the code were broken. Use `npm ci`, not `npm i`, so `package-lock.json` stays untouched.

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

Typecheck: `npm run typecheck` (root; fans out to all three packages, also run in CI). `tsc` never emits here — Vite does the transpiling and every tsconfig sets `noEmit`. The packages are on TypeScript 7 (the Go-native compiler) while ESLint still parses with a root-level JS-based TypeScript (currently 6.0.x) that npm auto-installs for `typescript-eslint`'s peer range. All three packages are `strict`. Read the "TypeScript" section of `docs/architecture/build-and-release.md` before touching a `tsconfig.json` — in particular the rules for `chrome-extension`, where strict mode was reached by pinning existing behaviour (`!`/casts) rather than adding runtime guards.

Tests: there is now a Vitest suite — `npm test` (all projects, including a slow build smoke test that shells out to `Build.ps1`), `npm run test:fast` (Vitest minus `*.slow.test.ts`), `npm run test:watch`, plus `npm run test:e2e` (Playwright smoke + behaviour specs in `e2e/` — runs in CI via Xvfb; locally needs `npx playwright install chromium` once and a built `unpacked/`, and opens a visible Chromium window because MV3 service workers don't surface headlessly). See `docs/architecture/testing.md`. Tests pin **current** behaviour (bugs included, flagged `// KNOWN ISSUE:`). DOM-dependent tests load anonymised captured bexio HTML from `packages/chrome-extension/test/fixtures/bexio/`. The repo is public: fixtures are recaptured with the script in that folder's `README.md` and built with `npm run fixtures:build` (real names stay in the main checkout's git-ignored `_raw/anonymise.local.json`), and `scripts/bexio-fixtures/committed-fixtures.test.ts` fails on any committed fixture carrying a token, e-mail address or UUID. "Test" in the release docs (`RELEASE.md`) still refers to the manual in-browser walkthrough — that checklist is in `docs/architecture/testing.md`.

Loading locally: build, then in Chrome → Extensions → Load unpacked → select the `unpacked/` folder.

### Handing a build over for manual testing

Whenever a change needs to be verified by the user in a real browser, **run `npm run build:test` in the checkout that holds the code under test** — the main checkout or any worktree — and tell the user the version it printed. Never ask for a manual test without one.

```bash
npm run build:test
```

The user has loaded exactly one folder in Chrome and never changes it:

```
E:\git\soulcode\bexio-chrome-extension\unpacked
```

`scripts/build-test/build-test.ts` runs a full `Build.ps1 -Development` (with `NODE_ENV=development`) in the current checkout, replaces the content of the **main checkout's** `unpacked/` with the result, and stamps the version `<release version>.<build number>` (e.g. `1.8.2.7`) into that copy's `manifest.json` only. The user then clicks reload on chrome://extensions and must see that version there. `build-info.json` in the same folder records branch, commit, uncommitted changes and source checkout.

**Why one fixed folder.** Chrome derives an unpacked extension's id from its folder path, and `chrome.storage.local` (templates, settings) belongs to that id. Loading a worktree's `unpacked/` gives an extension with empty storage and a second copy of every content script on the bexio pages. The main checkout's `unpacked/` is the id the user's templates live in (`flkgdpjl…`). The worktree's branch does not need to be checked out there — only the build output moves.

**Why the fourth version part.** The number is how the user tells _which_ build is loaded when several follow each other, possibly from different worktrees. It counts in `.git/bexio-test-build-number` (the git common dir, shared by all worktrees) and is written into the build output only, so no tracked file changes. (The previous handover flow bumped the patch in `package.json` and `public/manifest.json`; such a bump reaching `main` makes release-please propose a wrong version — versions belong to the release process, `docs/architecture/publishing.md`.) A **three-part** version on chrome://extensions means a plain build overwrote the folder since: any `Build.ps1` run in the main checkout writes the same `unpacked/` — including the build smoke test in `npm test` there, and `npm run test:e2e` there when `unpacked/manifest.json` is missing. Rerun `npm run build:test`.

**`npm run <script> -- -Flag` loses its flags in PowerShell.** PowerShell treats the `--` as its own end-of-parameters marker, so npm never forwards anything and `Build.ps1` runs with all switches at their defaults — a production build where a dev build was intended, and `-IgnoreExtension`/`-IgnoreSidePanel` are dropped the same way. Nothing fails; the only tell is Vite printing `building client environment for production...`. Verified on PowerShell 7.6.4 (2026-08-14). `npm run build:test` takes no flags, so it is safe from either shell; for other flag-carrying scripts use bash, or call `powershell -File Build.ps1 -Development` directly.

**Plain builds must be full builds — never `-IgnoreSidePanel`.** `packages/chrome-extension/vite.config.js` sets `outDir: "../../unpacked"` with `emptyOutDir: true`, so the extension build **empties the whole `unpacked/` folder**; Build.ps1 then rebuilds the side panel into `unpacked/sidePanel-import/`. In a full build the order saves you. An extension-only build does not merely skip the side panel — it _deletes_ the one already there, and nothing fails: Chrome loads the folder, the injected template UI still works, and only opening the side panel reveals `ERR_FILE_NOT_FOUND`. The same applies to `-IgnoreExtension` in reverse. `Build.ps1` now prints a warning when `unpacked/sidePanel-import/index.html` is missing after a build, but do not rely on spotting it — just build both.

**`build:test` sets `NODE_ENV=development` so the console warnings can be read.** `-Development` only turns off minification; which React build gets bundled follows `NODE_ENV` when Vite resolves react-dom's export conditions. Without it you get `react-dom.production`, which logs no `validateDOMNesting`, no hydration errors and none of antd's deprecation warnings — a clean console that proves nothing. Check with `grep -o "react-dom.development\|react-dom.production" unpacked/sidePanel-import/assets/index-*.js`. (This is also why the build smoke test produces a DEV bundle: Vitest sets `NODE_ENV=test`, which the child process inherits.)

## Releases

Run `npm run createRelease` (`CreateRelease.ps1`); see `RELEASE.md`. It bumps the version (`version:patch|minor|major`, which only edits `package.json` — `--no-git-tag-version`), runs `build:newExtensionRelease`, regenerates `CHANGELOG.md` via `git-cliff` (config in `cliff.toml`), runs `version:updateManifest` (`updateManifest.js` copies `package.json` version into `packages/chrome-extension/public/manifest.json` and stamps the build date into `package.json`), then commits as `Release: <version>`, tags, and fast-forward-merges the tag into `main`. The dev branch is `develop`. For the automated CI release path (`release-please` → Chrome Web Store via GitHub Actions, recommended), see `docs/architecture/publishing.md`.

## Architecture notes

- **Content scripts** are declared in `packages/chrome-extension/public/manifest.json`, keyed by bexio URL:
  - `monitoring/edit*` → `src/apps/bexioTimetrackingTemplates/index.ts` — the template save/apply UI injected into the time-entry form.
  - `monitoring/list`, `monitoring/list/*`, `pr_project/listMonitoring/*`, `pr_project/showPackage/*`, `kb_invoice/show/id/*` → `src/apps/bexioProjectList/index.ts` — the tooltip→text replacement (`convertPopover`), driven by `MutationObserver`s because bexio re-renders tables.
- **Service worker** (`public/service_worker.js`, plain JS): opens the bexio time tracking tab on toolbar-icon click, and enables/configures the side panel (`/sidePanel-import/index.html`) only on `office.bexio.com/index.php/monitoring*` tabs. One helper (`configureSidePanel`) does the per-tab enable/disable; it runs from `chrome.tabs.onUpdated` for navigations **and** from `chrome.runtime.onInstalled`/`onStartup`, which sweep the already-open monitoring tabs via `chrome.tabs.query` — otherwise a tab that was open before an install, unpacked load or extension reload never gets its panel enabled and the toolbar icon appears to do nothing. The manifest declares no `side_panel.default_path` on purpose. The worker also relays the content script's `{ mode: "openSidePanel" }` message to `chrome.sidePanel.open` for the sender's tab (synchronously, because the user gesture does not survive an `await`).
- **Side panel ↔ content script messaging**: the React app sends `chrome.tabs.sendMessage` payloads typed as `ExchangeRequestData` (`packages/shared/types.ts`: `mode: "template" | "time+duration" | "reload" | "submit"`) through the single helper `packages/sidePanel-import/src/utils/sendToBexioTab.ts`, which reports "no tab" / "no content script" failures to the user via an antd `message` toast. Toasts go through `src/utils/messageApi.ts`' `getMessageApi()`, never through antd's static `message.*`: the static API renders into its own React root and cannot see the `ConfigProvider` theme (antd warns about it). `main.tsx` wraps the app in antd's `<App>` and `MessageApiBridge` publishes that context instance to the module-level holder, which is what lets non-component code like `sendToBexioTab` use it; it falls back to the static API when no bridge is mounted. The content script handles them in `src/eventListeners/onMessage.ts` — a sync dispatcher that returns `true` and always answers with an `ExchangeResponse` (`{ ok: true }` / `{ ok: false, error }`) — calling `fillForm` (apply a template — awaited, so `{ ok: true }` means "filled"), `triggerDuration`/`triggerDate`/`triggerDescription`/`triggerCheckbox` (apply a ManicTime entry), `submitMonitoringForm` (click bexio's save button — only ever on the user's explicit 📤 click in the panel, never automatically), or re-initializing the page UI. The one message in the other direction is `{ mode: "form-submitted" }` (`src/eventListeners/onFormSubmit.ts`, via `chrome.runtime.sendMessage`): the content script sends it whenever `#MonitoringForm` submits, and the panel then marks the entry waiting on 📤 as ✅. The contract is documented in `docs/architecture/form-layer.md` ("Messaging contract").
- **Manipulating bexio's form** is fiddly: the page uses jQuery/select2 widgets, so `src/utils/trigger*.ts` and `src/utils/waitFor*.ts` simulate input events and poll for async-loaded options; `src/selectors/` centralizes the DOM selectors. When bexio markup changes, those two folders are where breakage lives.
- **Persistence**: everything is `chrome.storage.local` via `packages/shared/chromeStorage*.ts` — `chromeStorageTemplateEntries` (templates) and `chromeStorageSettings` (UI prefs like active tab, "apply notes", "capitalize notes"). The ManicTime import buffer has no wrapper module — `ImportEntries.tsx` writes its five keys through raw `chromeStorage` calls (issue #125 removed the unused `chromeStorageImportData`). Templates are `TemplateEntry` objects (`types.ts`). Both the side panel and the content script write the `"entries"` key, so `TemplateProvider.tsx` subscribes to `chrome.storage.onChanged` and re-reads when it changes — that is what makes a template saved on the bexio page show up in an already-open side panel (and matchable by "Auto map templates"). The 🔄 button in the panel header is the manual version of the same reload. See `docs/architecture/storage.md`.
- **ManicTime import flow** lives in `packages/sidePanel-import/src/components/ImportEntries/` — clipboard CSV is parsed (`utils/csvParser.ts`), entries are auto-matched to templates (`AutoMapTemplatesV3.ts`, also checks template `keywords`), and applying an entry posts an `EntryExchangeData` (and optionally a `TemplateExchangeData`) message to the content script.
  - `handleCsvData` (the TSV parser) normalizes the whole pasted block once — strips every `\r`, `trimEnd()`s, splits on `\n` and drops blank lines — so the header, the data rows and the footer are treated identically. The **last non-empty line is always the footer** (the ManicTime totals row): it is display-only and must never end up in `importData`, because data rows render ▶️ apply buttons in their date columns and a click books that duration into bexio. Every data row must then have exactly the header's column count; a mismatch throws, and the message surfaces through `ImportEntries`' `parseStatus`. Downstream consumers (`autoMapTemplatesV3`, `getNotes`) still fall back to `""` for a missing cell, because an import buffer persisted by an older version can hold a short row.
  - `frozenColumns.ts` decides which columns of the import table stay pinned to the left while the date columns scroll: `#`, `Template` and every import column **before the first date column** (`DATE_COLUMN_REGEX`, which `ImportEntriesTableCell` also uses to place the ▶️ buttons). A header without any date column pins nothing. Columns keep their **content-driven widths** — nothing sets a width or clips, so no value is ever cut; long values wrap. The pixel offsets are therefore not computable and get measured by `useFrozenColumnOffsets`, which publishes them as `--frozen-left-<position>` custom properties on the table (jsdom has no layout, so only the wiring is unit-testable — the pixels are a manual browser check). Two layout rules make it work and are easy to undo by accident: `.importDataTableWrapper` needs its `max-height`, because the sticky header sticks inside the _scroll container_ and without a bounded height that box never scrolls vertically; and `body` must not be a flex container (`index.scss`), or `#root` gets sized by the table and the whole panel scrolls sideways again. The even-row stripe has to stay **opaque** or the scrolling cells bleed through the pinned ones. Known limit: with many `Tag` columns the pinned block (559px measured with four tags) can exceed a narrow panel entirely, and the panel has to be dragged wider. Design: `docs/superpowers/specs/2026-08-05-frozen-import-columns-design.md`.

## Architecture deep-dives

Detailed, behaviour-pinned docs for the topics that have a test suite — **read the relevant one before changing the corresponding code**:

- `docs/architecture/storage.md` — `chrome.storage.local` model, the `entries` key, settings keys, the `TemplateEntry` shape, the array-only assumptions in `chromeStorage.remove`/`update`, known issues.
- `docs/architecture/form-layer.md` — the bexio jQuery/select2/jQuery-UI form, the synthetic-event recipe per field type (`trigger*`), the `waitFor*` polling, the `fillForm` order + `timeEntryBillable` rule, the read-back path, the module-load quirk, and a "blast radius" map of fragile selectors.
- `docs/architecture/tooltip-replacement.md` — which bexio pages get the tooltip→text treatment, the per-page `MutationObserver` setup, the convert/revert cycle, the "Text | Tooltip" toggle in bexio's page title bar, known issues.
- `docs/architecture/build-and-release.md` — the workspace layout, `Build.ps1` flag matrix, the Vite + `@crxjs/vite-plugin` quirks, the `createRelease.ps1` sequence, the gotchas (`Build.ps1`'s fail-fast exit codes and package assertion).
- `docs/architecture/testing.md` — the three test layers, the commands, the chrome fake, the module-load quirk, the fixture-capture procedure, and the manual real-bexio walkthrough checklist.
- `docs/architecture/publishing.md` — the two release paths, the `release-please` Release-PR concept, conventional-commit rules, the Chrome Web Store workflow + its secrets, and the recovery procedures.

The design spec and implementation plan that produced this suite are in `docs/superpowers/specs/` and `docs/superpowers/plans/`.

## Conventions

- Prettier: 2-space indent, no tabs, `printWidth` 120 (`.prettierrc`).
- Vite alias `~` → that package's `src/` in `sidePanel-import`.
- `.npmrc` sets `save-exact=true` and `ignore-scripts=true`; dependency versions in `package.json` files are pinned (no `^`).
- Do not edit `manifest.json`'s `version` by hand — it's generated by `updateManifest.js` during release. The display strings in `package.json` `description`/`date` are likewise touched by tooling.
- **Prefer merge commits when landing a pull request.** Commit hashes should stay stable: a merge commit is the only one of GitHub's three methods that lets the branch's commits reach `main` with the SHAs they already had. Do not reach for a rebase merge as the substitute just because it produces linear history — that rewrites every commit it replays, which invalidates anything referencing them (`.git-blame-ignore-revs`, `git bisect` notes, `Fixes: <sha>` trailers, SHA links in issues and PRs). Reserve rebase for a branch whose SHAs nothing points at, and say so when you use it.
- **Keep the merge commit's _body_ free of a conventional-commit line**, or the PR lands in `CHANGELOG.md` twice. `release-please` parses every commit since the last release, and a GitHub merge commit's subject (`Merge pull request #N from …`) is not conventional, so it would be skipped — except the repository's `merge_commit_message` setting is `PR_TITLE`, which copies the PR title into the body, and that _is_ conventional. Both the branch commit and the merge commit then produce an entry. It is why 1.9.0's changelog carries eight duplicated lines. The permanent fix is the repository setting (`gh api -X PATCH repos/SoulcodeAgency/bexio-chrome-extension -f merge_commit_message=BLANK`); until that is set, merge with an empty body:

  ```bash
  gh pr merge <N> --merge --subject "Merge pull request #<N> from SoulcodeAgency/<branch>" --body ""
  ```

  Squash merges do not have the problem — `release-please` recognises GitHub's `(#N)` squash subject and counts it once — but they collapse the branch's SHAs, which is what the rule above exists to prevent.
