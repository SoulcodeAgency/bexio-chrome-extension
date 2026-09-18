# Testing Architecture

This document describes the three-layer test strategy for the bexio Chrome Extension:
Vitest unit/integration tests (the safety net), an opt-in Playwright extension-smoke layer,
and a manual real-bexio walkthrough checklist.

---

## 1. The three test layers

| Layer                                      | Tool                       | When to use                                            | Files                                                     |
| ------------------------------------------ | -------------------------- | ------------------------------------------------------ | --------------------------------------------------------- |
| **Vitest unit / integration**              | Vitest + jsdom             | Every PR / CI run — the main safety net                | `packages/*/test/**/*.test.ts(x)`, `scripts/**/*.test.ts` |
| **Build smoke**                            | Vitest (slow)              | Included in `npm test`; skip with `npm run test:fast`  | `packages/*/test/**/*.slow.test.ts`                       |
| **Playwright extension smoke + behaviour** | Playwright + real Chromium | Runs in CI (via Xvfb); opt-in locally                  | `e2e/*.spec.ts`                                           |
| **Manual real-bexio walkthrough**          | Human + real browser       | Before each release — the residual, fixture-drift risk | See Section 8                                             |

The Vitest suite is the primary safety net: it is fast (< 5 s without the slow build smoke test),
runs in CI without a display, requires no built artifact, and pins current behaviour so refactors
get caught early.

The Playwright layer is not part of `npm test` and requires a built `unpacked/` plus a one-time
`npx playwright install chromium`. CI runs it as its own step (see Section 7). It has two specs:
`extension-smoke.spec.ts` (do the content scripts inject, does the side panel mount) and
`extension-behaviour.spec.ts` (issue #66: Text | Tooltip toggle round-trip, template apply, template
filter, the inline Add and manage-mode Delete/Undo flows).

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

## 3. Vitest workspace — four projects

The root `vitest.config.ts` (via its `test.projects` array) defines four projects. (Vitest 4 deprecated the standalone `vitest.workspace.ts` file in favour of `test.projects`, so there is no workspace file — `vitest.config.ts` is the only test config.)

