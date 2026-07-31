# Testing Architecture

This document describes the three-layer test strategy for the bexio Chrome Extension:
Vitest unit/integration tests (the safety net), an opt-in Playwright extension-smoke layer,
and a manual real-bexio walkthrough checklist.

---

## 1. The three test layers

| Layer | Tool | When to use | Files |
| --- | --- | --- | --- |
| **Vitest unit / integration** | Vitest + jsdom | Every PR / CI run — the main safety net | `packages/*/test/**/*.test.ts(x)` |
| **Build smoke** | Vitest (slow) | Included in `npm test`; skip with `npm run test:fast` | `packages/*/test/**/*.slow.test.ts` |
| **Playwright extension smoke + behaviour** | Playwright + real Chromium | Runs in CI (via Xvfb); opt-in locally | `e2e/*.spec.ts` |
| **Manual real-bexio walkthrough** | Human + real browser | Before each release — the residual, fixture-drift risk | See Section 8 |

The Vitest suite is the primary safety net: it is fast (< 5 s without the slow build smoke test),
runs in CI without a display, requires no built artifact, and pins current behaviour so refactors
get caught early.

The Playwright layer is not part of `npm test` and requires a built `unpacked/` plus a one-time
`npx playwright install chromium`. CI runs it as its own step (see Section 7). It has two specs:
`extension-smoke.spec.ts` (do the content scripts inject, does the side panel mount) and
`extension-behaviour.spec.ts` (issue #66: text-mode toggle round-trip, template apply, template
filter, the Add/Delete dialog flows).

---

## 2. Commands

```
npm test              # All Vitest projects, including the slow build smoke test
npm run test:fast     # All Vitest projects, excluding *.slow.test.ts files
npm run test:watch    # Vitest in watch mode (useful during development)
npm run test:e2e      # Playwright smoke + behaviour specs (separate; CI runs it via Xvfb)
```

