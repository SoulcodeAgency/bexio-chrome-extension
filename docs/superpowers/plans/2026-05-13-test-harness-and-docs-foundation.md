# Test Harness & Docs Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a reproducible Vitest-based test harness (plus a thin opt-in Playwright extension-smoke layer) and a `docs/architecture/` knowledge base for topics 4–7 (tooltip replacement, form-manipulation layer, `shared/` storage, build/release tooling), pinning current behaviour so later refactors have a safety net.

**Architecture:** One root Vitest workspace with three projects — `shared` (node env), `chrome-extension` (jsdom env, fixture-backed), `sidePanel-import` (node env, not used this round). An in-memory `chrome.storage`/`chrome.runtime` fake installed via setup files. Captured-and-anonymised bexio HTML fixtures loaded into jsdom for the DOM code. A separate `e2e/` Playwright project that loads the built unpacked extension into Chromium and asserts the content scripts inject. Tests pin **today's** behaviour (bugs included, flagged with `// KNOWN ISSUE:`).

**Tech Stack:** Vitest, jsdom, `@playwright/test`, TypeScript, npm workspaces, Vite + `@crxjs/vite-plugin` (already present), PowerShell build scripts (already present).

**Reference spec:** `docs/superpowers/specs/2026-05-12-test-harness-and-docs-foundation-design.md`

---

## Conventions used throughout this plan

- **Branch:** all work happens on `feature/test-harness-and-docs` (already created and checked out; the spec + fixtures landing folder are already committed there).
- **Test file location:** colocated under a `test/` folder inside each package — `packages/<pkg>/test/**/*.test.ts` for unit/integration, `packages/<pkg>/test/**/*.slow.test.ts` for slow tests (the build smoke test). Playwright tests live in `e2e/`.
- **TypeScript only.** No `.js`/`.jsx` test or helper files. Existing `.js` files (`updateManifest.js`, `service_worker.js`) are left as-is this round.
- **Pinning, not fixing.** When a test documents behaviour that is clearly a bug, add a `// KNOWN ISSUE: <one line>` comment above the assertion and a bullet in the relevant `docs/architecture/*.md`. Do not fix it here.
- **DOM module-load quirk:** `packages/chrome-extension/src/selectors/selectors.ts` (and `contactField.ts`, `billableCheckbox.ts`, etc.) evaluate `document.querySelector(...)` at module top level. Therefore, in a test you MUST load the fixture into `document` **before** importing the module under test, and call `vi.resetModules()` in `beforeEach` so each test gets a fresh evaluation. The pattern is:
  ```ts
  beforeEach(() => { vi.resetModules(); document.body.innerHTML = ""; });
  it("…", async () => {
    await loadFixture("monitoring-edit");          // sets document.body.innerHTML
    const { default: fillForm } = await import("@bexio-chrome-extension/chrome-extension/src/utils/fillForm");
    // …
  });
  ```
  Import the **specific util module**, never an app entry point (`apps/*/index.ts`), because those run side effects at import time.
- **Test-case lists:** where a task lists multiple cases as a table/bullets, write one `it(...)` per case following the shown worked example; the table gives the input, the expectation, and (where known) the exact expected value. That is the content — it is not a placeholder.
- **Commit after every task** (each task ends with a commit step). Commit messages: `test: …`, `chore(test): …`, `docs: …`.

---

## File structure (created or modified by this plan)

**Created — harness:**
- `vitest.workspace.ts` — root; defines the three Vitest projects.
- `vitest.config.ts` — root; shared defaults (reporters, the `test:fast` exclude glob lives here as a project-level `exclude`).
- `test/support/chrome-fake.ts` — in-memory `chrome.storage.local` + `chrome.runtime` fake + `installChromeFake()` / `resetChromeFake()`.
- `test/support/setup-chrome.ts` — Vitest `setupFiles` entry: installs the chrome fake on `globalThis` and resets it in `beforeEach`.
- `packages/chrome-extension/test/support/load-fixture.ts` — `loadFixture(name)`: reads `test/fixtures/bexio/<name>.html`, sets `document.body.innerHTML`, returns `document`.
- `packages/chrome-extension/test/support/load-fixture.test.ts` — smoke test for the helper + harness.

**Created — fixtures (anonymised, committed):**
- `packages/chrome-extension/test/fixtures/bexio/monitoring-edit.html` (+ `.md`)
- `packages/chrome-extension/test/fixtures/bexio/monitoring-edit-filled.html` (+ `.md`)
- `packages/chrome-extension/test/fixtures/bexio/monitoring-edit.tinymce-iframe.html` (+ `.md`)
- `packages/chrome-extension/test/fixtures/bexio/monitoring-list.html` (+ `.md`)
- `packages/chrome-extension/test/fixtures/bexio/pr_project-listMonitoring.html` (+ `.md`)
- `packages/chrome-extension/test/fixtures/bexio/pr_project-showPackage.html` (+ `.md`)
  *(`kb_invoice-show` deferred — see spec.)*

**Created — tests:**
- `packages/shared/test/chromeStorage.test.ts`
- `packages/shared/test/chromeStorageTemplateEntries.test.ts`
- `packages/shared/test/chromeStorageSettings.test.ts`
- `packages/shared/test/chromeStorageImportData.test.ts`
- `packages/shared/test/sortTemplates.test.ts`
- `packages/shared/test/getTemplateName.test.ts`
- `packages/shared/test/confirmTemplateDeletion.test.ts`
- `packages/chrome-extension/test/updateManifest.test.ts` *(fast — uses a temp dir + a quick `node` spawn; see Task 2.1)*
- `packages/chrome-extension/test/build-smoke.slow.test.ts`
- `packages/chrome-extension/test/selectors/projectTable_TextCell.test.ts`
- `packages/chrome-extension/test/utils/convertPopover.test.ts`
- `packages/chrome-extension/test/apps/bexioProjectList.test.ts`
- `packages/chrome-extension/test/selectors/formSelectors.test.ts`
- `packages/chrome-extension/test/utils/triggerField.test.ts`
- `packages/chrome-extension/test/utils/triggerContactField.test.ts`
- `packages/chrome-extension/test/utils/triggerCheckbox.test.ts`
- `packages/chrome-extension/test/utils/triggerDate.test.ts`
- `packages/chrome-extension/test/utils/triggerDescription.test.ts`
- `packages/chrome-extension/test/utils/triggerDuration.test.ts`
- `packages/chrome-extension/test/utils/waitFor.test.ts`
- `packages/chrome-extension/test/utils/fillForm.test.ts`
- `packages/chrome-extension/test/utils/readFormData.test.ts`
- `packages/chrome-extension/test/utils/misc-utils.test.ts` (loader, delay, trimAll, pressEnter, generateHash)
- `e2e/playwright.config.ts`
- `e2e/extension-smoke.spec.ts`
- `e2e/support/static-server.ts` (tiny http server serving the fixture HTML, if `file://` proves unworkable)

**Created — docs:**
- `docs/architecture/storage.md`
- `docs/architecture/build-and-release.md`
- `docs/architecture/tooltip-replacement.md`
- `docs/architecture/form-layer.md`
- `docs/architecture/testing.md`

**Modified:**
- `package.json` (root) — add `vitest`, `jsdom`, `@playwright/test` to `devDependencies` (exact-pinned); add `test`, `test:fast`, `test:watch`, `test:e2e` scripts.
- `packages/chrome-extension/updateManifest.js` — **untouched** (tested via temp dir).
- `CLAUDE.md` — add an "Architecture deep-dives" section linking the four topic docs + `testing.md`.
- Selected source files in `packages/chrome-extension/src/**` and `packages/shared/**` — add **TSDoc comments only** (no behaviour change) where flagged in the doc tasks.

---

## Phase 0 — Harness scaffolding

### Task 0.1: Add Vitest + jsdom and root test scripts

**Files:**
- Modify: `package.json` (root)

- [x] **Step 1: Install dev dependencies (exact-pinned via `.npmrc`)**

Run:
```bash
npm install --save-dev --save-exact vitest jsdom
```
Expected: `package.json` `devDependencies` now lists `vitest` and `jsdom` with exact versions; `package-lock.json` updated.

- [x] **Step 2: Add scripts to root `package.json`**

In the `"scripts"` block add (keep existing scripts):
```jsonc
"test": "vitest run",
"test:fast": "vitest run --exclude \"**/*.slow.test.ts\"",
"test:watch": "vitest",
"test:e2e": "playwright test --config e2e/playwright.config.ts"
```

- [x] **Step 3: Verify Vitest is callable**

Run: `npx vitest --version`
Expected: prints a version number, no error.

- [x] **Step 4: Commit**
```bash
git add package.json package-lock.json
git commit -m "chore(test): add vitest + jsdom and root test scripts"
```

---

### Task 0.2: Root Vitest workspace + config

**Files:**
- Create: `vitest.config.ts`
- Create: `vitest.workspace.ts`

- [x] **Step 1: Create `vitest.config.ts`**
```ts
import { defineConfig } from "vitest/config";

// Root defaults shared by all workspace projects.
export default defineConfig({
  test: {
    // Each project sets its own environment; node is a safe default.
    environment: "node",
    // The build smoke test shells out to Vite and is slow; `test:fast` excludes it.
    // (Default `test` includes it.)
    reporters: ["default"],
    clearMocks: true,
    restoreMocks: true,
  },
});
```

- [x] **Step 2: Create `vitest.workspace.ts`**
```ts
import { defineWorkspace } from "vitest/config";
import path from "node:path";

export default defineWorkspace([
  {
    extends: "./vitest.config.ts",
    test: {
      name: "shared",
      root: "./packages/shared",
      environment: "node",
      include: ["test/**/*.test.ts"],
      setupFiles: [path.resolve(__dirname, "test/support/setup-chrome.ts")],
    },
  },
  {
    extends: "./vitest.config.ts",
    test: {
      name: "chrome-extension",
      root: "./packages/chrome-extension",
      environment: "jsdom",
      include: ["test/**/*.test.ts", "test/**/*.slow.test.ts"],
      setupFiles: [path.resolve(__dirname, "test/support/setup-chrome.ts")],
    },
  },
  {
    extends: "./vitest.config.ts",
    test: {
      name: "sidePanel-import",
      root: "./packages/sidePanel-import",
      environment: "node",
      // Nothing tested here this round; left configured for the future.
      include: ["test/**/*.test.ts"],
    },
  },
]);
```

- [x] **Step 3: Add a path alias so tests can import package source by name**

In `vitest.workspace.ts`, for the `chrome-extension` and `shared` projects, add a `resolve.alias` mapping (Vitest reads `resolve` from the project config). Update both objects' `test` siblings — actually `resolve` is a top-level key on the project config object, not under `test`. Final form for the `chrome-extension` project entry:
```ts
{
  extends: "./vitest.config.ts",
  resolve: {
    alias: {
      "@bexio-chrome-extension/shared": path.resolve(__dirname, "packages/shared/index.ts"),
      "@bexio-chrome-extension/chrome-extension": path.resolve(__dirname, "packages/chrome-extension"),
    },
  },
  test: {
    name: "chrome-extension",
    root: "./packages/chrome-extension",
    environment: "jsdom",
    include: ["test/**/*.test.ts", "test/**/*.slow.test.ts"],
    setupFiles: [path.resolve(__dirname, "test/support/setup-chrome.ts")],
  },
},
```
Add the same `resolve.alias` block to the `shared` project entry (it imports `./types` etc. relatively, so it only needs the `@bexio-chrome-extension/shared` alias; include it anyway for consistency). The subpath imports the code uses (`@bexio-chrome-extension/shared/types`, `/chromeStorageSettings`, etc.) resolve via Node's package-exports? No — there is no `exports` map. They currently work only because of npm workspaces symlinking `node_modules/@bexio-chrome-extension/shared` → `packages/shared`. That symlink also works under Vitest, so the alias above is a belt-and-braces measure; if a subpath import fails to resolve in tests, add explicit aliases like `"@bexio-chrome-extension/shared/types": path.resolve(__dirname, "packages/shared/types.ts")`.