| Project            | Root                        | Environment | What it tests                                                                                                                                                                                                                                                                                                                                                             |
| ------------------ | --------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared`           | `packages/shared`           | `node`      | Storage helpers, template utilities                                                                                                                                                                                                                                                                                                                                       |
| `chrome-extension` | `packages/chrome-extension` | `jsdom`     | Selectors, content scripts, form utils                                                                                                                                                                                                                                                                                                                                    |
| `sidePanel-import` | `packages/sidePanel-import` | `jsdom`     | The ManicTime TSV parser (`csvParser.test.ts`), the short-row guards (`importGuards.test.tsx`), the tag → template auto-mapper (`autoMapTemplatesV3.test.ts`) and the parse → import table rendering (`importEntries.test.tsx`, via `@testing-library/react`)                                                                                                             |
| `scripts`          | `scripts`                   | `node`      | Repo tooling that belongs to no package — the Dependabot PR classifier (`classify-dependabot-update.ts`), whose output decides whether a PR auto-merges without review, the bexio fixture pipeline (`bexio-fixtures/`: scrub + leak check, plus the guard over all committed fixtures), and the version and target-folder helpers of `npm run build:test` (`build-test/`) |

The `sidePanel-import` project has two extra setup details: the `~` alias (that package's Vite
alias for its `src/`) is mirrored in `vitest.config.ts`, and
`packages/sidePanel-import/test/support/setup-dom.ts` shims `matchMedia`/`ResizeObserver`,
which antd's internals expect but jsdom does not implement.

### The in-memory `chrome.*` fake

The three package projects run with an in-memory fake for `chrome.storage.local` and `chrome.runtime` (see
`test/support/chrome-fake.ts` and `test/support/setup-chrome.ts`). The fake is installed on
`globalThis.chrome` before each test file runs, and reset (`chrome.storage.local` cleared,
`chrome.runtime.onMessage` listeners cleared) in a `beforeEach` hook so tests are isolated.
The `scripts` project declares no `setupFiles` — it tests plain Node code that never touches
`chrome.*`.

**The fake serializes at both boundaries.** `set()` stores a JSON round-trip of each value and
`get()` returns a fresh JSON round-trip, so a caller never shares a reference with the store —
exactly like the real API, which serializes everything it persists. This matters: `chromeStorage.update()`
mutates the array it got from `get()` in place and then calls `save()`. With a reference-sharing
fake the mutation alone would already be "stored", and the tests would stay green even if the
`save()` write-back were deleted (a regression that silently loses data in production).

A JSON round-trip is used rather than `structuredClone` on purpose: it also drops what Chrome
drops — `undefined`, functions, and non-index array properties such as the `arr[-1]` that
`chromeStorage.update()` writes for an unknown id (`docs/architecture/storage.md`, known issue 2).
`structuredClone` would preserve those and keep re-introducing fake-only artifacts.

**The fake throws loudly** if any code path reaches for an unimplemented `chrome.*` member.
The guard covers the top level (`chrome.sidePanel`, `chrome.action`) _and_ the namespaces we
stub, so `chrome.storage.sync` and `chrome.runtime.connect` throw the same clear error instead of
returning `undefined`. Symbol properties are reported via `String(prop)` rather than crashing on
string conversion. This is intentional — it surfaces new Chrome API usage immediately.
`chrome.runtime.lastError` is deliberately present-but-`undefined`, because production code reads
it to _check_ for an error. `chrome.tabs` is a real member of the fake (a `FakeTabsApi` with
`query`/`update`/`sendMessage`/`onUpdated` and a test-only `__emitUpdated`); tests may replace or
delete it, and `resetChromeFake()` puts a fresh instance back.

**`chrome.storage.onChanged` is driven by the storage writes themselves.** `set()`, `remove()` and
`clear()` build a `{ key: { oldValue?, newValue? } }` change set and fire the event with area name
`"local"`, following Chrome's own rules: `oldValue` is absent for a key that did not exist,
`newValue` is absent on removal, and a call that changed nothing fires nothing. A test can
therefore just write to storage and assert that the subscriber reacted, instead of poking a
`__emit` helper (which exists as well, for the "storage changed without us hearing about it" case).
`resetChromeFake()` clears the listeners — otherwise a component a test forgot to unmount would
keep firing into the next test's React tree.

Both contracts are pinned by `packages/shared/test/chromeFake.test.ts`; extending the fake means
extending that file.

The one test that needs those members —
`packages/chrome-extension/test/service-worker.test.ts`, which imports
`public/service_worker.js` to drive its side-panel gating (the `chrome.tabs.onUpdated` path and the
`chrome.runtime.onInstalled`/`onStartup` sweep over `chrome.tabs.query`) — swaps
`globalThis.chrome` for its own local stub in `beforeAll` (before the import, because the worker
registers its listeners at module-evaluation time) and restores it in `afterAll`. Keep new
`chrome.*` surface out of the shared fake unless more than one test needs it.

---

## 4. Module-load quirk — always load the fixture first

Several source modules evaluate `document.querySelector(...)` at module-evaluation time
(top-level code, not inside a function). Examples:
`packages/chrome-extension/src/selectors/selectors.ts`,
`packages/chrome-extension/src/selectors/contactField.ts`,
`packages/chrome-extension/src/selectors/billableCheckbox.ts`.

Because jsdom's `document` is empty at module-load time, importing these modules _before_
populating `document.body` captures `null` selectors that will never update.

**The pattern every such test must follow:**

```ts
beforeEach(() => {
  vi.resetModules(); // discard the cached module so it re-evaluates next import
  document.body.innerHTML = "";
});

