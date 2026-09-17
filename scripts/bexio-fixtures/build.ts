/**
 * Turns a bexio capture bundle into the committed, anonymised fixtures.
 *
 *   npm run fixtures:build                                  # _raw/bexio-raw-captures-<date>.json → *.html + *.md
 *   node scripts/bexio-fixtures/build.ts --check a.html …   # leak check only, for any file
 *
 * (`--check` is passed to node directly: `npm run … -- --check` loses the flag in PowerShell.)
 *
 * Needs two git-ignored files in the MAIN checkout's packages/chrome-extension/test/fixtures/bexio/_raw/
 * (also when run from a worktree, whose own _raw/ disappears with it):
 * - the capture bundle, downloaded by the in-page capture script in that folder's README.md
 * - anonymise.local.json: { "replacements": [[from, to], …], "sensitive": [token, …] } — the real
 *   names of people and clients, which must never be committed
 * The fixtures are written into the current checkout. A fixture is only written when `findLeaks`
 * comes back empty for it.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { JSDOM } from "jsdom";
import { findLeaks, type Replacement, scrubDom, scrubText } from "./anonymise.ts";

const FIXTURE_PATH = "packages/chrome-extension/test/fixtures/bexio";
const FIXTURE_DIR = resolve(import.meta.dirname, "../..", FIXTURE_PATH);
const gitCommonDir = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
  cwd: import.meta.dirname,
  encoding: "utf8",
}).trim();
const RAW_DIR = resolve(dirname(gitCommonDir), FIXTURE_PATH, "_raw");
const LOCAL_CONFIG = resolve(RAW_DIR, "anonymise.local.json");

function loadLocalConfig(): { replacements: Replacement[]; sensitive: string[] } {
  if (!existsSync(LOCAL_CONFIG)) {
    console.error(`Missing ${LOCAL_CONFIG} — see the header of scripts/bexio-fixtures/build.ts.`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(LOCAL_CONFIG, "utf8"));
}

function printLeaks(name: string, leaks: ReturnType<typeof findLeaks>): void {
  const lines = [...new Set(leaks.map((leak) => `[${leak.variant}] ${leak.label}: …${leak.context}…`))];
  console.log(`${name}: ${leaks.length} findings${lines.length ? `\n  ${lines.slice(0, 40).join("\n  ")}` : ""}`);
}

const { replacements, sensitive } = loadLocalConfig();

const checkIndex = process.argv.indexOf("--check");
if (checkIndex !== -1) {
  let leaked = false;
  for (const file of process.argv.slice(checkIndex + 1)) {
    const leaks = findLeaks(readFileSync(file, "utf8"), sensitive);
    leaked ||= leaks.length > 0;
    printLeaks(file, leaks);
  }
  process.exit(leaked ? 1 : 0);
}

const bundles = readdirSync(RAW_DIR)
  .filter((file) => /^bexio-raw-captures-\d{4}-\d{2}-\d{2}\.json$/.test(file))
  .sort();
if (bundles.length === 0) {
  console.error(`No bexio-raw-captures-<date>.json in ${RAW_DIR}.`);
  process.exit(1);
}
const bundleFile = bundles[bundles.length - 1];
const captureDate = bundleFile.match(/\d{4}-\d{2}-\d{2}/)![0];
const bundle: Record<string, { html: string }> = JSON.parse(readFileSync(resolve(RAW_DIR, bundleFile), "utf8"));

interface Job {
  name: string;
  url: string;
  notable: string;
}

// Full-body captures of the pages the bexioProjectList content script runs on. The monitoring-edit
// fixtures (form-only captures) are not rebuilt here; see the fixture README.
const jobs: Job[] = [
  {
    name: "monitoring-list",
    url: "https://office.bexio.com/index.php/monitoring/list",
    notable:
      "Full body in bexio's sidebar layout (2026-09): the legacy top navigation `.lgcy-topbar-nav-office` (incl. `.globalsearch`) is still in the markup but hidden by bexio's CSS (`.use-new-nav .lgcy-topbar-nav-office { display: none }`); the page title bar `.bx-breadcrumb-container .bx-card-title` with the primary `a.js-first-btn` ('Neue Zeiterfassung'); `#monitoring_content` with `table#dataTable`, 12 rows each with a visible `<i rel='popover' data-content='…'>`.",
  },
  {
    name: "pr_project-listMonitoring",
    url: "https://office.bexio.com/index.php/pr_project/listMonitoring/projectId/<projectId>",
    notable:
      "Full body: page title bar with `a.js-first-btn` ('Neues Projekt'); `.listBlock` with `table#dataTable` (12 time-entry rows with `<i rel='popover'>` icons); the project sidebar's team cards also carry `data-content` (mailto markup, `rel='sticky'`, not popovers).",
  },
  {
    name: "pr_project-showPackage",
    url: "https://office.bexio.com/index.php/pr_project/showPackage/packageId/<packageId>",
    notable:
      "Full body with the lower jQuery-UI tab widget `#tabs.listBlock` switched to 'Zeiten': the tab link `a[href*='/pr_project/listMonitorings/']` is `#ui-id-3`, its `li[aria-controls='ui-id-4']` points at the populated panel `#ui-id-4` (7 time-entry rows with `<i rel='popover'>` icons). jQuery UI numbers these ids at runtime — the May 2026 capture had the panel at `#ui-id-5`; page title bar with `a.js-first-btn` ('Neues Projekt').",
  },
  {
    name: "kb_invoice-show",
    url: "https://office.bexio.com/index.php/kb_invoice/show/id/<id> (modal opened via Positionen → Weitere Positionen → Zeit/Leistung)",
    notable:
      "Full body with the 'Zeiten importieren' modal open: `#jqDialog` containing `.block.list` with 12 time-entry rows and `<i rel='popover'>` icons; page title bar with `a.js-first-btn` ('Neue Rechnung'); the invoice's own positions table earlier in the body.",
  },
];

let failed = false;
for (const job of jobs) {
  const entry = bundle[job.name];
  if (!entry) {
    console.log(`SKIP ${job.name} (not in ${bundleFile})`);
    continue;
  }
  // bexio's sidebar layout hangs off <html class="use-new-nav">; the capture only took <body>,
  // so the one class that matters is restored here.
  const dom = new JSDOM(`<!doctype html><html class="use-new-nav"><head></head>${entry.html}</html>`);
  scrubDom(dom.window.document);
  const html = scrubText(dom.window.document.documentElement.outerHTML, replacements)
    .replace(/>[ \t\r\n]+</g, "><")
    .trim();

  const leaks = findLeaks(html, sensitive);
  if (leaks.length > 0) {
    failed = true;
    printLeaks(`NOT WRITTEN ${job.name}`, leaks);
    continue;
  }

  writeFileSync(resolve(FIXTURE_DIR, `${job.name}.html`), html);
  const popovers = (html.match(/rel="popover"/g) ?? []).length;
  writeFileSync(
    resolve(FIXTURE_DIR, `${job.name}.md`),
    `# Fixture: ${job.name}

- **Source URL:** ${job.url}
- **Captured:** ${captureDate}
- **Captured via:** the in-page capture script in \`README.md\` (live DOM, full body, extension changes undone); \`<html class="use-new-nav">\` restored from the live page (its other, Modernizr-generated classes are dropped); built with \`npm run fixtures:build\`
- **Trimmed:** \`<script>\`, \`<style>\`, \`<link>\`, \`<noscript>\` and \`<iframe>\` removed; inline event-handler attributes (\`onclick\`, …) removed; the Angular shell roots (\`bexio-application-header-root\`, \`bexio-application-navigation-root\`, \`bexio-application-footer-root\`, \`application-wrapper-root\`, \`.cdk-overlay-container\`) emptied; chat/analytics widgets and unused modal placeholders removed${job.name === "kb_invoice-show" ? " (`#jqDialog` kept — it is the open modal)" : " (incl. `#jqDialog`)"}; every \`<tbody>\` cut to 12 data rows; selects with more than 5 options cut to their first 3; whitespace between tags collapsed.
- **Anonymised:** yes — names → Doe/Roe/Smith/Klein/Weber/… placeholders; clients/projects → Acme/Globex/Initech/Umbrella/Hooli placeholders; every popover \`data-content\` replaced with "Sample time entry N" (#1 contains \`&amp;\`, #2 contains \`<br />\`); e-mail addresses → example.com; CSRF tokens → \`TEST_CSRF_TOKEN\`; the access token in bexio's hidden support form → \`TEST_ACCESS_TOKEN\`; UUIDs zeroed; record ids → 99999 / \`item9000N\`.
- **Notable elements for tests:** ${job.notable}
- **Size:** ${html.length} bytes; ${popovers} \`i[rel='popover']\` icons
`,
  );
  console.log(`WROTE ${job.name}.html (${html.length} bytes, ${popovers} popovers)`);
}
process.exit(failed ? 1 : 0);