- [x] **Step 4: Commit**
```bash
git add vitest.config.ts vitest.workspace.ts
git commit -m "chore(test): add root vitest workspace with shared / chrome-extension / sidePanel-import projects"
```

---

### Task 0.3: Chrome API fake + setup file

**Files:**
- Create: `test/support/chrome-fake.ts`
- Create: `test/support/setup-chrome.ts`

- [x] **Step 1: Write `test/support/chrome-fake.ts`**
```ts
// Minimal in-memory stand-ins for the chrome.* APIs the extension touches in
// code that we unit-test. Anything not implemented here throws loudly so we
// notice when a test reaches for something new.

type StorageRecord = Record<string, unknown>;

class FakeLocalStorageArea {
  private store: StorageRecord = {};

  async get(key?: string | string[] | null): Promise<StorageRecord> {
    if (key === undefined || key === null) return { ...this.store };
    const keys = Array.isArray(key) ? key : [key];
    const out: StorageRecord = {};
    for (const k of keys) if (k in this.store) out[k] = this.store[k];
    return out;
  }

  async set(items: StorageRecord): Promise<void> {
    Object.assign(this.store, items);
  }

  async remove(key: string | string[]): Promise<void> {
    const keys = Array.isArray(key) ? key : [key];
    for (const k of keys) delete this.store[k];
  }

  async clear(): Promise<void> {
    this.store = {};
  }

  /** test-only */
  __dump(): StorageRecord {
    return { ...this.store };
  }
  /** test-only */
  __reset(): void {
    this.store = {};
  }
}

function notImplemented(name: string): never {
  throw new Error(`chrome fake: ${name} is not implemented`);
}

export interface ChromeFake {
  storage: { local: FakeLocalStorageArea };
  runtime: {
    onMessage: { addListener: (fn: unknown) => void; __listeners: unknown[] };
    sendMessage: (...args: unknown[]) => void;
    lastError?: unknown;
  };
}

let current: ChromeFake | undefined;

export function installChromeFake(): ChromeFake {
  const fake: ChromeFake = {
    storage: { local: new FakeLocalStorageArea() },
    runtime: {
      onMessage: {
        __listeners: [],
        addListener(fn: unknown) {
          this.__listeners.push(fn);
        },
      },
      sendMessage: () => {
        /* no-op in tests; assert on the fake separately if needed */
      },
    },
  };
  // anything else → throw
  const guarded = new Proxy(fake, {
    get(target, prop: string) {
      if (prop in target) return (target as Record<string, unknown>)[prop];
      return notImplemented(`chrome.${prop}`);
    },
  });
  current = guarded as ChromeFake;
  (globalThis as Record<string, unknown>).chrome = current;
  return current;
}

export function resetChromeFake(): void {
  if (!current) {
    installChromeFake();
    return;
  }
  current.storage.local.__reset();
  current.runtime.onMessage.__listeners.length = 0;
}

export function getChromeFake(): ChromeFake {
  if (!current) return installChromeFake();
  return current;
}
```

- [x] **Step 2: Write `test/support/setup-chrome.ts`**
```ts
import { beforeEach } from "vitest";
import { installChromeFake, resetChromeFake } from "./chrome-fake";

installChromeFake();

beforeEach(() => {
  resetChromeFake();
});
```

- [x] **Step 3: Commit**
```bash
git add test/support/chrome-fake.ts test/support/setup-chrome.ts
git commit -m "chore(test): add in-memory chrome.storage / chrome.runtime fake + setup file"
```

---

### Task 0.4: Fixture loader (no fixtures yet — uses a tiny inline fixture for its own test)

**Files:**
- Create: `packages/chrome-extension/test/support/load-fixture.ts`
- Create: `packages/chrome-extension/test/support/__inline__/tiny.html`
- Create: `packages/chrome-extension/test/support/load-fixture.test.ts`

- [x] **Step 1: Write `packages/chrome-extension/test/support/load-fixture.ts`**
```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FIXTURE_DIR = resolve(__dirname, "../fixtures/bexio");

/**
 * Reads a captured bexio HTML fixture and installs it as the current jsdom
 * document body. Returns the global `document` for convenience.
 *
 * @param name fixture file name without extension, e.g. "monitoring-edit"
 */
export function loadFixture(name: string): Document {
  const html = readFileSync(resolve(FIXTURE_DIR, `${name}.html`), "utf8");
  document.body.innerHTML = html;
  return document;
}

/** Reads a fixture's raw HTML without touching the DOM. */
export function readFixture(name: string): string {
  return readFileSync(resolve(FIXTURE_DIR, `${name}.html`), "utf8");
}
```

- [x] **Step 2: Write `packages/chrome-extension/test/support/__inline__/tiny.html`**
```html
<div id="probe" data-content="&amp;ok"><i rel="popover" data-content="hello &amp; goodbye"></i></div>
```

- [x] **Step 3: Write the failing test `packages/chrome-extension/test/support/load-fixture.test.ts`**
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("test harness", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
  });

  it("provides a jsdom document", () => {
    expect(typeof document).toBe("object");
    expect(typeof document.querySelector).toBe("function");
  });

  it("provides the chrome.storage fake", async () => {
    await chrome.storage.local.set({ probe: 123 });
    const got = await chrome.storage.local.get("probe");
    expect(got).toEqual({ probe: 123 });
  });

  it("resets the chrome.storage fake between tests", async () => {
    const got = await chrome.storage.local.get("probe");
    expect(got).toEqual({}); // not 123 from the previous test
  });

  it("loads an HTML fragment into document.body via loadFixture-style read", () => {
    const html = readFileSync(
      resolve(__dirname, "__inline__/tiny.html"),
      "utf8",
    );
    document.body.innerHTML = html;
    expect(document.getElementById("probe")).not.toBeNull();
    expect(document.querySelector("i[rel='popover']")?.getAttribute("data-content")).toBe(
      "hello & goodbye",
    );
  });
});
```
Note: `chrome` is a global the fake installs; add a `// @ts-expect-error` or a `declare global { var chrome: any }` in a `test/support/global.d.ts` if TS complains — prefer adding `packages/chrome-extension/test/support/global.d.ts`:
```ts
import type { ChromeFake } from "../../../../test/support/chrome-fake";
declare global {
  // eslint-disable-next-line no-var
  var chrome: ChromeFake & typeof globalThis.chrome;
}
export {};
```

- [x] **Step 4: Run the test, expect it to PASS (harness works)**

Run: `npx vitest run --project chrome-extension test/support/load-fixture.test.ts`
Expected: 4 passed. If "chrome is not defined" → the setup file isn't wired; recheck `setupFiles` path in `vitest.workspace.ts`. If module-resolution errors → recheck the aliases from Task 0.2.

- [x] **Step 5: Commit**
```bash
git add packages/chrome-extension/test/support/
git commit -m "test: add fixture loader + harness smoke test"
```

---

### Task 0.5: Anonymise & trim the captured fixtures

**Files:**
- Create: `packages/chrome-extension/test/fixtures/bexio/monitoring-edit.html` + `.md`
- Create: `packages/chrome-extension/test/fixtures/bexio/monitoring-edit-filled.html` + `.md`
- Create: `packages/chrome-extension/test/fixtures/bexio/monitoring-edit.tinymce-iframe.html` + `.md`
- Create: `packages/chrome-extension/test/fixtures/bexio/monitoring-list.html` + `.md`
- Create: `packages/chrome-extension/test/fixtures/bexio/pr_project-listMonitoring.html` + `.md`
- Create: `packages/chrome-extension/test/fixtures/bexio/pr_project-showPackage.html` + `.md`
- Source (read-only, git-ignored): `packages/chrome-extension/test/fixtures/bexio/_raw/*.html`

**This task is content work, not code. Do it carefully; a subagent doing this should read each raw file fully.**

