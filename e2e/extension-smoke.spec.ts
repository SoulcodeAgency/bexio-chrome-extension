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
 * See e2e/support.ts for the launch mechanics (persistent context, headless
 * caveats) and docs/architecture/testing.md for full details. Behaviour-level
 * tests (toggle round-trip, template apply, dialogs) live in
 * extension-behaviour.spec.ts.
 */
import { test, expect, type BrowserContext } from "@playwright/test";
import { launchExtensionContext, serveFixture } from "./support";

let context: BrowserContext;
let extId: string | null = null;

test.beforeAll(async () => {
  ({ context, extId } = await launchExtensionContext());
});

test.afterAll(async () => {
  await context?.close();
});

// ---------------------------------------------------------------------------
// Test 1: content script injects #SoulcodeExtensionTemplates on monitoring/edit
// ---------------------------------------------------------------------------
test("content script injects the template UI on the monitoring/edit page", async () => {
  const page = await context.newPage();

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  // Intercept the bexio URL (which the manifest content-script matches on) and
  // serve the anonymised fixture instead of hitting the real bexio server.
  await serveFixture(page, "https://office.bexio.com/index.php/monitoring/edit", "monitoring-edit");

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
// on monitoring/list. The monitoring-list.html fixture is a full-body capture,
// so `.globalsearch` is present and bexioProjectList/renderHtml.ts can insert
// its button next to it.
// ---------------------------------------------------------------------------
test("content script injects #PopoverTextSwitcher on monitoring/list", async () => {
  const page = await context.newPage();

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await serveFixture(page, "https://office.bexio.com/index.php/monitoring/list", "monitoring-list");

  await page.goto("https://office.bexio.com/index.php/monitoring/list");
  await expect(page.locator("#PopoverTextSwitcher")).toBeAttached({ timeout: 10_000 });

  expect(errors, `unexpected page errors:\n${errors.join("\n")}`).toEqual([]);

  await page.close();
});
