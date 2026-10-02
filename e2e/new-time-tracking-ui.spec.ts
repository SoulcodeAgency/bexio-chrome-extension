/**
 * bexio's new Angular time tracking (#168) in a real Chromium, on the synthetic fixtures
 * (`time-tracking-modal.synthetic.html`, `time-tracking-grid.synthetic.html` — hand-built from the
 * probe in the issue, not captured).
 *
 * What the jsdom tests cannot show, and this does:
 *
 * - the manifest injects the template script, the list script and the MAIN-world grid script on
 *   `/index.php/time-tracking`;
 * - the Templates column really sits right of bexio's form, and the widened dialog beats its inline
 *   `max-width: 720px` (real CSS layout);
 * - clicks from the isolated world reach page-world listeners of the dialog (a small stand-in for
 *   Angular Material's `mat-select`, see installMatSelectStub);
 * - the MAIN-world script finds a grid API behind `__agComponent` and widens the remarks column
 *   once the isolated world sets the mode attribute.
 *
 * Whether bexio's real Angular components accept all of it is the manual check in
 * docs/architecture/testing.md.
 */
import { test, expect, type BrowserContext, type Worker } from "@playwright/test";
import { launchExtensionContext, serveFixture } from "./support";

let context: BrowserContext;
let serviceWorker: Worker | null = null;

test.beforeAll(async () => {
  ({ context, serviceWorker } = await launchExtensionContext());
});

test.afterAll(async () => {
  await context?.close();
});

const TIME_TRACKING = "https://office.bexio.com/index.php/time-tracking?sortBy=date:desc&filter=all&filterBy=";

const TEMPLATE = {
  id: "e2enewui1",
  templateName: "Neues UI",
  keywords: "",
  billable: false,
  contact: "Muster AG",
  // "Firstname Lastname", as the old form stored it; the dialog lists "Lastname Firstname".
  contactPerson: "Erika Beispiel",
  project: "Muster AG - Website",
  package: "",
  status: "In Arbeit",
  work: "Entwicklung",
};

/**
 * A page-world stand-in for Angular Material's mat-select: a click on the trigger opens a panel in
 * the overlay container, a click on an option shows it as the value and closes the panel, Kontakt
 * enables Projekt. Plain JS — it runs as a page script, like bexio's own.
 */
const MAT_SELECT_STUB = `
  const OPTIONS = {
    activity: ["Beratung", "Entwicklung"],
    status: ["In Arbeit", "Offen"],
    contact: ["Muster AG", "Muster AG Zürich"],
    project: ["Muster AG - Website"],
    "sub-contact": ["Muster Max", "Beispiel Erika"],
  };
  let panels = 0;
  for (const select of document.querySelectorAll("mat-select[data-for-test]")) {
    const key = select.getAttribute("data-for-test").replace("time-entry-editor-", "");
    const panelId = "mat-select-" + panels++ + "-panel";
    select.querySelector(".mat-mdc-select-trigger").addEventListener("click", () => {
      if (select.getAttribute("aria-disabled") === "true") return;
      select.setAttribute("aria-expanded", "true");
      select.setAttribute("aria-controls", panelId);
      const panel = document.createElement("div");
      panel.id = panelId;
      panel.className = "mat-mdc-select-panel";
      panel.setAttribute("role", "listbox");
      for (const text of OPTIONS[key] || []) {
        const option = document.createElement("mat-option");
        option.className = "mat-mdc-option";
        option.textContent = text;
        option.addEventListener("click", () => {
          select.querySelector(".mat-mdc-select-value").innerHTML =
            '<span class="mat-mdc-select-value-text"><span></span></span>';
          select.querySelector(".mat-mdc-select-value-text span").textContent = text;
          select.setAttribute("aria-expanded", "false");
          if (key === "contact") {
            const project = document.querySelector('[data-for-test="time-entry-editor-project"]');
            project.setAttribute("aria-disabled", "false");
            project.classList.remove("mat-mdc-select-disabled");
          }
        });
        panel.appendChild(option);
      }
      document.querySelector(".cdk-overlay-container").appendChild(panel);
    });
  }
`;

/**
 * A page-world stand-in for ag-grid's pre-v31 API on the grid's root element. It records every
 * `setColumnDefs` into `window.__columnDefsWritten` for the test to read.
 */