- [ ] **Step 1: For each raw fixture, produce the cleaned `.html`** by applying ALL of:
  - **Anonymise people:** replace every real personal name (e.g. in the `#monitoring_user_id` `<option>` list and in `select2-chosen` spans) with placeholders: `Doe Jane`, `Roe Richard`, `Smith Sam`, … (keep the "Lastname Firstname" ordering bexio uses). Be consistent — the same real name → the same placeholder everywhere.
  - **Anonymise companies/projects/packages:** replace real client / project / work-package / template names (template button labels in `#bexioTimetrackingTemplates-entries`, table cells, `select2-chosen`, `<option>` text) with `Acme AG`, `Globex GmbH`, `Project Falcon`, `Project Mercury`, `Package Alpha`, …
  - **Strip secrets:** replace the `monitoring__csrf_token` value with `TEST_CSRF_TOKEN`; replace any `chrome-extension://<id>/…` URLs with `chrome-extension://EXTENSION_ID_PLACEHOLDER/…`; remove any session-ish ids you spot.
  - **Strip noise:** delete inline `<script>…</script>` blocks (jsdom won't run them; they only bloat the file) — but keep their surrounding elements. Keep `<style>` blocks only if small. Collapse runs of whitespace if it helps readability; do NOT reformat element structure.
  - **Trim volume — `monitoring-list.html`, `pr_project-listMonitoring.html`, `pr_project-showPackage.html`:** keep the outer container and table chrome, and keep **8–12 representative `<tr>` rows**, ensuring among them: ≥3 rows with an `<i rel="popover" data-content="…">` tooltip icon (and at least one whose `data-content` contains HTML entities like `&amp;` / `&lt;` / `<br>`), ≥2 rows **without** a tooltip icon, and the alternating row classes preserved. Delete the rest of the rows. Each trimmed file should end up well under ~40 KB.
  - **`monitoring-edit.html`:** keep essentially whole (it's small after script-stripping) — it must retain `#MonitoringForm`, all `#s2id_monitoring_*` select2 containers + their `<select>` siblings, `#autocomplete_monitoring_contact_id`, `#monitoring_allowable_bill`, `#monitoring_date`, `#monitoring_duration`, `#monitoring_text` + the `#monitoring_text_ifr` iframe element, the injected `#SoulcodeExtensionTemplates` / `#SoulcodeExtensionLoader` blocks, and the `button[name="save"].save` submit button.
  - **`monitoring-edit-filled.html`:** same elements but with non-empty values/selections; anonymise the filled-in contact/project/package text. Note in its `.md` which fields are filled.
  - **`monitoring-edit.tinymce-iframe.html`:** keep as-is (it's already tiny and contains no sensitive data) — just confirm.
- [ ] **Step 2: For each cleaned fixture, write the sibling `<name>.md`** with this template:
  ```markdown
  # Fixture: <name>

  - **Source URL:** <the bexio URL it was captured from>
  - **Captured:** 2026-05-13
  - **Captured via:** `copy(<the console snippet used>)`
  - **Trimmed:** <what was removed — scripts, N of M table rows kept, etc.>
  - **Anonymised:** yes — personal names → Doe/Roe/Smith placeholders; client/project/package/template names → Acme/Globex/Falcon placeholders; CSRF token & extension id replaced.
  - **Notable elements for tests:** <list the ids/selectors that matter, e.g. `#MonitoringForm`, `#s2id_monitoring_pr_project_id`, `i[rel='popover']` x N>
  ```
- [ ] **Step 3: Sanity-check there are no leftover real names** — grep the cleaned files for obviously-real tokens you replaced; also confirm `_raw/` is still git-ignored (`git status` must not show `_raw/` contents).

Run: `git status --porcelain packages/chrome-extension/test/fixtures/bexio/`
Expected: only the cleaned `*.html` and `*.md` files appear; nothing under `_raw/`.

- [ ] **Step 4: Commit**
```bash
git add packages/chrome-extension/test/fixtures/bexio/*.html packages/chrome-extension/test/fixtures/bexio/*.md
git commit -m "test: add anonymised + trimmed bexio DOM fixtures"
```

---

## Phase 1 — Topic 6: `shared/` storage & helpers

### Task 1.1: Tests for `chromeStorage.ts`

**Files:**
- Source under test: `packages/shared/chromeStorage.ts`
- Test: `packages/shared/test/chromeStorage.test.ts`

- [x] **Step 1: Write the test file** (worked example for the first case; the rest follow the same pattern):
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as cs from "../chromeStorage";

describe("chromeStorage", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("save then load round-trips a value under the default key", async () => {
    await cs.save([{ id: "a" }]);
    const loaded = await cs.load<{ id: string }[]>();
    expect(loaded).toEqual([{ id: "a" }]);
  });

  // ...one `it` per row below...
});
```
Cases to cover (one `it` each):
| Case | Setup → action | Expect |
| --- | --- | --- |
| load: key absent → `undefined` | `cs.load("nope")` | `=== undefined` |
| load: custom key | `cs.save("v", "k")` then `cs.load("k")` | `=== "v"` |
| save: writes under default key `"entries"` | `cs.save([1,2])` then `chrome.storage.local.get("entries")` | `{ entries: [1,2] }` |
| remove: filters out the entry with matching `id` from an array | `cs.save([{id:"a"},{id:"b"}])` then `cs.remove("a")` then `cs.load()` | `[{id:"b"}]` |
| remove: when stored value is not an array → saves `[]` | `cs.save({not:"array"})` then `cs.remove("x")` then `cs.load()` | `[]` — `// KNOWN ISSUE: remove() silently replaces a non-array value with []` |
| remove: id not present → array unchanged | `cs.save([{id:"a"}])` then `cs.remove("zzz")` then `cs.load()` | `[{id:"a"}]` |
| update: replaces matching entry (shallow-merged) | `cs.save([{id:"a",x:1},{id:"b",x:2}])` then `cs.update({id:"b",x:9})` then `cs.load()` | `[{id:"a",x:1},{id:"b",x:9}]` |
| update: throws if `updatedEntry` has no id | `cs.update({} as any)` | rejects with `Error("No id found in updatedEntry")` (use `await expect(...).rejects.toThrow(...)`) |
| update: id not found → no throw, array saved unchanged in content but the no-op write still happens | `cs.save([{id:"a"}])` then `cs.update({id:"zzz",x:1})` then `cs.load()` | `[{id:"a"}]` — `// KNOWN ISSUE: update() with an unknown id silently does nothing (writes the array back as-is, having tried to assign at index -1)`. **Implementation note:** the current code does `entries[key][findIndex(...)] = {...}` where `findIndex` returns `-1`; `arr[-1] = …` sets a non-index property. Assert `cs.load()` deep-equals `[{id:"a"}]` (the `-1` property does not survive JSON-ish round-trip through the fake — and in real `chrome.storage` it would be dropped too). |
| update: custom idKey | `cs.save([{slug:"a"}], "k", )`… actually `update(entry, key, idKey)` — `cs.save([{slug:"x",v:1}],"k")` then `cs.update({slug:"x",v:2} as any,"k","slug")` then `cs.load("k")` | `[{slug:"x",v:2}]` |
| clear: removes the key | `cs.save([1],"k")` then `cs.clear("k")` then `cs.load("k")` | `=== undefined` |

- [x] **Step 2: Run, expect PASS** (these test existing code)

Run: `npx vitest run --project shared test/chromeStorage.test.ts`
Expected: all pass. If any "KNOWN ISSUE" case fails because the actual behaviour differs from what's written above, **change the test to match the actual behaviour** and update the `// KNOWN ISSUE:` note accordingly — do not change `chromeStorage.ts`.

- [x] **Step 3: Commit**
```bash
git add packages/shared/test/chromeStorage.test.ts
git commit -m "test(shared): pin chromeStorage load/save/remove/update/clear behaviour"
```

---

### Task 1.2: Tests for `chromeStorageTemplateEntries.ts`, `chromeStorageSettings.ts`, `chromeStorageImportData.ts`

**Files:**
- Source under test: `packages/shared/chromeStorageTemplateEntries.ts`, `packages/shared/chromeStorageSettings.ts`, `packages/shared/chromeStorageImportData.ts`
- Test: `packages/shared/test/chromeStorageTemplateEntries.test.ts`, `packages/shared/test/chromeStorageSettings.test.ts`, `packages/shared/test/chromeStorageImportData.test.ts`

- [x] **Step 1: `chromeStorageTemplateEntries.test.ts`** — worked example + cases:
```ts
import { describe, expect, it } from "vitest";
import * as te from "../chromeStorageTemplateEntries";
import type { TemplateEntry } from "../types";

const sample = (over: Partial<TemplateEntry> = {}): TemplateEntry => ({
  templateName: "T", keywords: "", billable: true, contact: "", contactPerson: "",
  id: "id1", package: "", project: "", status: "Offen", work: "", ...over,
});

describe("chromeStorageTemplateEntries", () => {
  it("loadTemplates returns [] when nothing is stored", async () => {
    expect(await te.loadTemplates()).toEqual([]);
  });
  // remaining cases below
});
```
Cases: `saveTemplates` then `loadTemplates` round-trips an array; `loadTemplates` reads from the `"entries"` key (set via `chrome.storage.local.set({entries:[…]})`, then `loadTemplates()` returns it); `deleteTemplate(id)` removes that entry; `updateTemplate` shallow-merges by `id`.

- [x] **Step 2: `chromeStorageSettings.test.ts`** — cases:
| Function | No value stored → | After `save…(x)` → `load…()` |
| --- | --- | --- |
| `loadApplyNotesSetting` | `true` | echoes `x` (test with `false`) |
| `loadRemovePopoversSetting` | `false` | echoes `x` (test with `true`) |
| `loadActiveTabId` | `undefined` | echoes `x` (test with `"import"`) |
Also assert the storage keys are what the module exports: after `saveApplyNotesSetting(false)`, `chrome.storage.local.get("applyNotesSetting")` → `{ applyNotesSetting: false }`; same for `activeTabId` / `removePopoversSetting`.

- [x] **Step 3: `chromeStorageImportData.test.ts`** — read `packages/shared/chromeStorageImportData.ts` first (it wasn't quoted in the spec); write round-trip + default tests for whatever load/save/clear functions it exports, following the same pattern. If it stores under its own key, assert that key.

- [x] **Step 4: Run all three, expect PASS**

Run: `npx vitest run --project shared test/chromeStorageTemplateEntries.test.ts test/chromeStorageSettings.test.ts test/chromeStorageImportData.test.ts`
Expected: all pass.

- [x] **Step 5: Commit**
```bash
git add packages/shared/test/chromeStorageTemplateEntries.test.ts packages/shared/test/chromeStorageSettings.test.ts packages/shared/test/chromeStorageImportData.test.ts
git commit -m "test(shared): pin templateEntries / settings / importData storage wrappers"
```

---

### Task 1.3: Tests for `sortTemplates.ts`, `getTemplateName.ts`, `confirmTemplateDeletion.ts`

**Files:**
- Source under test: `packages/shared/sortTemplates.ts`, `packages/shared/getTemplateName.ts`, `packages/shared/confirmTemplateDeletion.ts`
- Test: `packages/shared/test/sortTemplates.test.ts`, `packages/shared/test/getTemplateName.test.ts`, `packages/shared/test/confirmTemplateDeletion.test.ts`

- [x] **Step 1: `getTemplateName.test.ts`**
```ts
import { describe, expect, it } from "vitest";
import getTemplateName from "../getTemplateName";

describe("getTemplateName", () => {
  it("returns templateName when present", () => {
    expect(getTemplateName({ templateName: "Foo" } as any)).toBe("Foo");
  });
  it("falls back to id when templateName is missing", () => {
    expect(getTemplateName({ id: "abc" } as any)).toBe("abc");
  });
  it("falls back to a literal when both are missing", () => {
    expect(getTemplateName({} as any)).toBe("No template name found");
  });
  it("falls back when passed undefined", () => {
    expect(getTemplateName(undefined as any)).toBe("No template name found");
  });
});
```

- [x] **Step 2: `sortTemplates.test.ts`**
```ts
import { describe, expect, it } from "vitest";
import sortTemplates from "../sortTemplates";

describe("sortTemplates", () => {
  it("sorts by template name (locale compare), ascending", () => {
    const input = [{ templateName: "Beta" }, { templateName: "alpha" }, { templateName: "Gamma" }] as any[];
    expect(sortTemplates(input).map((e) => e.templateName)).toEqual(["alpha", "Beta", "Gamma"]);
  });
  it("uses id as the name when templateName is absent", () => {
    const input = [{ id: "b" }, { templateName: "a" }] as any[];
    expect(sortTemplates(input).map((e) => e.templateName ?? e.id)).toEqual(["a", "b"]);
  });
  it("sorts in place and returns the same array reference", () => {
    // KNOWN ISSUE: sortTemplates mutates its argument (Array.prototype.sort)
    const input = [{ templateName: "b" }, { templateName: "a" }] as any[];
    const out = sortTemplates(input);
    expect(out).toBe(input);
  });
});
```

- [x] **Step 3: `confirmTemplateDeletion.test.ts`** — read `packages/shared/confirmTemplateDeletion.ts` first. It almost certainly wraps `window.confirm`. Test with `vi.spyOn(globalThis, "confirm")` returning `true`/`false` and assert the return value / side effect. If it also touches storage, assert via the chrome fake. Follow the patterns above.

- [x] **Step 4: Run, expect PASS**

Run: `npx vitest run --project shared test/sortTemplates.test.ts test/getTemplateName.test.ts test/confirmTemplateDeletion.test.ts`
Expected: all pass.

- [x] **Step 5: Commit**
```bash
git add packages/shared/test/sortTemplates.test.ts packages/shared/test/getTemplateName.test.ts packages/shared/test/confirmTemplateDeletion.test.ts
git commit -m "test(shared): pin sortTemplates / getTemplateName / confirmTemplateDeletion"
```

---

### Task 1.4: `docs/architecture/storage.md` + TSDoc comments

**Files:**
- Create: `docs/architecture/storage.md`
- Modify (TSDoc only): `packages/shared/chromeStorage.ts`, `packages/shared/types.ts`, `packages/shared/getTemplateName.ts`

- [x] **Step 1: Write `docs/architecture/storage.md`** covering: the `chrome.storage.local` model and that everything is namespaced under string keys; the `"entries"` key for templates; the settings keys (`applyNotesSetting` default `true`, `removePopoversSetting` default `false`, `activeTabId` default `undefined`); the import-data key; the `TemplateEntry` shape and the `[key: string]: any` escape hatch (and the historical "`id` was the template name in 0.4.x" note from `getTemplateName`); the array-only assumption baked into `chromeStorage.remove`/`update`; the **known issues** surfaced by the tests (non-array → `[]`; unknown-id update no-ops); and a "who reads/writes what" table (chrome-extension content scripts, side-panel app).
- [x] **Step 2: Add TSDoc** — a one-paragraph doc comment on `chromeStorage.update` and `chromeStorage.remove` noting the array-only assumption and the unknown-id no-op; a doc comment on `TemplateEntry` explaining the `status` enum values and the `[key: string]: any`; a doc comment on `getTemplateName` keeping/expanding the existing 0.4.x note. **No behaviour changes.**
- [x] **Step 3: Verify the suite still passes** (TSDoc edits shouldn't break anything)

Run: `npx vitest run --project shared`
Expected: all pass.

- [x] **Step 4: Commit**
```bash
git add docs/architecture/storage.md packages/shared/chromeStorage.ts packages/shared/types.ts packages/shared/getTemplateName.ts
git commit -m "docs: add storage architecture doc + TSDoc for shared storage layer"
```

---

## Phase 2 — Topic 7: build & release tooling

### Task 2.1: Test `updateManifest.js` via a temp directory

**Files:**
- Source under test (NOT modified): `packages/chrome-extension/updateManifest.js` — wait: confirm location. The script is at repo root: `updateManifest.js`. Use that path.
- Test: `packages/chrome-extension/test/updateManifest.test.ts` *(fast — no Vite build; the temp-dir + `node` spawn is quick enough to keep in the default `test:fast` set; do NOT give it the `.slow` suffix)*

- [ ] **Step 1: Write the failing test `packages/chrome-extension/test/updateManifest.test.ts`**
```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPT = resolve(__dirname, "../../../updateManifest.js"); // repo-root updateManifest.js

describe("updateManifest.js", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "bexio-um-"));
    // Replicate the directory layout the script expects.
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "x", version: "9.9.9", date: "Jan 1, 2000" }, null, 2),
    );
    mkdirSync(join(dir, "packages", "chrome-extension", "public"), { recursive: true });
    writeFileSync(
      join(dir, "packages", "chrome-extension", "public", "manifest.json"),
      JSON.stringify({ name: "m", version: "0.0.0", manifest_version: 3 }, null, 4),
    );
    // The script uses `fs-extra`, which lives in the repo's node_modules; run with cwd=dir but
    // NODE_PATH pointing at the repo node_modules so the require resolves.
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("copies package.json version into manifest.json and stamps today's date into package.json", () => {
    execFileSync(process.execPath, [SCRIPT], {
      cwd: dir,
      env: { ...process.env, NODE_PATH: resolve(__dirname, "../../../node_modules") },
    });
    const manifest = JSON.parse(readFileSync(join(dir, "packages", "chrome-extension", "public", "manifest.json"), "utf8"));
    expect(manifest.version).toBe("9.9.9");
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    // date format: en-US "MMM D, YYYY" — just assert it changed away from the sentinel and parses.
    expect(pkg.date).not.toBe("Jan 1, 2000");
    expect(Number.isNaN(Date.parse(pkg.date))).toBe(false);
  });

  it("only rewrites the version field, leaving other manifest fields intact", () => {
    execFileSync(process.execPath, [SCRIPT], {
      cwd: dir,
      env: { ...process.env, NODE_PATH: resolve(__dirname, "../../../node_modules") },
    });
    const manifest = JSON.parse(readFileSync(join(dir, "packages", "chrome-extension", "public", "manifest.json"), "utf8"));
    expect(manifest.name).toBe("m");
    expect(manifest.manifest_version).toBe(3);
  });
});
```

- [ ] **Step 2: Run, expect PASS**

Run: `npx vitest run --project chrome-extension test/updateManifest.test.ts`
Expected: 2 passed. If the `require("fs-extra")` inside the script fails → adjust `NODE_PATH` (it must point at the repo's `node_modules` that actually contains `fs-extra`). If the script's relative paths don't line up, re-read `updateManifest.js` and replicate exactly what it reads/writes.

- [ ] **Step 3: Commit**
```bash
git add packages/chrome-extension/test/updateManifest.test.ts
git commit -m "test: pin updateManifest.js version/date rewrite via temp dir"
```

---

### Task 2.2: Build smoke test

**Files:**
- Test: `packages/chrome-extension/test/build-smoke.slow.test.ts` *(`.slow` suffix → excluded by `test:fast`, included by `test`)*

- [ ] **Step 1: Write the test `packages/chrome-extension/test/build-smoke.slow.test.ts`**
```ts
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "../../../");
const UNPACKED = resolve(REPO, "unpacked");

function hasPowerShell(): boolean {
  try {
    execFileSync(process.platform === "win32" ? "powershell" : "pwsh", ["-Command", "$PSVersionTable.PSVersion.Major"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe.skipIf(!hasPowerShell())("build smoke test", () => {
  it("produces a valid unpacked/ extension", () => {
    rmSync(UNPACKED, { recursive: true, force: true });
    // Runs Build.ps1 → vite build (dev mode) for both packages.
    execFileSync("npm", ["run", "build:project", "--", "-Development"], {
      cwd: REPO,
      stdio: "inherit",
      shell: process.platform === "win32", // npm.cmd on Windows
    });

    // 1) manifest exists and parses
    const manifestPath = resolve(UNPACKED, "manifest.json");
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

    // 2) version matches root package.json
    const rootPkg = JSON.parse(readFileSync(resolve(REPO, "package.json"), "utf8"));
    expect(manifest.version).toBe(rootPkg.version);

    // 3) every file the manifest references exists in unpacked/
    const referenced: string[] = [];
    for (const cs of manifest.content_scripts ?? []) {
      for (const j of cs.js ?? []) referenced.push(j);
      for (const c of cs.css ?? []) referenced.push(c);
    }
    if (manifest.background?.service_worker) referenced.push(manifest.background.service_worker);
    for (const rel of referenced) {
      const p = resolve(UNPACKED, rel.replace(/^\//, ""));
      expect(existsSync(p), `manifest references missing file: ${rel}`).toBe(true);
    }

    // 4) the side panel built
    expect(existsSync(resolve(UNPACKED, "sidePanel-import", "index.html")), "sidePanel-import/index.html missing").toBe(true);
  }, 180_000); // generous timeout for two Vite builds
});
```
Notes for the implementer:
- `manifest.json` in the repo declares content scripts as `/src/apps/...index.ts` and `bexioTimetrackingTemplates.css`; after the crxjs build the manifest *in `unpacked/`* will have rewritten paths to the built `.js`/`.css` filenames. So we read the **built** manifest (from `unpacked/`), not the source one — which is exactly what step 1 does.
- If `npm run build:project` proves flaky to invoke from inside Vitest on the dev machine, fall back to calling `powershell -File Build.ps1 -Development` directly via `execFileSync`. Document whichever works in `docs/architecture/testing.md` (Task 5.3).

- [ ] **Step 2: Run, expect PASS** (this actually builds — takes ~10–60s)

Run: `npx vitest run --project chrome-extension test/build-smoke.slow.test.ts`
Expected: 1 passed. Confirm it's **excluded** by the fast run: `npm run test:fast` then check this test did not execute.

- [ ] **Step 3: Commit**
```bash
git add packages/chrome-extension/test/build-smoke.slow.test.ts
git commit -m "test: add build smoke test (slow, asserts unpacked/ + manifest invariants)"
```

---

### Task 2.3: `docs/architecture/build-and-release.md`

**Files:**
- Create: `docs/architecture/build-and-release.md`

- [ ] **Step 1: Write the doc** covering: the npm-workspaces layout (`packages/shared`, `packages/sidePanel-import`, `packages/chrome-extension`) and that `shared` has no build step; the `Build.ps1` flag matrix (`-Development` → `build:dev` vs `build`; `-IgnoreExtension`, `-IgnoreSidePanel`, `-CreatePackage`); what ends up in `unpacked/` (the loadable extension) vs `dist/` (the store zip); the Vite + `@crxjs/vite-plugin` pipeline and its quirks (`assetsDir: ""`, `chunkFileNames`/`entryFileNames` hash-stripping, output redirected to `../../unpacked`; the side-panel build's `base: "/sidePanel-import/"`, its `outDir: ../../unpacked/sidePanel-import`, and the React-dedupe aliases); the full `createRelease.ps1` sequence (prompt for patch/minor/major → `version:*` which only bumps `package.json` with `--no-git-tag-version` → `build:newExtensionRelease` → `git-cliff --tag <v>` → `version:updateManifest` (`updateManifest.js`: copies version into `manifest.json`, stamps `date` into `package.json`) → commit `Release: <v>` → tag → checkout `main` → merge tag → `git push --all` → checkout `develop`); `cliff.toml`'s role; **the gotchas:** `Build.ps1`'s `catch` blocks swallow sub-build errors so a "successful" run can leave `unpacked/` stale; `@swc/core` is listed as a dependency in two packages but recent commits suggest it's vestigial; `.npmrc` has `save-exact=true` + `ignore-scripts=true` so deps are pinned and lifecycle scripts (incl. `playwright install`) must be run manually; the dev branch is `develop`, releases land on `main`. Reference `Task 2.1`/`2.2` for what the tests guard.
- [ ] **Step 2: Commit**
```bash
git add docs/architecture/build-and-release.md
git commit -m "docs: add build-and-release architecture doc"
```

---

## Phase 3 — Topic 4: tooltip replacement

### Task 3.1: Tests for `selectors/projectTable_TextCell.ts`

**Files:**
- Source under test: `packages/chrome-extension/src/selectors/projectTable_TextCell.ts`
- Test: `packages/chrome-extension/test/selectors/projectTable_TextCell.test.ts`

- [ ] **Step 1: Write the test**
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";

describe("projectTable_TextCell selectors", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
  });

  it("getPopoverNodes finds every i[rel='popover'] in the monitoring list fixture", async () => {
    loadFixture("monitoring-list");
    const { getPopoverNodes } = await import(
      "@bexio-chrome-extension/chrome-extension/src/selectors/projectTable_TextCell"
    );
    const nodes = getPopoverNodes();
    expect(nodes.length).toBeGreaterThanOrEqual(3);
    nodes.forEach((n) => expect(n.tagName.toLowerCase()).toBe("i"));
  });

  it("getPopoverNodeText returns the data-content attribute", async () => {
    loadFixture("monitoring-list");
    const { getPopoverNodes, getPopoverNodeText } = await import(
      "@bexio-chrome-extension/chrome-extension/src/selectors/projectTable_TextCell"
    );
    const first = getPopoverNodes()[0];
    expect(getPopoverNodeText(first)).toBe(first.getAttribute("data-content"));
  });

  it("works the same on the project listMonitoring and showPackage fixtures", async () => {
    for (const fixture of ["pr_project-listMonitoring", "pr_project-showPackage"]) {
      vi.resetModules();
      document.body.innerHTML = "";
      loadFixture(fixture);
      const { getPopoverNodes } = await import(
        "@bexio-chrome-extension/chrome-extension/src/selectors/projectTable_TextCell"
      );
      expect(getPopoverNodes().length).toBeGreaterThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: Run, expect PASS.** If `getPopoverNodes().length` is `0`, the fixture trimming in Task 0.5 dropped all tooltip rows — go back and re-trim that fixture to keep ≥3 rows with `i[rel='popover']`.

Run: `npx vitest run --project chrome-extension test/selectors/projectTable_TextCell.test.ts`

- [ ] **Step 3: Commit**
```bash
git add packages/chrome-extension/test/selectors/projectTable_TextCell.test.ts
git commit -m "test: pin projectTable_TextCell popover selectors against fixtures"
```

---

### Task 3.2: Tests for `convertPopover.ts`

**Files:**
- Source under test: `packages/chrome-extension/src/utils/convertPopover.ts`
- Test: `packages/chrome-extension/test/utils/convertPopover.test.ts`

- [ ] **Step 1: Write the test** — note `convertPopover` reads `chromeStorageSettings.loadRemovePopoversSetting()` (default `false`), so to exercise the "convert" path the test must first `chrome.storage.local.set({ removePopoversSetting: true })`.
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";

const importConvert = () =>
  import("@bexio-chrome-extension/chrome-extension/src/utils/convertPopover");

describe("convertPopover", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
  });

  it("does nothing (revert path) when removePopoversSetting is falsy", async () => {
    loadFixture("monitoring-list");
    const before = document.body.innerHTML;
    const { default: convertPopover } = await importConvert();
    await convertPopover();
    // No .new-popover-text injected; popover <i> still inline-block (revert sets it explicitly).
    expect(document.querySelectorAll(".new-popover-text").length).toBe(0);
  });

  it("converts: hides each popover <i>, injects .new-popover-text with decoded text, alternates row colours", async () => {
    await chrome.storage.local.set({ removePopoversSetting: true });
    loadFixture("monitoring-list");
    const { default: convertPopover } = await importConvert();
    const popovers = document.querySelectorAll<HTMLElement>("i[rel='popover']");
    const expectedCount = popovers.length;
    expect(expectedCount).toBeGreaterThanOrEqual(3);

    await convertPopover();

    const texts = document.querySelectorAll(".new-popover-text");
    expect(texts.length).toBe(expectedCount);
    popovers.forEach((p) => expect(p.style.display).toBe("none"));
    // entity decoding: a fixture row whose data-content has "&amp;" must render "&" (not "&amp;")
    const decoded = Array.from(texts).map((t) => t.textContent ?? "");
    expect(decoded.some((t) => t.includes("&") && !t.includes("&amp;"))).toBe(true);
    // alternating background colours on the parents
    const parents = Array.from(popovers).map((p) => p.parentElement as HTMLElement);
    expect(parents[0].style.backgroundColor).toBe("rgb(255, 226, 188)"); // #ffe2bc
  });

  it("is idempotent: a second convert call does not double-inject", async () => {
    await chrome.storage.local.set({ removePopoversSetting: true });
    loadFixture("monitoring-list");
    const { default: convertPopover } = await importConvert();
    await convertPopover();
    const after1 = document.querySelectorAll(".new-popover-text").length;
    await convertPopover();
    const after2 = document.querySelectorAll(".new-popover-text").length;
    expect(after2).toBe(after1);
  });

  it("revertPopover restores: removes .new-popover-text, un-hides <i>, clears parent background", async () => {
    await chrome.storage.local.set({ removePopoversSetting: true });
    loadFixture("monitoring-list");
    const { default: convertPopover, revertPopover } = await importConvert();
    await convertPopover();
    revertPopover();
    expect(document.querySelectorAll(".new-popover-text").length).toBe(0);
    document.querySelectorAll<HTMLElement>("i[rel='popover']").forEach((p) => {
      expect(p.style.display).toBe("inline-block");
      expect((p.parentElement as HTMLElement).style.backgroundColor).toBe("");
    });
  });
});
```
Implementer notes: `convertPopover` uses `DOMPurify` — it imports `dompurify` which works in jsdom. If DOMPurify init complains under jsdom, it usually needs a `window`; jsdom provides one, so it should be fine. `getComputedStyle`/`element.style.backgroundColor` returns the CSS-serialised form (`rgb(...)`), hence the `"rgb(255, 226, 188)"` expectation for `#ffe2bc` and `"antiquewhite"` would serialise to itself or to rgb — verify against the actual jsdom output and adjust the literal if needed (this is a "pin actual behaviour" assertion).

- [ ] **Step 2: Run, expect PASS** (adjust colour literals to whatever jsdom actually produces; that's pinning, not fixing)

Run: `npx vitest run --project chrome-extension test/utils/convertPopover.test.ts`

- [ ] **Step 3: Commit**
```bash
git add packages/chrome-extension/test/utils/convertPopover.test.ts
git commit -m "test: pin convertPopover convert/revert/idempotency behaviour against fixture"
```

---

### Task 3.3: Test the page-path → observer-target selection in `apps/bexioProjectList/index.ts`

**Files:**
- Source: `packages/chrome-extension/src/apps/bexioProjectList/index.ts`
- Test: `packages/chrome-extension/test/apps/bexioProjectList.test.ts`

The module currently does its work at import time (`initializeExtension()` + `observingTableModifications()`) and the path→node logic is not exported. **Do not refactor the source.** Instead, this test does what it can without exporting internals: load a fixture, set `window.location` (jsdom allows `Object.defineProperty(window, "location", …)` or `history.pushState`), import the module, and assert observable effects — i.e. that after import (with `removePopoversSetting` falsy) nothing crashed and `renderHtml()` ran (it should have added the "Text mode" toggle button; check for whatever id/class `renderHtml.ts` injects — read `packages/chrome-extension/src/apps/bexioProjectList/renderHtml.ts` to find it). If the module throws on import under jsdom because some bexio global is missing, wrap the import in the test and assert the specific failure, then add a `// KNOWN ISSUE:` note and document it — that itself is a finding worth recording.

- [ ] **Step 1: Read `renderHtml.ts` and `index.ts` carefully; decide what is observable.**
- [ ] **Step 2: Write the test** — at minimum:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";

describe("bexioProjectList content script", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("imports without throwing on the monitoring list page and injects its UI", async () => {
    // jsdom URL defaults to http://localhost/; set the pathname the script checks for.
    vi.stubGlobal("location", { ...window.location, pathname: "/index.php/monitoring/list" } as Location);
    loadFixture("monitoring-list");
    await expect(import("@bexio-chrome-extension/chrome-extension/src/apps/bexioProjectList/index")).resolves.toBeDefined();
    // assert renderHtml's injected element exists — replace SELECTOR with the real one from renderHtml.ts
    // expect(document.querySelector(SELECTOR)).not.toBeNull();
  });
});
```
Fill in the real injected-element selector in Step 1's reading. If `vi.stubGlobal("location", …)` doesn't take effect for the module's `location.pathname` check, use `Object.defineProperty(window, "location", { value: new URL(...) , configurable: true })` before import, or `window.history.pushState({}, "", "/index.php/monitoring/list")`.

- [ ] **Step 3: Run, expect PASS** (or a documented, asserted failure)

Run: `npx vitest run --project chrome-extension test/apps/bexioProjectList.test.ts`

- [ ] **Step 4: Commit**
```bash
git add packages/chrome-extension/test/apps/bexioProjectList.test.ts
git commit -m "test: smoke-test bexioProjectList content script import + UI injection"
```

---

### Task 3.4: `docs/architecture/tooltip-replacement.md` + TSDoc

**Files:**
- Create: `docs/architecture/tooltip-replacement.md`
- Modify (TSDoc only): `packages/chrome-extension/src/utils/convertPopover.ts`, `packages/chrome-extension/src/apps/bexioProjectList/index.ts`, `packages/chrome-extension/src/selectors/projectTable_TextCell.ts`

- [ ] **Step 1: Write the doc** covering: which bexio pages the `bexioProjectList` content script matches (`monitoring/list`, `pr_project/listMonitoring/*`, `pr_project/showPackage/*`, and the **deferred/uncertain** `kb_invoice/show/id/*` — note that the "weitere Positionen → erfasste Zeit" path appears to have changed in current bexio and the `kb_invoice` branch is unverified, flagged for a follow-up); the per-page `MutationObserver` setup in `index.ts` and **why** (bexio re-renders these tables via its own AJAX; the observer re-runs `convertPopover` on `childList` changes); the convert/revert cycle in `convertPopover.ts` (toggled by `removePopoversSetting`, default `false`); the DOMPurify sanitisation step and the HTML-entity decoding via a temp `<div>`; the alternating row colours; the "Text mode / Popover mode" toggle button injected by `renderHtml.ts` and where it appears; and how to add coverage for a new page (capture a fixture, add a row to the selectors test).
- [ ] **Step 2: Add TSDoc** — doc comment on `convertPopover` (the setting gate, the idempotency check via `visiblePopoverNodes`, the sanitise+decode flow), on `getPopoverNodes`/`getPopoverNodeText` (the `i[rel='popover']` / `data-content` contract), and on the observer factory in `index.ts` (why "once per mutation batch"). **No behaviour changes.**
- [ ] **Step 3: Verify suite still green**

Run: `npx vitest run --project chrome-extension test/selectors/projectTable_TextCell.test.ts test/utils/convertPopover.test.ts test/apps/bexioProjectList.test.ts`

- [ ] **Step 4: Commit**
```bash
git add docs/architecture/tooltip-replacement.md packages/chrome-extension/src/utils/convertPopover.ts packages/chrome-extension/src/apps/bexioProjectList/index.ts packages/chrome-extension/src/selectors/projectTable_TextCell.ts
git commit -m "docs: add tooltip-replacement architecture doc + TSDoc"
```

---

## Phase 4 — Topic 5: form-manipulation layer

> All tests in this phase use the `monitoring-edit.html` fixture (and `monitoring-edit-filled.html` for read-back). Remember the module-load quirk: `loadFixture("monitoring-edit")` **before** `await import(...)` the module under test, with `vi.resetModules()` per test. For anything using `delay`/`waitFor*`, use `vi.useFakeTimers()` and `await vi.runAllTimersAsync()`.

### Task 4.1: Tests for the form selectors

**Files:**
- Source: `packages/chrome-extension/src/selectors/selectors.ts`, `billableCheckbox.ts`, `contactField.ts`, `dateField.ts`, `descriptionField.ts`, `durationField.ts`
- Test: `packages/chrome-extension/test/selectors/formSelectors.test.ts`

- [ ] **Step 1: Write the test**
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";

describe("form selectors (against monitoring-edit fixture)", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
  });

  it("selectors.ts resolves the select2 field ids and their inner inputs", async () => {
    loadFixture("monitoring-edit");
    const sel = await import("@bexio-chrome-extension/chrome-extension/src/selectors/selectors");
    expect(sel.workFieldID).toBe("#s2id_monitoring_client_service_id");
    expect(document.querySelector(sel.workFieldID)).not.toBeNull();
    expect(sel.workField).not.toBeNull(); // module-load query found `${workFieldID} input`
    expect(document.querySelector(sel.statusFieldID)).not.toBeNull();
    expect(document.querySelector(sel.projectFieldID)).not.toBeNull();
    expect(document.querySelector(sel.packageFieldID)).not.toBeNull();
    expect(document.querySelector(sel.contactPersonID)).not.toBeNull();
    expect(sel.loaderId).toBe("SoulcodeExtensionLoader");
  });

  it("billableCheckbox / contactField / dateField / durationField resolve to the right inputs", async () => {
    loadFixture("monitoring-edit");
    const { billableCheckbox } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/billableCheckbox");
    const { contactField } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/contactField");
    const { dateField } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/dateField");
    const { durationField } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/durationField");
    expect(billableCheckbox).toBeInstanceOf(HTMLInputElement);
    expect(billableCheckbox.type).toBe("checkbox");
    expect(contactField).toBeInstanceOf(HTMLInputElement);
    expect(dateField).toBeInstanceOf(HTMLInputElement);
    expect(durationField).toBeInstanceOf(HTMLInputElement);
  });

  it("getDescriptionField throws when the tinymce iframe document isn't populated", async () => {
    loadFixture("monitoring-edit"); // iframe element present, but jsdom won't have its inner #tinymce
    const { getDescriptionField } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/descriptionField");
    expect(() => getDescriptionField()).toThrow("Description field not found");
    // KNOWN LIMITATION: testing the success path requires manually injecting #tinymce into the iframe's
    // contentDocument — see Task 4.5 for how triggerDescription tests handle it.
  });
});
```

- [ ] **Step 2: Run, expect PASS**

Run: `npx vitest run --project chrome-extension test/selectors/formSelectors.test.ts`

- [ ] **Step 3: Commit**
```bash
git add packages/chrome-extension/test/selectors/formSelectors.test.ts
git commit -m "test: pin form selectors against monitoring-edit fixture"
```

---

### Task 4.2: Tests for `triggerField`, `triggerCheckbox`, `triggerDate`, `triggerDuration`

**Files:**
- Source: `packages/chrome-extension/src/utils/triggerField.ts`, `triggerCheckbox.ts`, `triggerDate.ts`, `triggerDuration.ts`
- Tests: `packages/chrome-extension/test/utils/triggerField.test.ts`, `triggerCheckbox.test.ts`, `triggerDate.test.ts`, `triggerDuration.test.ts`

- [ ] **Step 1: Read each of these four source files** (they were not quoted in the spec). For each, note: what element it targets, what value/state it sets, what events it dispatches (`input`, `change`, `keydown`, custom), whether it `await`s a `delay`/`waitFor*`, and whether it depends on a select2 container being present.
- [ ] **Step 2: Write `triggerCheckbox.test.ts`** (the simplest — worked example):
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";

describe("triggerCheckbox", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
  });

  it("sets a checkbox to checked and fires a change event when value is true", async () => {
    loadFixture("monitoring-edit");
    const { billableCheckbox } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/billableCheckbox");
    const { default: triggerCheckbox } = await import("@bexio-chrome-extension/chrome-extension/src/utils/triggerCheckbox");
    const onChange = vi.fn();
    billableCheckbox.addEventListener("change", onChange);
    expect(billableCheckbox.checked).toBe(false);
    await triggerCheckbox(billableCheckbox, true);
    expect(billableCheckbox.checked).toBe(true);
    expect(onChange).toHaveBeenCalled();
  });

  it("unchecks when value is false", async () => {
    loadFixture("monitoring-edit");
    const { billableCheckbox } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/billableCheckbox");
    const { default: triggerCheckbox } = await import("@bexio-chrome-extension/chrome-extension/src/utils/triggerCheckbox");
    billableCheckbox.checked = true;
    await triggerCheckbox(billableCheckbox, false);
    expect(billableCheckbox.checked).toBe(false);
  });

  // If triggerCheckbox no-ops when current state already equals target, add a case pinning that.
}); 
```
- [ ] **Step 3: Write `triggerDate.test.ts` and `triggerDuration.test.ts`** following the same pattern: load fixture, import the selector + the trigger, call it with a value (`"13.05.2026"` for date; `"01:30"` for duration — match the format the code expects, discovered in Step 1), assert `input.value` and that the expected events fired (spy with `vi.fn()` on the element). Use fake timers if the source `await`s a delay.
- [ ] **Step 4: Write `triggerField.test.ts`** — `triggerField(selectorId, value)` operates on a select2 widget: it likely sets the underlying `<select>` value (or the `select2-chosen` text) and dispatches `change`. From the fixture, `#s2id_monitoring_monitoring_status_id` has options `Offen/In Arbeit/Erledigt/Fakturiert/Geschlossen`. Test: `triggerField(statusFieldID, "In Arbeit")` results in the select's value/selected option being "In Arbeit" (or whatever the code actually does — pin it). Also test the `value === null` branch (the code is called with `null` from `fillForm` for absent fields) — assert it does nothing / clears, per actual behaviour.
- [ ] **Step 5: Run all four, expect PASS** (adjust assertions to actual behaviour where the source differs from the assumptions above)

Run: `npx vitest run --project chrome-extension test/utils/triggerField.test.ts test/utils/triggerCheckbox.test.ts test/utils/triggerDate.test.ts test/utils/triggerDuration.test.ts`

- [ ] **Step 6: Commit**
```bash
git add packages/chrome-extension/test/utils/triggerField.test.ts packages/chrome-extension/test/utils/triggerCheckbox.test.ts packages/chrome-extension/test/utils/triggerDate.test.ts packages/chrome-extension/test/utils/triggerDuration.test.ts
git commit -m "test: pin triggerField / triggerCheckbox / triggerDate / triggerDuration"
```

---

### Task 4.3: Tests for `triggerContactField` and the `waitFor*` helpers

**Files:**
- Source: `packages/chrome-extension/src/utils/triggerContactField.ts`, `waitForContacts.ts`, `waitForSearchBoxField.ts`, `waitForSearchBoxFieldToBeRemoved.ts`, `waitForSelectOptions.ts`
- Tests: `packages/chrome-extension/test/utils/triggerContactField.test.ts`, `packages/chrome-extension/test/utils/waitFor.test.ts`

- [ ] **Step 1: Read all five source files.** Note each `waitFor*`'s polling interval, timeout, success condition, and resolve/reject behaviour on timeout.
- [ ] **Step 2: Write `waitFor.test.ts`** — pattern for a polling helper, using fake timers and mutating the DOM mid-wait:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";

describe("waitFor* helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("waitForSearchBoxField resolves once the select2 search input appears", async () => {
    loadFixture("monitoring-edit");
    const { default: waitForSearchBoxField } = await import("@bexio-chrome-extension/chrome-extension/src/utils/waitForSearchBoxField");
    // The fixture already contains #s2id_autogenN_search inputs inside select2-drop; if the helper
    // expects the drop to be *open* (not display:none), open it first, then:
    const p = waitForSearchBoxField(/* args from source */);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBeDefined();
  });

  it("waitForX rejects/resolves-empty on timeout when the element never appears", async () => {
    loadFixture("monitoring-edit");
    const { default: waitForSearchBoxField } = await import("@bexio-chrome-extension/chrome-extension/src/utils/waitForSearchBoxField");
    // remove whatever it's waiting for so it can never succeed
    const p = waitForSearchBoxField(/* args */).catch((e) => e);
    await vi.runAllTimersAsync();
    const result = await p;
    // pin whichever it is: a thrown Error, or undefined, or false
    expect(result).toBeDefined();
  });
});
```
Fill in the real call signatures and the real timeout/success semantics from Step 1. Write one resolve-path and one timeout-path test per `waitFor*` helper.
- [ ] **Step 3: Write `triggerContactField.test.ts`** — `triggerContactField(contactField, contactValue)` drives the jQuery-UI autocomplete (`#autocomplete_monitoring_contact_id`): it likely sets `.value`, dispatches `keydown`/`input` to trigger the autocomplete, waits for results, and picks one. In jsdom none of bexio's autocomplete JS runs, so the realistic assertions are: it sets `contactField.value` to the requested string and fires the expected events; if it `await`s a `waitFor*` that can never succeed in jsdom, it should time out gracefully — pin that. Use fake timers.
- [ ] **Step 4: Run, expect PASS** (adjust to actual behaviour)