it("...", async () => {
  loadFixture("monitoring-edit"); // sets document.body.innerHTML first
  const { mySelector } = await import(
    // then import: module evaluates with real DOM
    "@bexio-chrome-extension/chrome-extension/src/selectors/mySelector"
  );
  // ...
});
```

Always import the **specific utility module**, never an app entry point
(`packages/*/src/apps/*/index.ts`), because entry points run side effects
(event listener registration, storage reads) at import time.

### Iframe fixtures — `loadIframeFixture`

jsdom gives an attached `<iframe>` an empty `about:blank` document; it never
loads an inner document for you. Code that reaches through
`iframe.contentWindow.document` — currently only `getDescriptionField()`, which
navigates into bexio's TinyMCE editor (`#monitoring_text_ifr` → `body#tinymce`)
— therefore finds nothing unless the inner document is injected by hand.

`loadIframeFixture(iframe, name)` in
`packages/chrome-extension/test/support/load-fixture.ts` does that: it parses the
named fixture with `DOMParser` and swaps it in as the iframe document's
`documentElement` (no navigation involved). It strips inline `onload` attributes
first — the captured TinyMCE body carries
`onload="window.parent.tinyMCE...."`, and jsdom fires the iframe's load event
after the swap, which would throw because the fixtures ship without bexio's
JavaScript.

```ts
loadFixture("monitoring-edit");
const iframe = document.querySelector("#monitoring_text_ifr") as HTMLIFrameElement;
const iframeDocument = loadIframeFixture(iframe, "monitoring-edit.tinymce-iframe");
const tinymceBody = iframeDocument.querySelector("#tinymce");
```

Used by `packages/chrome-extension/test/utils/triggerDescription.test.ts`.

---

## 5. Fixture capture procedure

Cleaned, anonymised HTML fixtures live in
`packages/chrome-extension/test/fixtures/bexio/`.
The procedure is documented in full in
`packages/chrome-extension/test/fixtures/bexio/README.md`; summary:

1. Log into bexio in Chrome. For the four tooltip pages, run the README's capture
   script on each page (it undoes the extension's changes on a clone, strips the
   account-data parts of the page and trims tables), then download the bundle into
   `packages/chrome-extension/test/fixtures/bexio/_raw/` (git-ignored). The
   `monitoring-edit` form fixtures still use the README's `copy(...)` snippets.
2. Keep `_raw/anonymise.local.json` — the real names of people, clients and
   projects — up to date. It is git-ignored and never committed.
3. `npm run fixtures:build` (`scripts/bexio-fixtures/build.ts`) scrubs the bundle
   and writes each `<name>.html` with its sibling `<name>.md` (source URL, capture
   date, what was trimmed and anonymised). A fixture in which `findLeaks` still
   recognises a token, e-mail address, UUID or listed name is not written.
4. Read through the remaining text before committing: the leak check only knows
   the names in `anonymise.local.json`.
5. The cleaned `*.html` and `*.md` files are committed; `_raw/` is not. The
   repository is public: `scripts/bexio-fixtures/committed-fixtures.test.ts` fails
   when a committed fixture contains an access token, CSRF token, e-mail address,
   UUID or extension id. (Until 2026-09 two fixtures carried an expired bexio access
   token and account ids — the check exists because of that.)

**Currently captured fixtures:**

- `monitoring-edit.html` — the time-entry edit form (empty)
- `monitoring-edit-filled.html` — the same form with values pre-filled
- `monitoring-edit.tinymce-iframe.html` — the TinyMCE iframe body (injected via
  `loadIframeFixture`; see Section 4)
- `monitoring-list.html` — full-body capture of the time-entry list in bexio's sidebar layout (2026-09): page title bar with the primary action, hidden legacy top navigation, rows trimmed to 12
- `pr_project-listMonitoring.html` — full-body capture of a project's "Zeiten" tab (rows trimmed to 12)
- `pr_project-showPackage.html` — full-body capture of a work package with its lower "Zeiten" tab open (jQuery-UI panel `#ui-id-4`)
- `kb_invoice-show.html` — full-body capture of an invoice with the "Zeiten importieren" modal open; the modal's table rows trimmed to 12. Path through the UI: **Verkauf → Rechnungen → \<draft invoice\> → Positionen → "Weitere Positionen" → "Zeit/Leistung"**.