The interactive Vitest UI is not wired up (it needs the `@vitest/ui` dependency, which we
deliberately don't add). If you want it for a debugging session:
`npm i -D -E @vitest/ui && npx vitest --ui`.

### `npm run test:e2e` prerequisites (one-time setup)

1. Install the Playwright Chromium browser:
   ```
   npx playwright install chromium
   ```
   This step is required because `.npmrc` has `ignore-scripts=true`, which
   suppresses the post-install browser download.

2. Build the unpacked extension:
   ```
   npm run build:project -- -Development
   ```
   The built extension lands in `unpacked/`. If `unpacked/manifest.json` already
   exists the E2E test skips the build step automatically.

---

## 3. Vitest workspace — three projects

The root `vitest.config.ts` (via its `test.projects` array) defines three projects. (There is also a `vitest.workspace.ts`, kept as a tombstone with a comment — Vitest 4 deprecated the standalone workspace file in favour of `test.projects`, so that file is *not* what's loaded.)

| Project | Root | Environment | What it tests |
| --- | --- | --- | --- |
| `shared` | `packages/shared` | `node` | Storage helpers, template utilities |
| `chrome-extension` | `packages/chrome-extension` | `jsdom` | Selectors, content scripts, form utils |
| `sidePanel-import` | `packages/sidePanel-import` | `jsdom` | The ManicTime TSV parser (`csvParser.test.ts`), the short-row guards (`importGuards.test.tsx`) and the parse → import table rendering (`importEntries.test.tsx`, via `@testing-library/react`) |

The `sidePanel-import` project has two extra setup details: the `~` alias (that package's Vite
alias for its `src/`) is mirrored in `vitest.config.ts`, and
`packages/sidePanel-import/test/support/setup-dom.ts` shims `matchMedia`/`ResizeObserver`,
which antd's internals expect but jsdom does not implement.

### The in-memory `chrome.*` fake

All tests run with an in-memory fake for `chrome.storage.local` and `chrome.runtime` (see
`test/support/chrome-fake.ts` and `test/support/setup-chrome.ts`). The fake is installed on
`globalThis.chrome` before each test file runs, and reset (`chrome.storage.local` cleared,
`chrome.runtime.onMessage` listeners cleared) in a `beforeEach` hook so tests are isolated.

**The fake throws loudly** if any code path reaches for an unimplemented `chrome.*` member
(e.g. `chrome.tabs`, `chrome.sidePanel`). This is intentional — it surfaces new Chrome API
usage immediately rather than silently returning `undefined`.

---

## 4. Module-load quirk — always load the fixture first

Several source modules evaluate `document.querySelector(...)` at module-evaluation time
(top-level code, not inside a function). Examples:
`packages/chrome-extension/src/selectors/selectors.ts`,
`packages/chrome-extension/src/selectors/contactField.ts`,
`packages/chrome-extension/src/selectors/billableCheckbox.ts`.

Because jsdom's `document` is empty at module-load time, importing these modules *before*
populating `document.body` captures `null` selectors that will never update.

**The pattern every such test must follow:**

```ts
beforeEach(() => {
  vi.resetModules();          // discard the cached module so it re-evaluates next import
  document.body.innerHTML = "";
});

it("...", async () => {
  loadFixture("monitoring-edit");               // sets document.body.innerHTML first
  const { mySelector } = await import(          // then import: module evaluates with real DOM
    "@bexio-chrome-extension/chrome-extension/src/selectors/mySelector"
  );
  // ...
});
```

Always import the **specific utility module**, never an app entry point
(`packages/*/src/apps/*/index.ts`), because entry points run side effects
(event listener registration, storage reads) at import time.

---

## 5. Fixture capture procedure

Cleaned, anonymised HTML fixtures live in
`packages/chrome-extension/test/fixtures/bexio/`.
The procedure is documented in full in
`packages/chrome-extension/test/fixtures/bexio/README.md`; summary:

1. Open the target bexio page in Chrome while logged in.
2. Open DevTools → Console and run the `copy(...)` snippet from the README table
   for that page.
3. Paste the copied HTML into a new file under
   `packages/chrome-extension/test/fixtures/bexio/_raw/<name>.html`
   (`_raw/` is git-ignored).
4. Run the anonymise/trim pass: `node packages/chrome-extension/test/fixtures/bexio/_raw/__build-fixtures.cjs`
   (this script strips scripts, anonymises names, and trims table rows).
5. Write the sibling `<name>.md` documenting the source URL, capture date,
   what was trimmed, and the anonymisation applied.
6. The cleaned `*.html` and `*.md` files are committed; the `_raw/` directory
   is never committed.

**Currently captured fixtures:**
- `monitoring-edit.html` — the time-entry edit form (empty)
- `monitoring-edit-filled.html` — the same form with values pre-filled
- `monitoring-edit.tinymce-iframe.html` — the TinyMCE iframe body
- `monitoring-list.html` — full-body capture of the time-entry list (with `.globalsearch` so renderHtml can inject its toggle button; rows trimmed to 12)
- `pr_project-listMonitoring.html` — a project's times tab (trimmed rows)
- `pr_project-showPackage.html` — a work-package's times tab (trimmed rows)
- `kb_invoice-show.html` — full-body capture of an invoice with the "Zeiten importieren" modal open; the modal's table rows trimmed to 12. Path through the UI: **Verkauf → Rechnungen → \<invoice\> → Positionen → "Weitere Positionen" → "Zeit/Leistung"**.

---

## 6. Build smoke test caveat

`packages/chrome-extension/test/build-smoke.slow.test.ts` shells out to
`Build.ps1` and asserts that:
- `unpacked/manifest.json` exists and parses correctly
- the manifest's `version` field matches the root `package.json` version
- every file referenced in the manifest's `content_scripts` and `background`
  sections exists in `unpacked/`

The test is guarded by `describe.skipIf(!hasPowerShell())`, so it is silently
skipped on machines without PowerShell (`pwsh` on Linux/macOS, `powershell`
on Windows). The test is excluded from `npm run test:fast` (`.slow.test.ts`
suffix) but is included in `npm test`.

It invokes that same interpreter directly (`<pwsh|powershell> -File Build.ps1
-Development`) rather than going through `npm run build:project`, because the
npm scripts hardcode `powershell` — which exists only on Windows. Going through
the npm script made the test fail on the Linux CI runner with
`sh: 1: powershell: not found`, even though `pwsh` was installed.

---

## 7. Playwright e2e layer — implementation notes

There are two specs, sharing the launch/fixture helpers in `e2e/support.ts`:

- `e2e/extension-smoke.spec.ts` — injection-level: template UI appears on
  `monitoring/edit`, the side panel mounts, the "Text mode" toggle appears
  on `monitoring/list`.
- `e2e/extension-behaviour.spec.ts` — behaviour-level (issue #66): the
  text-mode toggle round-trip (convert → revert), applying a template through
  the real `fillForm` synthetic-event path, the template filter, and the
  Add/Delete flows whose `prompt()`/`confirm()`/`alert()` dialogs are handled
  via `page.on("dialog")`.

Both use `chromium.launchPersistentContext` with `--load-extension=<unpacked>`
flags because Chrome extensions can only be loaded into a persistent context,
not a regular `browser` fixture. The anonymised fixtures are served via
`page.route()`, so **no bexio credentials are needed**.

### The bexio-form stub (template-apply test)

The fixtures are static HTML — the anonymiser strips bexio's JavaScript
(jQuery, select2, jQuery-UI autocomplete). The extension's `waitFor*` helpers
poll for DOM that only those widgets create (`#select2-drop`, `.ac_results`),
so the template-apply test injects a minimal stub (`installBexioFormStub`)
that reacts to the extension's synthetic events exactly where the real widgets
would: it pre-populates the underlying `<select>`s (bexio loads them via AJAX),
opens `#select2-drop` on Enter, applies the searched value to the `<select>`
and the `.select2-chosen` span, and shows a visible `.ac_results` for the
contact field. What is being tested is the extension's orchestration
(`fillForm`, `trigger*`, `waitFor*`) — not bexio's widgets. When bexio's real
markup or widget behaviour changes, that drift is caught by the manual
walkthrough (Section 8), not by this stub.

### Headless mode and service workers

MV3 extensions use a service worker for the background script. In Playwright
1.60+ / Chromium 148+, MV3 service workers **do not surface via
`context.serviceWorkers()`** when launched in headless mode. `e2e/support.ts`
therefore launches with `headless: false`. This opens a visible Chromium
window for the duration of the test run (~10 s locally).

On a headless CI machine, the run is wrapped with `Xvfb` — this is exactly
what `.github/workflows/node.js.yml` does:
```sh
xvfb-run --auto-servernum npm run test:e2e
```

### Extension ID and storage seeding

The extension ID is derived from the service worker URL:
```
chrome-extension://<id>/service-worker-loader.js
                  ^^^^
```
`context.serviceWorkers()[0].url()` gives the full URL; `new URL(...).host`
extracts the ID. If the array is empty on startup, `launchExtensionContext`
opens a blank page, waits 2 s, then re-checks. If the service worker still
cannot be found, the tests that need it (side panel; every behaviour test
that seeds storage) are skipped with `test.skip(...)`.

The behaviour tests seed `chrome.storage.local` by evaluating inside that
service worker (`serviceWorker.evaluate((v) => chrome.storage.local.set(...), v)`)
— the only context Playwright can reach that has `chrome.storage` access.

---

## 8. Manual real-bexio walkthrough checklist

This checklist is **run by a human** against a real bexio account before each
release. Most items now have automated fixture-based counterparts in
`e2e/extension-behaviour.spec.ts` (issue #66) — the notes per section say
which. The manual run still matters because the fixtures drift as bexio
changes; verifying against **live** bexio is what keeps that residual risk in
check (and the capture procedure in Section 5 is what keeps the fixtures
honest). A Playwright-against-real-bexio spec would require real credentials
and remains out of scope.

### Setup
1. Build the extension: `npm run build:project -- -Development`
2. Open Chrome → `chrome://extensions/` → enable "Developer mode" → "Load unpacked"
   → select the `unpacked/` directory.
3. Log into your bexio account in the same Chrome profile.

### 5.1 — `monitoring/edit`: Templates block

*Automated (on fixtures): items 2–6 — injection (smoke spec), filter, Add
(prompt), template apply, Delete (confirm) — in `extension-behaviour.spec.ts`.
The live-bexio run additionally exercises the real select2/AJAX widgets.*

1. Navigate to `https://office.bexio.com/index.php/monitoring/edit`
   (or open an existing time entry).
2. Confirm the **Templates** block appears below the form (an `#SoulcodeExtensionTemplates`
   section with a filter input and template buttons if any are saved).
3. Type in the filter input — confirm the button list filters live.
4. Fill in a few form fields, then click **Add** in the Templates block.
   Confirm a new template button appears with the form's values.
5. Click a template button — confirm the form fields are populated with
   that template's values.
6. Click **Delete** on one template — confirm a browser `confirm()` dialog
   appears, confirm it, and confirm the button disappears.

### 5.2 — `monitoring/list` + project/package tabs: Text-mode toggle

*Automated (on fixtures): items 1–3 — the toggle round-trip on
`monitoring/list` — in `extension-behaviour.spec.ts`. The project/package
tabs (item 4) are still manual-only.*

1. Navigate to `https://office.bexio.com/index.php/monitoring/list`.
   Confirm a **"Text mode"** toggle button appears in the page header.
2. Click the toggle — confirm tooltip popover icons (`<i rel="popover">`) are
   replaced by inline text.
3. Click the toggle again — confirm the page reverts to the original popover icons.
4. Repeat on a project's Times tab (`pr_project/listMonitoring/...`) and a
   work-package's Times tab (`pr_project/showPackage/...`).

### 5.3 — Side panel: Templates and Import tabs

*Automated: item 5 (parse → table, incl. billable icons and ▶ buttons) runs
as a jsdom Vitest test in `packages/sidePanel-import/test/importEntries.test.tsx`;
the side panel mounting is covered by the smoke spec. Items 3 and 6
(tab persistence, cross-tab message to the bexio form) are still manual-only.*

1. On any bexio page (`https://office.bexio.com/index.php/monitoring/...`),
   click the extension icon (or the browser side-panel button) to open the
   side panel.
2. Confirm the **Templates** and **Import** tabs are visible and clickable.
3. Switch between tabs — confirm the active tab persists after closing and
   re-opening the side panel (stored in `chrome.storage.local` under `activeTabId`).
4. Switch to the **Import** tab. Paste a ManicTime clipboard export (TSV format)
   into the import text area.
5. Confirm the parsed rows populate the import table.
6. Click the ▶ (play / fill) button on one row — confirm the
   `monitoring/edit` form in the main tab is populated with that entry's values.

### 5.4 — `kb_invoice` tracked-time tooltip (`kb_invoice/show/id/*`)

On an invoice detail page, navigate **Positionen → "Weitere Positionen" →
"Zeit/Leistung"** to open the "Zeiten importieren" modal. Toggle "Text mode" via
the `#PopoverTextSwitcher` button in the bexio nav — the info-icon popovers in
the modal table should turn into inline text and the rows should pick up the
alternating background colours. Toggle back and confirm the modal reverts. The
fixture `kb_invoice-show.html` covers the same DOM under `test/fixtures/bexio/`.