Run: `npx vitest run --project chrome-extension test/utils/triggerContactField.test.ts test/utils/waitFor.test.ts`

- [ ] **Step 5: Commit**
```bash
git add packages/chrome-extension/test/utils/triggerContactField.test.ts packages/chrome-extension/test/utils/waitFor.test.ts
git commit -m "test: pin triggerContactField + waitFor* polling helpers"
```

---

### Task 4.4: Tests for `fillForm.ts`

**Files:**
- Source: `packages/chrome-extension/src/utils/fillForm.ts`
- Test: `packages/chrome-extension/test/utils/fillForm.test.ts`

`fillForm(id, timeEntryBillable?)`: loads templates from storage, finds the one with that `id`, then `triggerField(workFieldID, "work")`, `triggerField(statusFieldID, status)`, `triggerContactField(contactField, contact)`, `triggerField(contactPersonID, contactPerson)`, `triggerField(projectFieldID, project)`, `triggerField(packageFieldID, packageValue)`, `triggerCheckbox(billableCheckbox, timeEntryBillable ?? billable)`, toggles the loader, and focuses `#MonitoringForm .save`.

- [ ] **Step 1: Write the test** — strategy: seed a template in the chrome-storage fake, load the fixture, spy on the trigger modules with `vi.mock(...)` (mock `triggerField`, `triggerContactField`, `triggerCheckbox`, and `loader`) so we assert *orchestration* (which functions called, with what args, in what order) without depending on jsdom faithfully reproducing select2:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";
import type { TemplateEntry } from "@bexio-chrome-extension/shared/types";

