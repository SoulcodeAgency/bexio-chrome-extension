/**
 * Extension-behaviour Playwright tests (issue #66).
 *
 * Where extension-smoke.spec.ts only asserts that the content scripts *inject*,
 * these tests assert *behaviour* on the same anonymised bexio fixtures:
 *
 * - the "Text mode" toggle round-trip on monitoring/list (bexioProjectList)
 * - applying a template on monitoring/edit (the fragile fillForm +
 *   synthetic-event path through src/utils/trigger*.ts)
 * - the template filter input
 * - the Add / Delete flows, whose prompt()/confirm()/alert() dialogs block
 *   in-browser automation but are handled here via page.on("dialog")
 *
 * The fixtures are static HTML — bexio's own JavaScript (jQuery, select2,
 * jQuery-UI autocomplete) is stripped by the anonymiser. The template-apply
 * test therefore injects a minimal select2/autocomplete stub into the page
 * (see installBexioFormStub) that reacts to the extension's synthetic events
 * exactly where the real widgets would: it opens `#select2-drop` on Enter,
 * applies the searched value to the underlying `<select>` and the
 * `.select2-chosen` span, and shows `.ac_results` for the contact field.
 * What is being tested is the extension's orchestration (fillForm and the
 * trigger* and waitFor* utils), not bexio's widgets.
 *
 * Storage is seeded through the extension's MV3 service worker
 * (`serviceWorker.evaluate(... chrome.storage.local ...)`), so tests that
 * need seeding skip when the service worker cannot be resolved (see
 * e2e/support.ts on headless mode).
 */
import { test, expect, type BrowserContext, type Page, type Worker } from "@playwright/test";
import { launchExtensionContext, serveFixture } from "./support";

let context: BrowserContext;
let serviceWorker: Worker | null = null;

test.beforeAll(async () => {
  ({ context, serviceWorker } = await launchExtensionContext());
});

test.afterAll(async () => {
  await context?.close();
});

/** A complete TemplateEntry as stored under the `entries` key. */
const TEMPLATE = {
  id: "e2etemplate1",
  templateName: "E2E Template",
  keywords: "",
  billable: true, // fixture checkbox starts unchecked → proves triggerCheckbox ran
  contact: "Acme AG",
  contactPerson: "Doe Jane",
  project: "Project Falcon",
  package: "Package Alpha",
  status: "In Arbeit",
  work: "Consulting",
};

async function seedTemplates(entries: object[]): Promise<void> {
  await serviceWorker!.evaluate((value) => chrome.storage.local.set({ entries: value }), entries);
}

/**
 * Installs the minimal bexio-form stub described in the module docblock.
 * `optionsBySelectId` pre-populates each underlying `<select>` (bexio loads
 * these via AJAX; `waitForSelectOptions` polls until options.length > 1).
 */
async function installBexioFormStub(page: Page, optionsBySelectId: Record<string, string[]>): Promise<void> {
  await page.evaluate((optionsBySelectId) => {
    for (const [selectId, values] of Object.entries(optionsBySelectId)) {
      const select = document.getElementById(selectId) as HTMLSelectElement | null;
      if (!select) throw new Error(`stub: select #${selectId} not found in fixture`);
      for (const value of ["", ...values]) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      }
    }

    // select2 v3: Enter on a container's focusser input opens the shared
    // #select2-drop; Enter on the drop's search input selects the value.
    let openContainer: HTMLElement | null = null;
    document.addEventListener("keydown", (e) => {
      const target = e.target as HTMLElement;
      if ((e as KeyboardEvent).keyCode !== 13 || !(target instanceof HTMLInputElement)) return;

      const container = target.closest(".select2-container") as HTMLElement | null;
      if (container && container.id.startsWith("s2id_")) {
        openContainer = container;
        if (!document.getElementById("select2-drop")) {
          const drop = document.createElement("div");
          drop.id = "select2-drop";
          drop.appendChild(document.createElement("input"));
          document.body.appendChild(drop);
        }
        return;
      }

      if (target.closest("#select2-drop")) {
        const value = target.value;
        if (openContainer) {
          const select = document.querySelector(`#${openContainer.id}+select`) as HTMLSelectElement | null;
          if (select) select.value = value;
          const chosen = openContainer.querySelector(".select2-chosen");
          if (chosen) chosen.textContent = value;
        }
        document.getElementById("select2-drop")?.remove();
        openContainer = null;
      }
    });

    // jQuery-UI autocomplete: clicking the contact input shows .ac_results;
    // Enter closes it again (waitForContacts polls for a *visible* .ac_results).
    const contactInput = document.getElementById("autocomplete_monitoring_contact_id");
    if (!contactInput) throw new Error("stub: contact input not found in fixture");
    contactInput.addEventListener("click", () => {
      if (!document.querySelector(".ac_results")) {
        const results = document.createElement("div");
        results.className = "ac_results";
        results.textContent = "autocomplete result";
        document.body.appendChild(results);
      }
    });
    contactInput.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).keyCode === 13) document.querySelector(".ac_results")?.remove();
    });
  }, optionsBySelectId);
}