const AG_GRID_STUB = `
  let defs = [
    { colId: "date", width: 200, minWidth: 200 },
    { colId: "activity", width: 150 },
    { colId: "text", width: 88, minWidth: 88, maxWidth: 88 },
  ];
  window.__columnDefsWritten = [];
  document.querySelector(".ag-root-wrapper").__agComponent = {
    gridOptionsService: {
      api: {
        getColumnDefs: () => defs.map((def) => ({ ...def })),
        setColumnDefs: (next) => { defs = next; window.__columnDefsWritten.push(next); },
        sizeColumnsToFit: () => {},
        addEventListener: () => {},
      },
    },
  };
`;

test("the Templates column sits right of the dialog's form and applies a template", async () => {
  test.skip(!serviceWorker, "could not resolve the extension service worker — cannot seed chrome.storage");
  await serviceWorker!.evaluate((entries) => chrome.storage.local.set({ entries }), [TEMPLATE]);

  const page = await context.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await serveFixture(page, TIME_TRACKING, "time-tracking-modal.synthetic", MAT_SELECT_STUB);
  await page.goto(TIME_TRACKING);

  const column = page.locator(".time-entries-dialog--editor + #SoulcodeExtensionModalColumn");
  await expect(column.locator(`button#${TEMPLATE.id}`)).toBeVisible({ timeout: 10_000 });

  // Real layout: the pane is wider than bexio's inline 720px, the form keeps at most 720px and the
  // column sits to its right.
  const form = await page.locator(".time-entries-dialog--editor").boundingBox();
  const templates = await column.boundingBox();
  const pane = await page.locator(".cdk-overlay-pane").boundingBox();
  expect(pane!.width).toBeGreaterThan(720);
  expect(form!.width).toBeLessThanOrEqual(720);
  expect(templates!.x).toBeGreaterThanOrEqual(form!.x + form!.width - 1);
  // A narrow column, no taller than bexio's form: it scrolls on its own.
  expect(templates!.width).toBeLessThanOrEqual(301);
  expect(templates!.height).toBeLessThanOrEqual(form!.height + 1);

  await column.locator(`button#${TEMPLATE.id}`).click();

  const select = (key: string) => page.locator(`[data-for-test="time-entry-editor-${key}"] .mat-mdc-select-value`);
  const applied = { timeout: 20_000 };
  await expect(select("activity")).toHaveText("Entwicklung", applied);
  await expect(select("status")).toHaveText("In Arbeit", applied);
  await expect(select("contact")).toHaveText("Muster AG", applied);
  await expect(select("project")).toHaveText("Muster AG - Website", applied);
  await expect(select("sub-contact")).toHaveText("Beispiel Erika", applied);
  await expect(page.locator("bexio-slide-toggle input")).not.toBeChecked();
  await expect(page.locator("#SoulcodeExtensionLoader")).toHaveCSS("display", "none");

  expect(errors, `unexpected page errors:\n${errors.join("\n")}`).toEqual([]);
  await page.close();
});

test("the grid prints remarks as text and the MAIN-world script widens their column", async () => {
  test.skip(!serviceWorker, "could not resolve the extension service worker — cannot seed chrome.storage");
  await serviceWorker!.evaluate(() => chrome.storage.local.set({ removePopoversSetting: true }));

  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await serveFixture(page, TIME_TRACKING, "time-tracking-grid.synthetic", AG_GRID_STUB);
  await page.goto(TIME_TRACKING);

  await expect(page.locator(".soulcode-grid-remarks").first()).toHaveText("Kickoff vorbereitet & Agenda verschickt", {
    timeout: 10_000,
  });
  await expect(page.locator("#GridNotesTextSwitcher button[data-mode='text']")).toHaveAttribute("aria-pressed", "true");

  // MAIN world: the stub API received the widened definitions.
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __columnDefsWritten: unknown[] }).__columnDefsWritten.length),
    )
    .toBeGreaterThan(0);
  const written = await page.evaluate(() =>
    (window as unknown as { __columnDefsWritten: { colId: string }[][] }).__columnDefsWritten.at(-1)!,
  );
  expect(written.find((def) => def.colId === "text")).toEqual({ colId: "text", flex: 1, minWidth: 200 });

  // Back to tooltips: icons back, bexio's widths back.
  await page.locator("#GridNotesTextSwitcher button[data-mode='tooltip']").click();
  await expect(page.locator(".soulcode-grid-remarks")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __columnDefsWritten: { colId: string; maxWidth?: number }[][] }).__columnDefsWritten
            .at(-1)!
            .find((def) => def.colId === "text")!.maxWidth,
      ),
    )
    .toBe(88);

  expect(errors, `unexpected page errors:\n${errors.join("\n")}`).toEqual([]);
  await page.close();
});