const calls: string[] = [];
vi.mock("@bexio-chrome-extension/chrome-extension/src/utils/triggerField", () => ({
  default: vi.fn(async (sel: string, val: unknown) => { calls.push(`field:${sel}:${String(val)}`); }),
}));
vi.mock("@bexio-chrome-extension/chrome-extension/src/utils/triggerContactField", () => ({
  default: vi.fn(async (_el: unknown, val: unknown) => { calls.push(`contact:${String(val)}`); }),
}));
vi.mock("@bexio-chrome-extension/chrome-extension/src/utils/triggerCheckbox", () => ({
  default: vi.fn(async (_el: unknown, val: unknown) => { calls.push(`billable:${String(val)}`); }),
}));
vi.mock("@bexio-chrome-extension/chrome-extension/src/utils/loader", () => ({
  toggleDisplayLoader: vi.fn((show?: boolean) => { calls.push(`loader:${show === false ? "off" : "on"}`); }),
}));

const template = (over: Partial<TemplateEntry> = {}): TemplateEntry => ({
  templateName: "T", keywords: "", billable: false, contact: "Acme AG", contactPerson: "Doe Jane",
  id: "tmpl1", package: "Package Alpha", project: "Project Falcon", status: "In Arbeit", work: "", ...over,
});

describe("fillForm", () => {
  beforeEach(() => {
    vi.resetModules();
    calls.length = 0;
    document.body.innerHTML = "";
  });

  it("applies all template fields in order, toggles the loader, focuses the save button", async () => {
    await chrome.storage.local.set({ entries: [template()] });
    loadFixture("monitoring-edit");
    const { default: fillForm } = await import("@bexio-chrome-extension/chrome-extension/src/utils/fillForm");
    await fillForm("tmpl1");
    expect(calls[0]).toBe("loader:on");
    // work, status, contact, contactPerson, project, package, billable, loader:off  (verify order against source)
    expect(calls).toContain("contact:Acme AG");
    expect(calls).toContain("billable:false");
    expect(calls[calls.length - 1]).toBe("loader:off");
    const saveBtn = document.querySelector("#MonitoringForm .save") as HTMLElement;
    expect(document.activeElement).toBe(saveBtn);
  });

  it("timeEntryBillable overrides the template's billable flag", async () => {
    await chrome.storage.local.set({ entries: [template({ billable: false })] });
    loadFixture("monitoring-edit");
    const { default: fillForm } = await import("@bexio-chrome-extension/chrome-extension/src/utils/fillForm");
    await fillForm("tmpl1", true);
    expect(calls).toContain("billable:true");
  });

  it("defaults billable to true when the template has no billable field", async () => {
    const t = template(); delete (t as Partial<TemplateEntry>).billable;
    await chrome.storage.local.set({ entries: [t] });
    loadFixture("monitoring-edit");
    const { default: fillForm } = await import("@bexio-chrome-extension/chrome-extension/src/utils/fillForm");
    await fillForm("tmpl1");
    expect(calls).toContain("billable:true"); // `billable = true` default in the destructure
  });

  it("passes null to triggerField for absent project/package/status/contactPerson", async () => {
    await chrome.storage.local.set({ entries: [template({ project: undefined as any, package: undefined as any, status: undefined as any, contactPerson: undefined as any })] });
    loadFixture("monitoring-edit");
    const { default: fillForm } = await import("@bexio-chrome-extension/chrome-extension/src/utils/fillForm");
    await fillForm("tmpl1");
    expect(calls).toContain("field:#s2id_monitoring_pr_project_id:null");
    expect(calls).toContain("field:#s2id_monitoring_pr_package_id:null");
  });
});
```
Implementer notes: confirm the exact call **order** from `fillForm.ts` and assert it precisely (compare the `calls` array to an expected array). `vi.mock` is hoisted — keep the factory functions self-contained (no outer refs except module-level `calls`, which is allowed because `vi.mock` factories may reference hoisted `vi` and module-scope vars declared with `var`/`let` *after* hoisting only if you use `vi.hoisted` — to be safe, declare `const calls` and the mocks may need `vi.hoisted(() => ({ calls: [] as string[] }))`; use that pattern if Vitest errors about referencing `calls` before initialisation).

- [ ] **Step 2: Run, expect PASS**

Run: `npx vitest run --project chrome-extension test/utils/fillForm.test.ts`

- [ ] **Step 3: Commit**
```bash
git add packages/chrome-extension/test/utils/fillForm.test.ts
git commit -m "test: pin fillForm orchestration (field order, billable precedence, loader, focus)"
```

---

### Task 4.5: Tests for `readFormData.ts` and `readTextFromSelect2.ts`

**Files:**
- Source: `packages/chrome-extension/src/utils/readFormData.ts`, `packages/chrome-extension/src/utils/readTextFromSelect2.ts`
- Test: `packages/chrome-extension/test/utils/readFormData.test.ts`

- [ ] **Step 1: Read `readTextFromSelect2.ts`** (not quoted in the spec). It takes a select2 inner input element and returns the chosen text — probably from the `.select2-chosen` span. Write `readTextFromSelect2` tests against `monitoring-edit-filled.html`: pass the work/status/project/package/contactPerson inner inputs (via the selectors module) and assert the returned strings match the (anonymised) chosen text in the fixture.
- [ ] **Step 2: Write `readFormData` tests.** `readFormData` is interactive — it calls `prompt()`, `alert()`, `confirm()`, `generateHash`, loads/saves templates, and calls `initializeExtension()`. To test it: `vi.spyOn(globalThis, "prompt").mockReturnValue("My Template")`, `vi.spyOn(globalThis, "alert").mockImplementation(() => {})`, `vi.spyOn(globalThis, "confirm").mockReturnValue(true)`, `vi.mock` the `apps/bexioTimetrackingTemplates/index` module's `initializeExtension` to a spy, load `monitoring-edit-filled.html`, then call `readFormData()` and assert: a new entry was saved to `chrome.storage.local` under `entries` with the expected `work/status/contact/project/package/billable/contactPerson/templateName` (anonymised values from the fixture) and a 64-hex-char `id`; that `prompt` returning `null` triggers `alert` and aborts (nothing saved). Keep assertions to what's robust given jsdom can't run select2 — if `readTextFromSelect2` returns `""` for everything in jsdom because the `.select2-chosen` spans aren't wired the way the code expects, **pin that** (`templateName` would then fall back through the `||` chain) and note it.
- [ ] **Step 3: Run, expect PASS**

Run: `npx vitest run --project chrome-extension test/utils/readFormData.test.ts`

- [ ] **Step 4: Commit**
```bash
git add packages/chrome-extension/test/utils/readFormData.test.ts
git commit -m "test: pin readFormData / readTextFromSelect2 against filled fixture"
```

---

### Task 4.6: Tests for `loader.ts`, `delay.ts`, `trimAll.ts`, `pressEnter.ts`, `generateHash.ts`

**Files:**
- Source: `packages/chrome-extension/src/utils/loader.ts`, `delay.ts`, `trimAll.ts`, `pressEnter.ts`, `generateHash.ts`
- Test: `packages/chrome-extension/test/utils/misc-utils.test.ts`

- [ ] **Step 1: Read each source file.** Then write tests:
  - `delay(ms)` — returns a promise that resolves after `ms`; with fake timers, `const p = delay(100); let done=false; p.then(()=>done=true); await vi.advanceTimersByTimeAsync(99); expect(done).toBe(false); await vi.advanceTimersByTimeAsync(1); expect(done).toBe(true);`
  - `trimAll(input)` — read the impl; it's used as `trimAll(packageValue)` and `trimAll(workField)` (note: `workField` is an Element!), so it must tolerate both strings and elements/null. Test: `trimAll("  a  b ")` → pin the result (likely `"ab"` or `"a b"`); `trimAll(null)` / `trimAll(undefined)` → pin (probably `""`); `trimAll(someElement)` → pin.
  - `loader.toggleDisplayLoader(show?)` — needs `#SoulcodeExtensionLoader` in the DOM (present in `monitoring-edit.html`, or build a minimal `<div id="SoulcodeExtensionLoader" style="display:none">`). `toggleDisplayLoader()` → `display: flex` (or whatever "show" sets); `toggleDisplayLoader(false)` → `display: none`. Pin actual values.
  - `pressEnter(element)` — dispatches a keydown/keyup with key "Enter"/keyCode 13. Spy with `vi.fn()` on the element for `keydown`; assert it was called with a `KeyboardEvent` whose `key === "Enter"` (and `keyCode`/`which` === 13 if the code sets them).
  - `generateHash(string)` — SHA-256 hex. `crypto.subtle` is available in Node 22's global `crypto`. Assert `await generateHash("abc")` === the known SHA-256 of "abc" (`"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"`), and that it's 64 lowercase hex chars.
