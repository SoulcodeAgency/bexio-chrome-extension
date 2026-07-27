# Design: Test harness & developer-documentation foundation for topics 4–7

**Date:** 2026-05-12
**Status:** Approved (pending written-spec review)
**Author:** brainstorming session (Fabian Gander + Claude)

> **Update 2026-05-13:** Spec approved. Raw bexio fixtures captured (all except `kb_invoice-show`, which is deferred — see "Fixture loader" below). Implementation planning started.

## Background

The bexio Chrome extension has no automated tests and only user-facing documentation. We have split the project into seven topics; topics 1–3 (template UI on the bexio form, the side-panel app shell, the ManicTime import/auto-mapper) are deprioritised. This effort targets the remaining four:

- **Topic 4 — Tooltip → text replacement:** `packages/chrome-extension/src/apps/bexioProjectList/`, `src/utils/convertPopover.ts`, `src/selectors/projectTable_TextCell.ts`.
- **Topic 5 — Form-manipulation layer:** `packages/chrome-extension/src/selectors/*`, `src/utils/trigger*.ts`, `src/utils/waitFor*.ts`, `src/utils/fillForm.ts`, `src/utils/readFormData.ts`, `src/utils/readTextFromSelect2.ts`, `src/utils/loader.ts`, `src/utils/delay.ts`, `src/utils/pressEnter.ts`, `src/utils/trimAll.ts`.
- **Topic 6 — Storage & shared helpers:** `packages/shared/*` (`chromeStorage*.ts`, `sortTemplates.ts`, `getTemplateName.ts`, `confirmTemplateDeletion.ts`, `types.ts`).
- **Topic 7 — Build & release tooling:** npm workspaces, `Build.ps1`, `CreateRelease.ps1`, `updateManifest.js`, the Vite + `@crxjs/vite-plugin` pipeline, `git-cliff`/`cliff.toml`.

## Goal

Establish a **reproducible test harness** and a **developer knowledge base** for topics 4–7, so that subsequent code improvements have a safety net and a written reference. This spec covers the foundation only; refactors and bug fixes are explicitly deferred to follow-up specs.

## Non-goals (out of scope for this spec)

- Any refactor or bug fix of topics 4–7. Tests pin **current** behaviour, bugs included.
- Any work on topics 1–3.
- Converting untyped / loosely-typed files to strict TypeScript (`packages/chrome-extension/public/service_worker.js`, `src/utils/generateHash.ts`, the implicit `any`s in `convertPopover.ts` / `onMessage.ts`). Noted as a follow-up because it affects testability, but not done here.
- Testing React components in `packages/sidePanel-import` (topic 2/3 territory). Only the pure utils there (`csvParser.ts`, `AutoMapTemplatesV3.ts`) are in scope, and only insofar as they are topic-3-adjacent shared logic — see "Open question" below.
- Setting up a CI pipeline (GitHub Actions). Scripts will be CI-ready, but no workflow file is added unless requested.
- Automated end-to-end testing against a live bexio account. Documented as a manual, local-only procedure; a candidate for a future spec.

## Decisions taken during brainstorming

| Question | Decision |
| --- | --- |
| Deliverable scope | Test harness + docs only; code improvements are separate later specs. |
| DOM fixture source | Real captured bexio HTML, committed and anonymised. (Synthetic fixtures only as a stopgap if captures are slow.) |
| Test runner & layout | Vitest, configured once at the repo root as a workspace with per-package projects. |
| Documentation location | `docs/architecture/` with one markdown file per topic, linked from `CLAUDE.md`, plus targeted TSDoc comments. |
| Work structure | Infra first (Phase 1), then breadth across topics (Phase 2) in order 6 → 7 → 4 → 5. |
| E2E | jsdom + fixtures is the backbone; add a thin opt-in Playwright extension-smoke layer; real-bexio E2E is manual-only and documented, not automated. |

## Architecture

### Test layers

1. **Unit / integration (Vitest)** — the backbone. Three workspace projects:
   - `shared` — `environment: 'node'`. Storage wrappers and pure helpers. Uses the in-memory `chrome.storage` fake.
   - `chrome-extension` — `environment: 'jsdom'`. DOM code: `selectors/`, `utils/trigger*`, `utils/waitFor*`, `convertPopover`, `fillForm`, `readFormData`, `loader`, etc. Uses the chrome fake **and** the bexio-HTML fixture loader. Fake timers for anything touching `delay` / `waitFor*`.
   - `sidePanel-import` — `environment: 'node'`. Only the pure utils we choose to cover (`csvParser`, `autoMapTemplatesV3`); no React rendering.
