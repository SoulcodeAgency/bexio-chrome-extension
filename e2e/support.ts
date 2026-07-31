/**
 * Shared helpers for the extension Playwright specs.
 *
 * Extensions can only be loaded into a persistent context launched with
 * --load-extension; the default Playwright `browser` fixture cannot be used.
 *
 * Note on headless: MV3 service workers do NOT surface via
 * context.serviceWorkers() in Playwright's headless ("new") mode in
 * Chromium 148 / Playwright 1.60+. The workaround is headless: false (a real
 * Chromium window). On headless CI, wrap the test run with Xvfb:
 * `xvfb-run --auto-servernum npm run test:e2e`.
 * See docs/architecture/testing.md for full details.
 */
import { chromium, type BrowserContext, type Page, type Worker } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const REPO = path.resolve(__dirname, "..");
export const UNPACKED = path.resolve(REPO, "unpacked");
export const FIXTURES = path.resolve(REPO, "packages/chrome-extension/test/fixtures/bexio");

/** Builds the unpacked extension (development mode) unless it already exists. */
export function ensureBuilt(): void {
  if (existsSync(path.join(UNPACKED, "manifest.json"))) return;
  execFileSync("npm", ["run", "build:project", "--", "-Development"], {
    cwd: REPO,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

export type ExtensionContext = {
  context: BrowserContext;
  /** The extension id derived from the service-worker URL, or null if the SW never surfaced. */
  extId: string | null;
  /** The extension's MV3 service worker, or null if it never surfaced. */
  serviceWorker: Worker | null;
};

/**
 * Launches a fresh persistent context with the unpacked extension loaded and
 * resolves the extension id from the service-worker URL (needs headless: false,
 * see module docblock).
 */
export async function launchExtensionContext(): Promise<ExtensionContext> {
  ensureBuilt();

  const context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [`--disable-extensions-except=${UNPACKED}`, `--load-extension=${UNPACKED}`],
  });

  // In non-headless mode the service worker registers synchronously on browser
  // start; check immediately, then fall back to a short wait.
  let serviceWorker: Worker | null = context.serviceWorkers()[0] ?? null;
  if (!serviceWorker) {
    // Open a blank page to give the extension a chance to register its SW
    const warmupPage = await context.newPage();
    await warmupPage.waitForTimeout(2_000);
    await warmupPage.close();

    serviceWorker = context.serviceWorkers()[0] ?? null;
    if (!serviceWorker) {
      // Last-resort: wait for the serviceworker event
      try {
        serviceWorker = await context.waitForEvent("serviceworker", { timeout: 8_000 });
      } catch {
        serviceWorker = null;
      }
    }
  }

  const extId = serviceWorker ? new URL(serviceWorker.url()).host : null;
  return { context, extId, serviceWorker };
}

/**
 * Routes `url` to serve the named anonymised bexio fixture instead of hitting
 * the real bexio server. Fixtures that already start with `<html>`/`<!doctype`
 * are served as-is; body-only captures get wrapped in a document skeleton.
 */
export async function serveFixture(page: Page, url: string, fixtureName: string): Promise<void> {
  const fixture = readFileSync(path.join(FIXTURES, `${fixtureName}.html`), "utf8");
  let body: string;
  if (fixture.startsWith("<!doctype")) {
    body = fixture;
  } else if (fixture.startsWith("<html")) {
    body = `<!doctype html>${fixture}`;
  } else {
    body = `<!doctype html><html><head><title>t</title></head><body>${fixture}</body></html>`;
  }
  await page.route(url, (route) => route.fulfill({ contentType: "text/html", body }));
}