- [ ] **Step 2: Run, expect PASS**

Run: `npx vitest run --project chrome-extension test/utils/misc-utils.test.ts`

- [ ] **Step 3: Commit**
```bash
git add packages/chrome-extension/test/utils/misc-utils.test.ts
git commit -m "test: pin loader / delay / trimAll / pressEnter / generateHash"
```

---

### Task 4.7: `docs/architecture/form-layer.md` + TSDoc

**Files:**
- Create: `docs/architecture/form-layer.md`
- Modify (TSDoc only): `packages/chrome-extension/src/selectors/selectors.ts`, the `waitFor*` files, `packages/chrome-extension/src/utils/fillForm.ts`

- [ ] **Step 1: Write the doc** covering: why this layer exists (bexio's form is built on jQuery + select2 + jQuery-UI autocomplete/datepicker/timepicker widgets, so you can't just set `.value` — you must drive the widgets); the field map (Tätigkeit=`monitoring_client_service_id`/select2 → template `work`-ish; Status=`monitoring_monitoring_status_id`/select2; Kontakt=`monitoring_contact_id` hidden + `autocomplete_monitoring_contact_id` text autocomplete; Kontaktperson=`monitoring_sub_contact_id`/select2; Projekt=`monitoring_pr_project_id`/select2 (options AJAX-loaded); Arbeitspaket=`monitoring_pr_package_id`/select2; abrechenbar=`monitoring_allowable_bill` checkbox; Datum=`monitoring_date` datepicker; Dauer=`monitoring_duration` timepicker; Bemerkungen=`monitoring_text` → tinymce iframe `#monitoring_text_ifr`/`#tinymce`); the synthetic-event recipe per field type (what `triggerField`/`triggerContactField`/`triggerCheckbox`/`triggerDate`/`triggerDuration`/`pressEnter` actually dispatch); why the `waitFor*` polling exists (select2 options and the autocomplete results load async) and each helper's timeout; the `fillForm` field order and the `timeEntryBillable ?? billable` precedence rule and the loader-toggle + save-button-focus tail; the read-back path (`readFormData` → `readTextFromSelect2` → templates storage); the **module-load quirk** (selector consts are captured at import time, which is why the content script only works because it's injected after the page renders, and why tests load the fixture before importing); and a **"blast radius" map** — the selectors/assumptions most likely to break when bexio changes markup (the `#s2id_monitoring_*` ids, the `#autocomplete_monitoring_contact_id` autocomplete contract, the tinymce iframe id, the `.save` submit button, the `select2-chosen` text-extraction in `readTextFromSelect2`), each cross-referenced to the test that would catch it.
- [ ] **Step 2: Add TSDoc** on `selectors.ts` (the import-time-capture caveat), each `waitFor*` (interval/timeout/success-condition/timeout-behaviour), and `fillForm` (the orchestration order + the billable rule). **No behaviour changes.**
- [ ] **Step 3: Verify suite still green**