2. **Extension smoke (Playwright)** — separate, opt-in. Builds the extension, loads `unpacked/` into real Chromium, opens captured fixture pages, asserts the content scripts inject and the side panel renders without throwing, manifest wiring valid. Not part of `npm test`.
3. **Manual real-bexio walkthrough** — documented checklist in `docs/architecture/testing.md`; a developer runs the unpacked build against their own bexio login. Not automated.

### Test infrastructure (Phase 1)

- **Runner:** add `vitest` (and `jsdom`) as root `devDependencies`, pinned (`.npmrc` `save-exact`). Add `@vitest/ui` only if desired.
- **Workspace config:** `vitest.workspace.ts` at repo root defining the three projects above, each with its `environment`, `include` globs (`packages/<pkg>/**/*.test.ts`), and `setupFiles` as needed.
- **Chrome API fake:** `test/support/chrome-fake.ts` (or per-package equivalent) — a hand-rolled in-memory implementation of `chrome.storage.local` (`get`, `set`, `remove`, `clear`, returning Promises) plus minimal `chrome.runtime` stubs (`onMessage.addListener` no-op, `sendMessage`). Anything not implemented throws loudly. Installed via Vitest `setupFiles` for the `shared` and `chrome-extension` projects. No external mock library.
- **Fixture loader:** captured bexio HTML in `packages/chrome-extension/test/fixtures/bexio/<page>.html`. Expected fixtures:
  - `monitoring-edit.html` — the time-tracking entry form (`/index.php/monitoring/edit`). **Highest priority** — topic 5 depends on it.
  - `monitoring-list.html` — the time-tracking list (`/index.php/monitoring/list`).
  - `pr_project-listMonitoring.html` — project times (`/index.php/pr_project/listMonitoring/*`).
  - `pr_project-showPackage.html` — work-package times (`/index.php/pr_project/showPackage/*`).
  - `kb_invoice-show.html` — invoice "tracked time" modal (`/index.php/kb_invoice/show/id/*`). **Not captured this round:** the "weitere Positionen → erfasste Zeit" path appears to have changed/disappeared in current bexio, so this fixture is deferred and the `kb_invoice/show` content-script path is flagged for a follow-up investigation (verify whether it still works, adapt to the new UI, or remove it). Captured this round: `monitoring-edit.html`, `monitoring-edit-filled.html` (a filled existing entry), `monitoring-edit.tinymce-iframe.html` (the empty tinymce body), `monitoring-list.html`, `pr_project-listMonitoring.html`, `pr_project-showPackage.html`.
  Each fixture has a sibling `<page>.md` recording: source URL, capture date, what was trimmed, and that names/contacts/project data were scrubbed. A `loadFixture(name)` helper reads the file and returns a jsdom `Document` (or installs it as `document` for the test).
- **Build smoke test (topic 7):** a Vitest test in the `node` project (or a small script it invokes) that:
  1. runs `npm run build:project -- -Development`;
  2. asserts `unpacked/manifest.json` exists and parses;
  3. asserts `manifest.version === package.json.version` (root);
  4. asserts every file referenced by the manifest's `content_scripts[].js`, `content_scripts[].css`, and `background.service_worker` exists in `unpacked/`;
  5. asserts `unpacked/sidePanel-import/index.html` exists.
  Plus a focused unit test for `updateManifest.js`'s version/date replacement (extract the replace logic to a pure function if practical; otherwise drive it via a temp directory). This test is slow-tagged so a `test:fast` variant can skip it; the default `npm test` includes it.
- **Scripts (root `package.json`):**
  - `test` — run all Vitest projects (includes the build smoke test).
  - `test:fast` — Vitest excluding the slow-tagged build smoke test.
  - `test:watch` — Vitest watch mode.
  - `test:e2e` — Playwright (separate; requires a build + `npx playwright install chromium`).
  - `test:ui` — `vitest --ui` (optional).
  `Build.ps1` / `CreateRelease.ps1` / the release flow are unchanged.

### Playwright extension-smoke layer (Phase 1 or end of Phase 2)

- Add `@playwright/test` as a root `devDependency`, pinned. Chromium installed via `npx playwright install chromium` (documented; not auto-run).
- `e2e/` directory at repo root with `playwright.config.ts`. Run via `npm run test:e2e` only.
- Behaviour:
  1. Build the extension (`npm run build:project -- -Development`), or reuse `unpacked/`.
  2. `launchPersistentContext` Chromium with `--disable-extensions-except=<unpacked>` and `--load-extension=<unpacked>`.
  3. Serve the captured fixture HTML (tiny static server or `file://`) at URLs the content-script `matches` can be made to apply to (route rewriting or a localhost host-permission shim — chosen at implementation time).
  4. Assert: the `monitoring/edit` fixture gets the template-UI root injected; a list fixture gets the "Text mode" toggle button; no uncaught console exceptions; the service worker registered; the side-panel `index.html` loads and renders its React root without throwing.
  - Does **not** test template filling, select2 interaction, or the auto-mapper.