// ---------------------------------------------------------------------------
// Test 1: "Text mode" toggle round-trip on monitoring/list
// ---------------------------------------------------------------------------
test("text-mode toggle converts popover icons to inline text and back", async () => {
  const page = await context.newPage();

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await serveFixture(page, "https://office.bexio.com/index.php/monitoring/list", "monitoring-list");
  await page.goto("https://office.bexio.com/index.php/monitoring/list");

  const toggle = page.locator("#PopoverTextSwitcher");
  await expect(toggle).toBeAttached({ timeout: 10_000 });
  // The label reflects the current setting:
  // false → "🙈 Popover mode", true → "👀 Text mode".
  await expect(toggle).toContainText("Popover mode");

  const icons = page.locator('i[rel="popover"]');
  const iconCount = await icons.count();
  expect(iconCount).toBeGreaterThan(0);
  await expect(page.locator(".new-popover-text")).toHaveCount(0);

  // Convert: every popover icon is hidden and replaced by an inline text div.
  await toggle.click();
  await expect(page.locator(".new-popover-text")).toHaveCount(iconCount);
  await expect(icons.first()).toHaveCSS("display", "none");
  await expect(toggle).toContainText("Text mode");
  // The inline text is the decoded data-content of the icon (fixture value).
  await expect(page.locator(".new-popover-text").first()).toHaveText("UpHill Conference & QA");

  // Revert: inline texts removed, icons restored.
  await toggle.click();
  await expect(page.locator(".new-popover-text")).toHaveCount(0);
  await expect(icons.first()).toHaveCSS("display", "inline-block");
  await expect(toggle).toContainText("Popover mode");

  expect(errors, `unexpected page errors:\n${errors.join("\n")}`).toEqual([]);

  await page.close();
});

// ---------------------------------------------------------------------------
// Test 2: applying a template fills the monitoring/edit form
// ---------------------------------------------------------------------------
test("clicking a template button fills the form via the synthetic-event path", async () => {
  test.skip(!serviceWorker, "could not resolve the extension service worker — cannot seed chrome.storage");

  await seedTemplates([TEMPLATE]);

  const page = await context.newPage();

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await serveFixture(page, "https://office.bexio.com/index.php/monitoring/edit", "monitoring-edit");
  await page.goto("https://office.bexio.com/index.php/monitoring/edit");

  const templateButton = page.locator(`button#${TEMPLATE.id}`);
  await expect(templateButton).toBeAttached({ timeout: 10_000 });

  await installBexioFormStub(page, {
    // fillForm always passes the literal string "work" for the work field
    monitoring_client_service_id: ["work"],
    monitoring_monitoring_status_id: [TEMPLATE.status],
    monitoring_sub_contact_id: [TEMPLATE.contactPerson],
    monitoring_pr_project_id: [TEMPLATE.project],
    monitoring_pr_package_id: [TEMPLATE.package],
  });

  await expect(page.locator("#monitoring_allowable_bill")).not.toBeChecked();

  await templateButton.click();

  // The waitFor* helpers poll at 1 s intervals and triggerContactField ends in
  // a fixed 1 s delay, so give the full fill a generous window.
  const applied = { timeout: 30_000 };
  await expect(page.locator("#s2id_monitoring_monitoring_status_id .select2-chosen")).toHaveText(
    TEMPLATE.status,
    applied,
  );
  await expect(page.locator("#autocomplete_monitoring_contact_id")).toHaveValue(TEMPLATE.contact, applied);
  await expect(page.locator("#s2id_monitoring_sub_contact_id .select2-chosen")).toHaveText(
    TEMPLATE.contactPerson,
    applied,
  );
  await expect(page.locator("#s2id_monitoring_pr_project_id .select2-chosen")).toHaveText(TEMPLATE.project, applied);
  await expect(page.locator("#s2id_monitoring_pr_package_id .select2-chosen")).toHaveText(TEMPLATE.package, applied);
  // The underlying selects carry the values the form would submit.
  await expect(page.locator("#monitoring_pr_project_id")).toHaveValue(TEMPLATE.project);
  await expect(page.locator("#monitoring_pr_package_id")).toHaveValue(TEMPLATE.package);
  // billable: true flipped the initially unchecked checkbox.
  await expect(page.locator("#monitoring_allowable_bill")).toBeChecked();
  // The loader overlay must be gone again once the fill completed.
  await expect(page.locator("#SoulcodeExtensionLoader")).toHaveCSS("display", "none");
  // The clicked template is marked active.
  await expect(templateButton).toHaveClass(/template-button--active/);

  expect(errors, `unexpected page errors:\n${errors.join("\n")}`).toEqual([]);

  await page.close();
});

