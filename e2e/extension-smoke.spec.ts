/**
 * Extension-smoke Playwright tests.
 *
 * These tests load the built unpacked/ extension into a real Chromium instance and
 * verify that the content scripts inject correctly and the side panel mounts.
 *
 * Prerequisites (one-time):
 *   npx playwright install chromium
 *
 * The unpacked/ directory must exist (built via `npm run build:project -- -Development`).
 * If it is missing the test will attempt to build it automatically.
 *
 * IMPORTANT: extensions require a persistent context launched with
 * --load-extension; the default Playwright `browser` fixture cannot be used.
 *
 * Note on headless: MV3 service workers do NOT surface via
 * context.serviceWorkers() in Playwright's headless ("new") mode in
 * Chromium 148 / Playwright 1.60. The workaround is headless: false (a real
 * Chromium window). In a local dev environment this opens a visible browser
 * window for the duration of the test (~11 s). On headless CI you can wrap
 * the test run with Xvfb. Content-script injection (Test 1) works fine
 * headlessly; only the side-panel test (Test 2) needs headless: false to
 * resolve the extension ID.
 * See docs/architecture/testing.md for full details.
 */
import { test, expect, chromium, type BrowserContext } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REPO = path.resolve(__dirname, "..");
const UNPACKED = path.resolve(REPO, "unpacked");
const FIXTURES = path.resolve(REPO, "packages/chrome-extension/test/fixtures/bexio");

function ensureBuilt(): void {
  if (existsSync(path.join(UNPACKED, "manifest.json"))) return;
  execFileSync("npm", ["run", "build:project", "--", "-Development"], {
    cwd: REPO,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

let context: BrowserContext;
let extId: string | null = null;

test.beforeAll(async () => {
  ensureBuilt();

  // headless: false is required to make MV3 service workers surface via
  // context.serviceWorkers() in Playwright 1.60 / Chromium 148.
  // Content-script injection works headlessly, but the extension ID (needed
  // for the side-panel test) can only be derived from the service-worker URL
  // when a real window is used. In a CI environment, wrap with Xvfb.
  context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      `--disable-extensions-except=${UNPACKED}`,
      `--load-extension=${UNPACKED}`,
    ],
  });

  // In non-headless mode the service worker registers synchronously on browser
  // start; check immediately, then fall back to a short wait.
  const existingWorkers = context.serviceWorkers();
  if (existingWorkers.length > 0) {
    extId = new URL(existingWorkers[0].url()).host;
  } else {
    // Open a blank page to give the extension a chance to register its SW
    const warmupPage = await context.newPage();
    await warmupPage.waitForTimeout(2_000);
    await warmupPage.close();

    const workers = context.serviceWorkers();
    if (workers.length > 0) {
      extId = new URL(workers[0].url()).host;
    } else {
      // Last-resort: wait for the serviceworker event
      try {
        const sw = await context.waitForEvent("serviceworker", { timeout: 8_000 });
        extId = new URL(sw.url()).host;
      } catch {
        extId = null;
      }
    }
  }
});

test.afterAll(async () => {
  await context?.close();
});

// ---------------------------------------------------------------------------
// Test 1: content script injects #SoulcodeExtensionTemplates on monitoring/edit
// ---------------------------------------------------------------------------
test("content script injects the template UI on the monitoring/edit page", async () => {
  const fixture = readFileSync(path.join(FIXTURES, "monitoring-edit.html"), "utf8");
  const page = await context.newPage();

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  // Intercept the bexio URL (which the manifest content-script matches on) and
  // serve the anonymised fixture instead of hitting the real bexio server.
  await page.route(
    "https://office.bexio.com/index.php/monitoring/edit",
    (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html><head><title>t</title></head><body>${fixture}</body></html>`,
      }),
  );

  await page.goto("https://office.bexio.com/index.php/monitoring/edit");

  // The content script (bexioTimetrackingTemplates/index.ts) renders
  // #SoulcodeExtensionTemplates after loading templates from chrome.storage.
  await expect(page.locator("#SoulcodeExtensionTemplates")).toBeAttached({
    timeout: 10_000,
  });

  expect(errors, `unexpected page errors:\n${errors.join("\n")}`).toEqual([]);

  await page.close();
});

// ---------------------------------------------------------------------------
// Test 2: side panel HTML loads and mounts React without errors
// ---------------------------------------------------------------------------
test("side panel HTML loads and mounts React without errors", async () => {
  test.skip(!extId, "could not determine extension id — service worker not found");

  const page = await context.newPage();

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(`chrome-extension://${extId}/sidePanel-import/index.html`);

  // The React app mounts into <div id="root"> defined in unpacked/sidePanel-import/index.html.
  await expect(page.locator("#root")).toBeAttached();
  await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });

  expect(errors, `unexpected page errors:\n${errors.join("\n")}`).toEqual([]);

  await page.close();
});

// ---------------------------------------------------------------------------
// Test 3: content script injects the #PopoverTextSwitcher ("Text mode") toggle
// on monitoring/list. The monitoring-list.html fixture is now a full-body
// capture, so `.globalsearch` is present and bexioProjectList/renderHtml.ts
// can insert its button next to it.
// ---------------------------------------------------------------------------
test("content script injects #PopoverTextSwitcher on monitoring/list", async () => {
  const fixture = readFileSync(path.join(FIXTURES, "monitoring-list.html"), "utf8");
  const page = await context.newPage();

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  // The fixture already begins with `<html>…<body>…`, so don't double-wrap.
  await page.route(
    "https://office.bexio.com/index.php/monitoring/list",
    (route) =>
      route.fulfill({
        contentType: "text/html",
        body: fixture.startsWith("<!doctype")
          ? fixture
          : `<!doctype html>${fixture}`,
      }),
  );

  await page.goto("https://office.bexio.com/index.php/monitoring/list");
  await expect(page.locator("#PopoverTextSwitcher")).toBeAttached({ timeout: 10_000 });

  expect(errors, `unexpected page errors:\n${errors.join("\n")}`).toEqual([]);

  await page.close();
});
