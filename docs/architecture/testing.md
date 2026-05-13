# Testing Architecture

This document describes the three-layer test strategy for the bexio Chrome Extension:
Vitest unit/integration tests (the safety net), an opt-in Playwright extension-smoke layer,
and a manual real-bexio walkthrough checklist.

---

## 1. The three test layers

| Layer | Tool | When to use | Files |
| --- | --- | --- | --- |
| **Vitest unit / integration** | Vitest + jsdom | Every PR / CI run — the main safety net | `packages/*/test/**/*.test.ts` |
| **Build smoke** | Vitest (slow) | Included in `npm test`; skip with `npm run test:fast` | `packages/*/test/**/*.slow.test.ts` |
| **Playwright extension-smoke** | Playwright + real Chromium | Opt-in, run manually before releasing | `e2e/*.spec.ts` |
| **Manual real-bexio walkthrough** | Human + real browser | Before each release — automated candidates | See Section 5 |

The Vitest suite is the primary safety net: it is fast (< 5 s without the slow build smoke test),
runs in CI without a display, requires no built artifact, and pins current behaviour so refactors
get caught early.

The Playwright layer is opt-in and labelled "extension-smoke" — it is not part of `npm test` and
requires a built `unpacked/` plus a one-time `npx playwright install chromium`.

---

## 2. Commands

```
npm test              # All Vitest projects, including the slow build smoke test
npm run test:fast     # All Vitest projects, excluding *.slow.test.ts files
npm run test:watch    # Vitest in watch mode (useful during development)
npm run test:e2e      # Playwright extension-smoke (separate; opt-in)
```

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

The root `vitest.workspace.ts` defines three projects:

| Project | Root | Environment | What it tests |
| --- | --- | --- | --- |
| `shared` | `packages/shared` | `node` | Storage helpers, template utilities |
| `chrome-extension` | `packages/chrome-extension` | `jsdom` | Selectors, content scripts, form utils |
| `sidePanel-import` | `packages/sidePanel-import` | `node` | *(nothing this round; configured for future use)* |

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
- `monitoring-list.html` — the time-entry list (trimmed rows)
- `pr_project-listMonitoring.html` — a project's times tab (trimmed rows)
- `pr_project-showPackage.html` — a work-package's times tab (trimmed rows)

**Not captured: `kb_invoice-show`.**
The "Tracked time" tooltip path on the invoice page appears to have changed in
bexio (the element path / modal id no longer matches the README snippet).
This page is currently unverified — see the manual walkthrough note in Section 5.4.

---

## 6. Build smoke test caveat

`packages/chrome-extension/test/build-smoke.slow.test.ts` shells out to
`Build.ps1` (via `npm run build:project -- -Development`) and asserts that:
- `unpacked/manifest.json` exists and parses correctly
- the manifest's `version` field matches the root `package.json` version
- every file referenced in the manifest's `content_scripts` and `background`
  sections exists in `unpacked/`

The test is guarded by `describe.skipIf(!hasPowerShell())`, so it is silently
skipped on machines without PowerShell (`pwsh` on Linux/macOS, `powershell`
on Windows). The test is excluded from `npm run test:fast` (`.slow.test.ts`
suffix) but is included in `npm test`.

---

## 7. Playwright extension-smoke — implementation notes

The E2E spec is at `e2e/extension-smoke.spec.ts`. It uses
`chromium.launchPersistentContext` with `--load-extension=<unpacked>` flags
because Chrome extensions can only be loaded into a persistent context, not
a regular `browser` fixture.

### Headless mode and service workers

MV3 extensions use a service worker for the background script. In Playwright
1.60 / Chromium 148, MV3 service workers **do not surface via
`context.serviceWorkers()`** when launched in headless mode. The spec therefore
uses `headless: false`. This opens a visible Chromium window for the duration
of the test run (~3–5 s locally).

On a headless CI machine, wrap the test runner with `Xvfb`:
```sh
xvfb-run --auto-servernum npm run test:e2e
```

Content-script injection (Test 1 — asserting `#SoulcodeExtensionTemplates`)
works correctly in headless mode; only the side-panel test (Test 2) needs
the service worker URL to derive the extension ID.

### Extension ID derivation

The extension ID is derived from the service worker URL:
```
chrome-extension://<id>/service-worker-loader.js
                  ^^^^
```
`context.serviceWorkers()[0].url()` gives the full URL; `new URL(...).host`
extracts the ID. If the array is empty on startup, the spec opens a blank page,
waits 2 s, then re-checks. If the ID still cannot be determined, Test 2 is
skipped with `test.skip(true, ...)`.

### `monitoring/list` test skipped

The `bexioProjectList/renderHtml.ts` content script accesses
`document.getElementsByClassName("globalsearch")[0]` and calls
`insertAdjacentHTML` on it — throwing a TypeError if the element is absent.
The anonymised `monitoring-list.html` fixture was trimmed to remove the
`.globalsearch` navigation element, so the content script throws when served
the fixture. This is documented as a known issue. The test is present but
permanently `test.skip`-ed in the spec. See the manual walkthrough (Section 5.2)
for the corresponding human-run check.

---

## 8. Manual real-bexio walkthrough checklist

This checklist is **run by a human** against a real bexio account before each
release. It is not automated. Each item is a candidate for a future
Playwright-against-real-bexio spec (which would require real credentials and
is explicitly out of scope for this round).

### Setup
1. Build the extension: `npm run build:project -- -Development`
2. Open Chrome → `chrome://extensions/` → enable "Developer mode" → "Load unpacked"
   → select the `unpacked/` directory.
3. Log into your bexio account in the same Chrome profile.

### 5.1 — `monitoring/edit`: Templates block

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

1. Navigate to `https://office.bexio.com/index.php/monitoring/list`.
   Confirm a **"Text mode"** toggle button appears in the page header.
2. Click the toggle — confirm tooltip popover icons (`<i rel="popover">`) are
   replaced by inline text.
3. Click the toggle again — confirm the page reverts to the original popover icons.
4. Repeat on a project's Times tab (`pr_project/listMonitoring/...`) and a
   work-package's Times tab (`pr_project/showPackage/...`).

### 5.3 — Side panel: Templates and Import tabs

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

### 5.4 — `kb_invoice` tracked-time tooltip (currently unverified)

The invoice page's "Tracked time" tooltip modal previously injected by the
`bexioProjectList` content script (`kb_invoice/show/id/*` URL match) appears
to have changed in a recent bexio update. The element path used by the content
script no longer matches the current DOM. **This step is currently unverified
and is listed here as a known gap.** Do not include it in a release sign-off
until it has been re-validated against the current bexio UI.