The four tooltip fixtures were recaptured on 2026-09-17; the three `monitoring-edit`
fixtures date from 2026-05-13 and were compared against the live form that day
(identical structure).

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
  `monitoring/edit`, the side panel mounts, the "Text | Tooltip" toggle is
  _visible_ in the page title bar of `monitoring/list` (the test adds bexio's
  rule that hides the legacy top navigation, which the fixture ships without).
- `e2e/extension-behaviour.spec.ts` — behaviour-level (issue #66): the
  Text | Tooltip toggle round-trip (convert → revert), the toggle's active option
  when bexio's sidebar opened the list (`serveFixture`'s `inlineScript` stands in
  for bexio's address rewrite), the date column's sort link turned to descending
  and the "Newest first" toggle sorting through a click handler that runs in the
  page's world (`inlineScript` again, standing in for bexio's delegated `.ajxl`
  handler — see `list-sorting.md`), applying a template through
  the real `fillForm` synthetic-event path, the keyword-aware template filter,
  and the inline Add + manage-mode Delete/Undo flows — dialog-free by design;
  `page.on("dialog")` stays wired to prove no native dialog ever opens.

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

1. Build the extension: `npm run build:test`, in the checkout that holds the code
   under test (main checkout or worktree). It always delivers into the **main
   checkout's** `unpacked/` and prints the version to expect, e.g. `1.8.2.7`.
2. Once only: Chrome → `chrome://extensions/` → enable "Developer mode" → "Load
   unpacked" → select `E:\git\soulcode\bexio-chrome-extension\unpacked`. After
   every later `build:test`, click the extension's reload button instead and
   check that it shows the printed version. The folder path fixes the extension
   id, so templates and settings stay.
3. Log into your bexio account in the same Chrome profile.

### 5.1 — `monitoring/edit`: Templates block

_Automated (on fixtures): items 2–8 — injection (smoke spec), keyword filter,
inline Add, template apply, manage-mode Delete + Undo — in
`extension-behaviour.spec.ts`. The live-bexio run additionally exercises the
real select2/AJAX widgets. The tooltip (item 4), the update button (item 7)
and the side-panel button (item 9) are manual-only._

1. Navigate to `https://office.bexio.com/index.php/monitoring/edit`
   (or open an existing time entry).
2. Confirm the **Templates** block appears below the form (an `#SoulcodeExtensionTemplates`
   section with a filter input and template chips if any are saved).
3. Add: Plus-Button ("Add template from the current form") klicken → Inline-Feld erscheint mit vorgeschlagenem Namen →
   Enter speichert, Chip erscheint (kein `prompt()`-Dialog).
   Danach Duplikat: gleiche Formularwerte nochmals speichern →
   Inline-Fehlermeldung, kein Dialog.
4. Tooltip: Chip ~0,5 s hovern → Vorschau mit
   Tätigkeit/Projekt/Arbeitspaket/Kontakt/Status/Abrechenbar.
5. Filter: Keyword eines Templates tippen → nur dieses bleibt; "nomatch" →
   Leerzustand; Esc leert; bei genau einem Treffer wendet Enter es an.
   Gegenprobe: Filterfeld leeren und Enter drücken → es darf **nichts**
   passieren (auch nicht, wenn nur ein einziges Template existiert).
6. Chip anklicken (grün) → Formular wird mit den Template-Werten befüllt.
   Während des Befüllens ist ↻ ausgegraut und nicht klickbar.
7. Update: Chip anklicken (grün) → Formular ändern → ↻ klicken → "Updated ✓",
   Side Panel zeigt die neuen Werte. Danach denselben Chip hovern → die Vorschau
   zeigt die **neuen** Werte.
8. Löschen: Papierkorb-Button ("Delete templates") → Chips werden rot mit × → × klicken → Chip weg, Toast mit
   "Undo" (5 s) → "Done" beendet den Modus, der Toast bleibt aber stehen →
   Undo stellt das Template so wieder her, wie es zuletzt gespeichert war.