### Documentation (`docs/architecture/`)

New directory with:

- `tooltip-replacement.md` (topic 4) — which bexio pages are affected; the `MutationObserver`-per-page setup and **why** (bexio re-renders tables on its own); the convert/revert cycle; the DOMPurify use; the "Text mode / Popover mode" toggle and the `removePopoversSetting`.
- `form-layer.md` (topic 5) — the select2/jQuery widget problem; the synthetic-event recipe per field type (`triggerField`, `triggerContactField`, `triggerCheckbox`, `triggerDate`, `triggerDescription`, `triggerDuration`, `pressEnter`); why the `waitFor*` polling exists and its timeouts; the `fillForm` field order and the rule that `timeEntryBillable` overrides the template's `billable`; the read-back path (`readFormData` / `readTextFromSelect2`); and a "blast radius" map of which selectors/assumptions are most likely to break when bexio changes markup.
- `storage.md` (topic 6) — the `chrome.storage.local` model; the `entries` key; the `TemplateEntry` shape and its `[key: string]: any` escape hatch; the legacy "`id` was the template name in 0.4.x" note; the settings keys (`applyNotesSetting`, `activeTabId`, `removePopoversSetting`) and their defaults; the array-only assumption in `chromeStorage.remove`/`update`; where each consumer reads/writes.
- `build-and-release.md` (topic 7) — workspace layout; the `Build.ps1` flag matrix (`-Development`, `-IgnoreExtension`, `-IgnoreSidePanel`, `-CreatePackage`); what lands in `unpacked/` vs `dist/`; the crxjs/Vite pipeline quirks (`assetsDir: ""`, `entryFileNames`/`chunkFileNames` hash-stripping, the `../../unpacked` output dir); the full `createRelease.ps1` sequence (version bump → build+package → `git-cliff` changelog → `updateManifest.js` → commit `Release: <v>` → tag → fast-forward merge to `main`); `cliff.toml`; **the gotcha that `Build.ps1` swallows sub-build errors in its `catch` blocks** so a "successful" run can leave `unpacked/` stale; the (likely vestigial) `@swc/core` dependency.
- `testing.md` — how to run the suites (`test`, `test:fast`, `test:watch`, `test:e2e`); the three Vitest projects and their environments; the chrome fake; **the fixture-capture procedure** (open the bexio page logged in, copy the `outerHTML` of the relevant container — IDs to come from `src/selectors/`, trim sensitive data, save to `test/fixtures/bexio/<page>.html`, fill in the sibling `.md`); and the manual real-bexio walkthrough checklist.

`CLAUDE.md` gets a short "Architecture deep-dives" section linking the four topic docs. Targeted TSDoc comments are added only where behaviour is non-obvious: selector rationale, `waitFor*` timeouts, the auto-mapper scoring weights, the `chromeStorage.update`/`remove` array assumption.

## Test plan (Phase 2 — what gets tested per topic)