Run: `npx vitest run --project chrome-extension`
Expected: all pass (this also runs the slow build test — that's fine, or use `--exclude "**/*.slow.test.ts"` to skip it here).

- [ ] **Step 4: Commit**
```bash
git add docs/architecture/form-layer.md packages/chrome-extension/src/selectors/selectors.ts packages/chrome-extension/src/utils/waitFor*.ts packages/chrome-extension/src/utils/fillForm.ts
git commit -m "docs: add form-layer architecture doc + TSDoc"
```

---

## Phase 5 — Playwright extension-smoke layer

### Task 5.1: Add Playwright + config

**Files:**
- Modify: `package.json` (root)
- Create: `e2e/playwright.config.ts`

- [ ] **Step 1: Install Playwright (exact-pinned)**
```bash
npm install --save-dev --save-exact @playwright/test
npx playwright install chromium
```
(`npx playwright install` is needed because `.npmrc` `ignore-scripts=true` suppresses the auto-download.)

- [ ] **Step 2: Create `e2e/playwright.config.ts`**
```ts
import { defineConfig } from "@playwright/test";
import path from "node:path";

const UNPACKED = path.resolve(__dirname, "../unpacked");

export default defineConfig({
  testDir: __dirname,
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    // Chromium is launched per-test via launchPersistentContext (extensions need a persistent context);
    // we don't use the default `browser` fixture. See extension-smoke.spec.ts.
  },
  metadata: { unpackedPath: UNPACKED },
});
```

- [ ] **Step 3: Verify Playwright runs (no tests yet)**

Run: `npx playwright test --config e2e/playwright.config.ts --list`
Expected: "No tests found" (or lists nothing) — no crash.

- [ ] **Step 4: Commit**
```bash
git add package.json package-lock.json e2e/playwright.config.ts
git commit -m "chore(test): add playwright + e2e config (extension-smoke layer)"
```

---

### Task 5.2: Extension-smoke test

**Files:**
- Create: `e2e/extension-smoke.spec.ts`
- Create (if `file://` doesn't satisfy the content-script matches): `e2e/support/static-server.ts`

- [ ] **Step 1: Decide page-serving strategy.** The manifest's content scripts only run on `https://office.bexio.com/...` URLs. To make them run against a local fixture, the cleanest options are: (a) Playwright `context.route("https://office.bexio.com/**", route => route.fulfill({ body: fixtureHtml, contentType: "text/html" }))` — intercepts the navigation and serves the fixture while the URL still matches the manifest pattern; **prefer this**. (b) failing that, a tiny local HTTPS server + a manifest tweak in a test-only copy of `unpacked/` (more work — avoid).
- [ ] **Step 2: Write `e2e/extension-smoke.spec.ts`**
```ts
import { test, expect, chromium, type BrowserContext } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const REPO = path.resolve(__dirname, "..");
const UNPACKED = path.resolve(REPO, "unpacked");
const FIXTURES = path.resolve(REPO, "packages/chrome-extension/test/fixtures/bexio");

function ensureBuilt() {
  if (existsSync(path.join(UNPACKED, "manifest.json"))) return;
  execFileSync("npm", ["run", "build:project", "--", "-Development"], {
    cwd: REPO, stdio: "inherit", shell: process.platform === "win32",
  });
}

let context: BrowserContext;

test.beforeAll(async () => {
  ensureBuilt();
  context = await chromium.launchPersistentContext("", {
    headless: true, // newer Chromium supports extensions in headless=new
    args: [
      `--disable-extensions-except=${UNPACKED}`,
      `--load-extension=${UNPACKED}`,
    ],
  });
});

test.afterAll(async () => { await context?.close(); });

test("content script injects the template UI on the monitoring/edit page", async () => {
  const page = await context.newPage();
  const fixture = readFileSync(path.join(FIXTURES, "monitoring-edit.html"), "utf8");
  // Serve the fixture under a URL the manifest matches.
  await page.route("https://office.bexio.com/index.php/monitoring/edit", (route) =>
    route.fulfill({ contentType: "text/html", body: `<!doctype html><html><head><title>t</title></head><body>${fixture}</body></html>` }),
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("https://office.bexio.com/index.php/monitoring/edit");
  // The content script renders #SoulcodeExtensionTemplates (and the template buttons).
  await expect(page.locator("#SoulcodeExtensionTemplates")).toBeAttached({ timeout: 10_000 });
  expect(errors, `page errors: ${errors.join("\n")}`).toEqual([]);
});

test("content script injects the Text-mode toggle on the monitoring/list page", async () => {
  const page = await context.newPage();
  const fixture = readFileSync(path.join(FIXTURES, "monitoring-list.html"), "utf8");
  await page.route("https://office.bexio.com/index.php/monitoring/list", (route) =>
    route.fulfill({ contentType: "text/html", body: `<!doctype html><html><head><title>t</title></head><body>${fixture}</body></html>` }),
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("https://office.bexio.com/index.php/monitoring/list");
  // Replace SELECTOR with the real toggle button id/class from renderHtml.ts (found in Task 3.3).
  await expect(page.locator("SELECTOR")).toBeAttached({ timeout: 10_000 });
  expect(errors, `page errors: ${errors.join("\n")}`).toEqual([]);
});

test("side panel HTML loads and mounts React without errors", async () => {
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // Find the extension id from the loaded extension (via chrome://extensions is awkward in headless;
  // instead read it from a service-worker target, or just open the packaged index.html by path:
  const idFromManifest = JSON.parse(readFileSync(path.join(UNPACKED, "manifest.json"), "utf8"));
  // crxjs may inject a key → stable id; if not, derive it from context.serviceWorkers()[0].url().
  const sw = context.serviceWorkers()[0];
  const extId = sw ? new URL(sw.url()).host : null;
  test.skip(!extId, "could not determine extension id");
  await page.goto(`chrome-extension://${extId}/sidePanel-import/index.html`);
  await expect(page.locator("#root")).toBeAttached();
  await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });
  expect(errors, `page errors: ${errors.join("\n")}`).toEqual([]);
});
```
Implementer notes: getting the extension id in headless Chromium is the fiddly bit — `context.serviceWorkers()` (or `context.backgroundPages()` for MV2; MV3 uses service workers) is the reliable source; wait for it with `await context.waitForEvent("serviceworker")` in `beforeAll` if the array is empty initially. If headless extension loading doesn't work in the installed Chromium version, switch to `headless: false` with `xvfb` on CI / a visible window locally, and document that in `testing.md`. The `#root` selector for the side panel comes from `packages/sidePanel-import/index.html` — confirm it (Vite's React template uses `<div id="root">`).