9. Side Panel: Button ganz rechts in der Toolbar ("Open side panel (ManicTime
   import)") klicken → das Side Panel öffnet sich für diesen Tab. Ist es schon
   offen, passiert nichts.

### 5.2 — `monitoring/list` + project/package tabs: Text | Tooltip toggle

_Automated (on fixtures): items 1–3 — the toggle round-trip on
`monitoring/list` — in `extension-behaviour.spec.ts`; the toggle's placement on
all four pages and the work package's panel reload in
`test/apps/bexioProjectList.test.ts`. What only a real browser shows: how the
toggle looks next to bexio's own buttons._

1. Open the time list through bexio's sidebar (Projekte → Zeiten).
   Confirm a **Text | Tooltip** toggle is visible in the page title bar, directly
   left of the green "Neue Zeiterfassung" button, with "Tooltip" in blue (default).
2. Click **Text** — confirm tooltip popover icons (`<i rel="popover">`) are
   replaced by inline text and "Text" turns blue.
3. Click **Tooltip** — confirm the page reverts to the original popover icons.
4. Repeat on a project's "Zeiten" tab (`pr_project/listMonitoring/...`, toggle
   next to "Neues Projekt") and on a work package (`pr_project/showPackage/...`):
   there, open the lower "Zeiten" tab, then sort by a column — the notes must be
   converted after both.

### 5.2b — all four list pages: date sorting and the "Newest first" toggle

_Automated (on fixtures): the link rewrite on all four pages, every condition of
the automatic sort and the toggle in `test/utils/dateSort.test.ts` and
`test/apps/bexioProjectList.test.ts`; in real Chrome, with a stand-in for bexio's
click handler, in `extension-behaviour.spec.ts`. What only real bexio shows: that
bexio's own handler reloads the list, and that the sort survives what it should._

1. With **Newest first** off (not blue): open the time list through bexio's
   sidebar (Projekte → Zeiten). The list is unsorted (no arrow next to "Datum").
   Click **Datum** once — the newest entries are on top, arrow pointing down.