Order: **6 → 7 → 4 → 5** (work needing no bexio access first; topic 5's DOM tests land once the `monitoring-edit.html` fixture is provided).

### Topic 6 — `shared/`
- `chromeStorage.ts`: `load`/`save`/`remove`/`update`/`clear` round-trips; the array-only assumption in `remove`/`update`; `update` throwing when `updatedEntry` has no id; behaviour when the key is absent.
- `chromeStorageTemplateEntries.ts`, `chromeStorageSettings.ts`, `chromeStorageImportData.ts`: defaults (`loadTemplates` → `[]`; `loadApplyNotesSetting` → `true`; `loadRemovePopoversSetting` → `false`; `loadActiveTabId` → `undefined`); save/load symmetry; the settings key names.
- `sortTemplates.ts`: alphabetical by `getTemplateName`; pin the in-place `.sort` mutation. `getTemplateName.ts`: `templateName` → `id` → `"No template name found"`. `confirmTemplateDeletion.ts`.
- Doc: `docs/architecture/storage.md`.

### Topic 7 — build & release
- The build smoke test (Section: Test infrastructure).
- `updateManifest.js` version/date replacement.
- Doc: `docs/architecture/build-and-release.md`.

### Topic 4 — tooltip replacement
- `selectors/projectTable_TextCell.ts`: `getPopoverNodes` / `getPopoverNodeText` against the four page fixtures.
- `convertPopover.ts`: setting OFF → `revertPopover` path; setting ON → target cells hidden, `.new-popover-text` injected with DOMPurify-sanitised text, HTML entities decoded, alternating row colours, idempotent on repeat calls; `revertPopover` restores the original state.
- `apps/bexioProjectList/index.ts`: test the extractable part — page-path → `MutationObserver` target-node selection; document the observer wiring rather than force a brittle test.
- Doc: `docs/architecture/tooltip-replacement.md`.

### Topic 5 — form-manipulation layer
- `selectors/*` (billable checkbox, contact field, date/description/duration fields, the IDs in `selectors.ts`) resolve against `monitoring-edit.html`.
- `utils/trigger*`: the events dispatched and the resulting DOM/value state, given the fixture + fake timers.
- `utils/waitFor*`: resolve/timeout behaviour with fake timers and mutated fixtures.
- `utils/fillForm.ts`: end-to-end against the fixture — template → all fields triggered in order; `timeEntryBillable` overriding the template's `billable`; loader toggled on then off; submit button focused. `readFormData.ts` / `readTextFromSelect2.ts`: the inverse read path.
- `utils/loader.ts`, `delay.ts`, `trimAll.ts`, `pressEnter.ts`: small focused tests.
- Doc: `docs/architecture/form-layer.md`.

## Testing strategy details

- **Behaviour-pinning, not aspiration.** Tests assert what the code does today. Where that is clearly a bug (e.g. `chromeStorage.update` silently no-ops on an unknown id; `Build.ps1` swallowing sub-build errors; `csvParser.handleCsvData` assuming a footer row exists), the test is written to current behaviour with a `// KNOWN ISSUE:` comment and a note in the topic doc. Fixes are follow-up specs.
- **Fixtures committed and anonymised.** Captured bexio HTML lives in git so tests are reproducible for everyone; names/contacts/project data scrubbed; the sibling `.md` records the capture date so staleness is visible.
- **Fake timers** for everything touching `delay` / `waitFor*` — fast, deterministic, no real `setTimeout` waits.
- **No network, no real Chrome APIs.** The in-memory fake is the only `chrome.*` in unit tests; unimplemented members throw loudly.
- **The build smoke test** is the one slow Vitest test (it shells out to Vite); slow-tagged so `test:fast` skips it. Default `npm test` includes it.
- **No enforced coverage threshold** this round. Target: pure-logic + storage layers well-covered; DOM layers have at least one fixture-backed test per public function. No percentage gate.

## Risks & dependencies

1. **Fixture capture depends on the user.** Topic 5 (and to a lesser extent topic 4) cannot be fully tested until real bexio HTML is provided — most critically `monitoring-edit.html`. Phase 1 and topics 6 & 7 do not need it, so work is not blocked at the start. Exact capture steps will be given. Stopgap: trimmed synthetic fixtures, swapped for real ones later (real preferred per the decision above).
2. **Untyped / loosely-typed files** make some code awkward to test cleanly; tested around this round, "TS-ify" logged as a follow-up.
3. **jsdom ≠ Chrome.** jsdom does not run bexio's jQuery/select2 JS, so `trigger*` tests verify what our code emits and the DOM state it produces, not that bexio's widgets react. Partly mitigated by the Playwright smoke layer (catches "content script crashes on load", manifest wiring); true end-to-end against live bexio is manual-only and a possible future spec.
4. **crxjs/Vite build behaviour** can change between versions and is manifest-sensitive; the smoke test guards the key invariants but cannot catch every packaging regression.
5. **`@swc/core`** is a listed dependency in two packages but, per recent commits ("Getting rid of swc", "Fix esbuild manually"), may be vestigial — noted for `build-and-release.md`, not acted on here.

## Open question (to resolve in the implementation plan or with the user)

`packages/sidePanel-import/src/utils/csvParser.ts` and `components/ImportEntries/AutoMapTemplatesV3.ts` are pure logic and trivially testable, but they belong to topic 3 (ManicTime import / auto-mapper), which is deprioritised. Decision needed: include light behaviour-pinning tests for them now (cheap, and the auto-mapper is flagged in `FAQ.md` as wanting improvement), or leave them entirely until topic 3 is picked up. Default assumption unless told otherwise: **leave them out** of this round to keep scope tight.

## Deliverables checklist

- [ ] `vitest.workspace.ts` + root `devDependencies` (`vitest`, `jsdom`) + `test*` scripts.
- [ ] `chrome.storage` fake + setup files.
- [ ] `loadFixture` helper + `packages/chrome-extension/test/fixtures/bexio/` (real captures, with `.md` siblings).
- [ ] Build smoke test + `updateManifest.js` test.
- [ ] Vitest tests for topics 6, 7, 4, 5 (per the test plan).
- [ ] `@playwright/test` + `e2e/playwright.config.ts` + the extension-smoke test + `test:e2e` script.
- [ ] `docs/architecture/{tooltip-replacement,form-layer,storage,build-and-release,testing}.md`.
- [ ] `CLAUDE.md` "Architecture deep-dives" section + targeted TSDoc comments.