- [ ] **Step 3: Run, expect PASS**

Run: `npm run test:e2e`
Expected: 3 passed (or `side panel` test `skipped` if the extension id can't be resolved — acceptable, note it).

- [ ] **Step 4: Confirm e2e is NOT part of `npm test`**

Run: `npm test` and verify no Playwright/browser launch happens (only Vitest projects run).

- [ ] **Step 5: Commit**
```bash
git add e2e/extension-smoke.spec.ts e2e/support/
git commit -m "test(e2e): add playwright extension-smoke test (content scripts inject, side panel mounts)"
```

---

### Task 5.3: `docs/architecture/testing.md`

**Files:**
- Create: `docs/architecture/testing.md`

- [ ] **Step 1: Write the doc** covering: the three test layers (Vitest unit/integration, Playwright extension-smoke, manual real-bexio walkthrough) and which is the safety net; the commands (`npm test` = all Vitest incl. the slow build test; `npm run test:fast` = Vitest minus `*.slow.test.ts`; `npm run test:watch`; `npm run test:e2e` = Playwright, needs `npx playwright install chromium` once and a built `unpacked/`); the three Vitest projects + their environments + the chrome fake (and that it throws on un-faked `chrome.*`); the **module-load quirk** rule (load fixture → then `await import`, with `vi.resetModules()`); the **fixture-capture procedure** (point at `packages/chrome-extension/test/fixtures/bexio/README.md`, summarise: open the bexio page logged in → run the `copy(...)` console snippet from the README → drop into `_raw/` → run the anonymise/trim pass → write the `.md` sibling; `_raw/` is git-ignored); the build-smoke-test caveat (needs PowerShell; skipped if `pwsh`/`powershell` absent); and the **manual real-bexio walkthrough checklist** — a numbered list: load `unpacked/` as an unpacked extension in your own Chrome, log into your own bexio, then: (1) on `monitoring/edit` confirm the Templates block appears, the filter works, "Add" saves the current form as a template, a template button fills the form, "Delete" removes one; (2) on `monitoring/list` (and a project Times tab, and a work-package Times tab) toggle "Text mode" and confirm tooltips become inline text and toggling back reverts; (3) open the side panel, confirm the Templates and Import tabs work, the active tab persists across reopen, importing a ManicTime clipboard export populates the table and an entry's ▶️ button fills the bexio form; (4) note that the `kb_invoice` "tracked time" tooltip page is currently unverified (bexio UI changed). State clearly this checklist is run by a human, not automated, and is a candidate for a future Playwright-against-real-bexio spec.
- [ ] **Step 2: Commit**
```bash
git add docs/architecture/testing.md
git commit -m "docs: add testing architecture doc (harness, fixtures, manual walkthrough)"
```

---

## Phase 6 — Wrap-up

### Task 6.1: Link the architecture docs from `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add a section to `CLAUDE.md`** (after the "Architecture notes" section) titled `## Architecture deep-dives` with a short intro ("Detailed, behaviour-pinned docs for the topics that have a test suite — read these before changing the corresponding code:") and a bullet list linking: `docs/architecture/storage.md`, `docs/architecture/form-layer.md`, `docs/architecture/tooltip-replacement.md`, `docs/architecture/build-and-release.md`, `docs/architecture/testing.md`. Also add a one-line note under the existing "There is no test suite" sentence (in the Commands section) correcting it: "There is now a Vitest suite — `npm test` (incl. a slow build smoke test) / `npm run test:fast` / `npm run test:watch`, plus `npm run test:e2e` (Playwright extension-smoke, opt-in). See `docs/architecture/testing.md`."
- [ ] **Step 2: Run the full suite one last time**

Run: `npm test`
Expected: all Vitest projects pass (incl. the slow build smoke test). Then `npm run test:fast` — passes, and faster.

- [ ] **Step 3: Commit**
```bash
git add CLAUDE.md
git commit -m "docs: link architecture deep-dives from CLAUDE.md; note the test suite exists"
```

---

## Done criteria

- `npm test` is green: `shared` storage/helpers, `chrome-extension` selectors/triggers/waitFor/fillForm/readFormData/convert-popover/misc-utils, `updateManifest`, and the slow build smoke test all pass.
- `npm run test:fast` is green and skips `*.slow.test.ts`.
- `npm run test:e2e` is green (side-panel test may be skipped if the extension id can't be resolved headlessly — acceptable).
- `packages/chrome-extension/test/fixtures/bexio/` contains six anonymised `*.html` fixtures + `.md` siblings; `_raw/` is git-ignored and untracked.
- `docs/architecture/` contains `storage.md`, `build-and-release.md`, `tooltip-replacement.md`, `form-layer.md`, `testing.md`; `CLAUDE.md` links them.
- TSDoc comments added per Tasks 1.4 / 3.4 / 4.7 — no behaviour changes anywhere in `src/` or `packages/shared/`.
- Every "KNOWN ISSUE" surfaced by a test is mirrored as a bullet in the relevant `docs/architecture/*.md`.
- Branch `feature/test-harness-and-docs` holds all of it; nothing committed to `main`.

## Follow-up work (explicitly NOT in this plan)

- Fix the known issues (`chromeStorage.remove`/`update` edge cases, `Build.ps1` swallowing errors, `csvParser` footer-row assumption).
- TS-ify `updateManifest.js`, `service_worker.js`, and the implicit-`any` spots (`convertPopover.ts`, `onMessage.ts`).
- Investigate the `kb_invoice/show` tooltip path (bexio UI changed) — adapt or remove; add a fixture if it still exists.
- Decide whether to test `packages/sidePanel-import/src/utils/csvParser.ts` and `AutoMapTemplatesV3.ts` (topic 3) — left out this round.
- Remove the vestigial `@swc/core` dependency if confirmed unused.
- Real-bexio E2E (Playwright against a live account) — only if ever wanted; documented as manual for now.