// ---------------------------------------------------------------------------
// Test 3: template filter hides non-matching buttons, reset restores them
// ---------------------------------------------------------------------------
test("template filter hides non-matching template buttons and reset restores them", async () => {
  test.skip(!serviceWorker, "could not resolve the extension service worker — cannot seed chrome.storage");

  await seedTemplates([
    { ...TEMPLATE, id: "e2ealpha", templateName: "Alpha Template" },
    { ...TEMPLATE, id: "e2ebeta", templateName: "Beta Template" },
  ]);

  const page = await context.newPage();
  await serveFixture(page, "https://office.bexio.com/index.php/monitoring/edit", "monitoring-edit");
  await page.goto("https://office.bexio.com/index.php/monitoring/edit");

  const alpha = page.locator("button#e2ealpha");
  const beta = page.locator("button#e2ebeta");
  await expect(alpha).toBeAttached({ timeout: 10_000 });
  await expect(beta).toBeAttached();

  await page.fill("#templateFilter", "alpha");
  await expect(beta).toHaveCSS("display", "none");
  await expect(alpha).toHaveCSS("display", "block");

  await page.click("#templateFilterReset");
  await expect(page.locator("#templateFilter")).toHaveValue("");
  await expect(alpha).toHaveCSS("display", "block");
  await expect(beta).toHaveCSS("display", "block");

  await page.close();
});

// ---------------------------------------------------------------------------
// Test 4: Add / Delete flows via native dialogs (prompt / alert / confirm)
// ---------------------------------------------------------------------------
test("Add saves a template via prompt() and Delete removes it via confirm()", async () => {
  test.skip(!serviceWorker, "could not resolve the extension service worker — cannot seed chrome.storage");

  await seedTemplates([]);

  const page = await context.newPage();

  const dialogMessages: string[] = [];
  page.on("dialog", (dialog) => {
    dialogMessages.push(`${dialog.type()}: ${dialog.message()}`);
    if (dialog.type() === "prompt") {
      // readFormData.ts: prompt("Name of the template:", <suggestion>)
      void dialog.accept("My E2E Template");
    } else {
      // alert ("Select a template to delete.") and confirm ("Are you sure ...")
      void dialog.accept();
    }
  });

  await serveFixture(page, "https://office.bexio.com/index.php/monitoring/edit", "monitoring-edit");
  await page.goto("https://office.bexio.com/index.php/monitoring/edit");

  await expect(page.locator("#SoulcodeExtensionTemplates")).toBeAttached({ timeout: 10_000 });
  await expect(page.locator("button.template-button")).toHaveCount(0);

  // Add: reads the (empty) form, prompts for a name, saves, re-renders.
  await page.click("#AddNewTemplate");
  const newButton = page.locator("button.template-button", { hasText: "My E2E Template" });
  await expect(newButton).toBeAttached({ timeout: 10_000 });
  expect(dialogMessages.some((m) => m.startsWith("prompt: Name of the template:"))).toBe(true);

  // Delete: first click arms delete mode (alert), clicking the template then
  // asks for confirmation (confirm) and removes it.
  await page.click("#DeleteTemplate");
  await expect(page.locator("#DeleteTemplate")).toHaveClass(/btn-danger/);
  await newButton.click();
  await expect(page.locator("button.template-button")).toHaveCount(0, { timeout: 10_000 });

  expect(dialogMessages.some((m) => m.startsWith("alert: Select a template to delete."))).toBe(true);
  expect(dialogMessages.some((m) => m.startsWith('confirm: Are you sure you want to delete the active template'))).toBe(
    true,
  );

  await page.close();
});