2. Click **Datum** again — oldest first (bexio's own toggle still works). Click
   **Text** — sorted by text; then **Datum** once — newest first again.
3. Click **Newest first** — it turns blue. Open the list through the sidebar
   again: it reloads **once** on its own (bexio's loading mask) and ends up
   sorted by date, newest first. It must not keep reloading.
4. Sort by another column, then switch the filter tab ("Heute", "Alle"): the
   chosen sort stays, nothing is sorted on its own.
5. Click **Newest first** again — no longer blue, the list stays as it is; the
   next visit through the sidebar is unsorted again.
6. On a project's "Zeiten" tab (`pr_project/listMonitoring/...`): the same
   **Newest first** toggle, next to "Neues Projekt". Off: the first click on
   **Datum** sorts newest first. On: the list reloads once on arrival and is
   sorted by date, newest first — also after a plain page reload (F5), because
   bexio forgets this list's sort on every page load.
7. On a work package (`pr_project/showPackage/...`), toggle on: the "Aufgaben"
   tab is **not** sorted on its own, but its first click on the due date column
   sorts descending. Open the "Zeiten" tab — it reloads once and is sorted by
   date, newest first. Switch to "Aufgaben" and back: still sorted, no reload.
8. On a draft invoice (`kb_invoice/show/id/...`), toggle on (switch it before
   opening the modal): Positionen → "Weitere Positionen" → "Zeit/Leistung". The
   list reloads once and is sorted newest first. Close the modal and open it
   again — sorted again, again with exactly one reload.

### 5.3 — Side panel: Templates and Import tabs

_Automated: item 5 (parse → table, incl. billable icons and ▶ buttons) runs
as a jsdom Vitest test in `packages/sidePanel-import/test/importEntries.test.tsx`;
the side panel mounting is covered by the smoke spec. Items 3 and 7
(tab persistence, cross-tab message to the bexio form) are still manual-only,
and item 6 is manual for its visual half only._

1. On any bexio page (`https://office.bexio.com/index.php/monitoring/...`),
   click the extension icon (or the browser side-panel button) to open the
   side panel.
2. Confirm the **Templates** and **Import** tabs are visible and clickable.
3. Switch between tabs — confirm the active tab persists after closing and
   re-opening the side panel (stored in `chrome.storage.local` under `activeTabId`).
4. Switch to the **Import** tab. Paste a ManicTime clipboard export (TSV format)
   into the import text area.
5. Confirm the parsed rows populate the import table.
6. Scroll the import table sideways until the date columns move. Only the table
   itself may scroll — the side panel must never grow a horizontal scrollbar.
   The block up to and including **Billable** must stay in place, stay fully
   opaque (no date cells shining through), keep its shadow edge on the right,
   and the header row must still stick to the top while scrolling down. No cell
   value may be cut off: long values wrap onto more lines instead. Drag the
   panel wider and narrower and confirm the pinned block follows. Which columns
   are pinned is covered by
   `packages/sidePanel-import/test/frozenColumns.test.ts`; the measured pixel
   offsets are not — jsdom has no layout, so they are only checked here.
7. Click the ▶️ (play / fill) button on one row — confirm the
   `monitoring/edit` form in the main tab is populated with that entry's values.
   The button must then become 📤; the three-state cell is section 5.4.
8. **Live template sync.** With the side panel open, save a new template from the
   injected Templates block on `monitoring/edit`. The panel's **Templates** tab
   must list it without being closed and reopened, and **Auto map templates** on
   the Import tab must be able to match it. Then click the 🔄 button in the panel
   header and confirm the list still shows it — that button is the manual
   fallback for the same reload.

### 5.4 — Side panel: the ▶️ → 📤 → ✅ submit flow

**This step books real time entries.** Use today's date and delete them afterwards.
Nothing here is covered by the automated layers against live bexio: the panel side
is pinned in `packages/sidePanel-import/test/importEntries.test.tsx` (the three
button states, the failure paths, `form-submitted`) and the content-script side in
`packages/chrome-extension/test/eventListeners/onMessage.test.ts`, but both run
against the chrome fake. What only a real browser shows is that the programmatic
click on bexio's save button really submits — a synthetic Enter key never did, which
is why the button is clicked rather than focused (`docs/architecture/form-layer.md`).

1. Click ▶️ in a date column. The `monitoring/edit` form fills and the button
   becomes 📤.
2. Confirm in the bexio tab that **nothing has been saved yet** — no new entry in
   the list. Applying must never book.
3. Apply a _different_ row with ▶️. The first row returns to ▶️ and only the new
   one shows 📤: at most one entry is ever waiting to be submitted, and it is never
   persisted.
4. Click 📤. bexio saves, and the button becomes ✅ — which _is_ persisted
   (`entryStatus`), so it survives closing and reopening the panel.
5. **The reverse channel.** Fill a row with ▶️, then press **Speichern** in the
   bexio tab by hand (or Enter in the form). The row waiting on 📤 must also flip to
   ✅ — the content script reports every `#MonitoringForm` submit, not just the ones
   the panel triggered.
6. With no row waiting, save the bexio form again. Nothing in the panel may change.
7. Delete the entries you created.

**Known limit** (`form-layer.md`): the submit event fires before the POST, so a
server-side rejection still reads as booked. Clicking ✅ resets the row by hand.

### 5.5 — `kb_invoice` tracked-time tooltip (`kb_invoice/show/id/*`)

On an invoice detail page, navigate **Positionen → "Weitere Positionen" →
"Zeit/Leistung"** to open the "Zeiten importieren" modal (on a draft invoice —
issued ones do not offer it). With **Text** selected in the toggle next to "Neue
Rechnung" — select it _before_ opening the modal, whose overlay covers the title
bar — the info-icon popovers in the modal table should turn into inline text and
the rows should pick up the alternating background colours. Close the modal,
select **Tooltip**, reopen it and confirm the icons are back. The fixture
`kb_invoice-show.html` covers the same DOM under `test/fixtures/bexio/`.
