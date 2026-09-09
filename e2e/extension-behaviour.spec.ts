/**
 * Extension-behaviour Playwright tests (issue #66).
 *
 * Where extension-smoke.spec.ts only asserts that the content scripts *inject*,
 * these tests assert *behaviour* on the same anonymised bexio fixtures:
 *
 * - the "Text mode" toggle round-trip on monitoring/list (bexioProjectList)
 * - applying a template on monitoring/edit (the fragile fillForm +
 *   synthetic-event path through src/utils/trigger*.ts)
 * - the template filter input (names, keywords, empty state, reset)
 * - the inline Add flow and the manage-mode delete with Undo — both
 *   dialog-free by design; page.on("dialog") stays wired to prove no
 *   native prompt()/confirm()/alert() ever opens
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
    // fillForm passes the template's own work (Tätigkeit) value (#81)
    monitoring_client_service_id: [TEMPLATE.work],
    monitoring_monitoring_status_id: [TEMPLATE.status],
    monitoring_sub_contact_id: [TEMPLATE.contactPerson],
    monitoring_pr_project_id: [TEMPLATE.project],
    monitoring_pr_package_id: [TEMPLATE.package],
  });

  await expect(page.locator("#monitoring_allowable_bill")).not.toBeChecked();

  await templateButton.click();

  // The waitFor* helpers poll at 250 ms intervals and triggerContactField ends in
  // a fixed 1 s delay, so give the full fill a generous window. The stub satisfies
  // every awaited condition within a poll or two, well inside the helpers' own
  // 20 s deadline (see src/utils/pollUntil.ts), so that cannot fire here.
  const applied = { timeout: 30_000 };
  await expect(page.locator("#s2id_monitoring_client_service_id .select2-chosen")).toHaveText(TEMPLATE.work, applied);
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
// Test 3: template filter matches names and keywords, reset restores
// ---------------------------------------------------------------------------
test("template filter matches names and keywords; reset restores", async () => {
  test.skip(!serviceWorker, "could not resolve the extension service worker — cannot seed chrome.storage");

  await seedTemplates([
    { ...TEMPLATE, id: "e2ealpha", templateName: "Alpha Template" },
    { ...TEMPLATE, id: "e2ebeta", templateName: "Beta Template", keywords: "zebra" },
  ]);

  const page = await context.newPage();
  await serveFixture(page, "https://office.bexio.com/index.php/monitoring/edit", "monitoring-edit");
  await page.goto("https://office.bexio.com/index.php/monitoring/edit");

  const alpha = page.locator("button#e2ealpha");
  const beta = page.locator("button#e2ebeta");
  await expect(alpha).toBeAttached({ timeout: 10_000 });

  await page.fill("#templateFilter", "alpha");
  await expect(beta).toBeHidden();
  await expect(alpha).toBeVisible();

  // keyword match: "zebra" is in beta's keywords, not its name
  await page.fill("#templateFilter", "zebra");
  await expect(alpha).toBeHidden();
  await expect(beta).toBeVisible();

  // no match → empty state with the query
  await page.fill("#templateFilter", "nomatch");
  await expect(page.locator("#templateFilterEmpty")).toBeVisible();
  await expect(page.locator("#templateFilterEmpty")).toHaveText('No templates match "nomatch"');

  await page.fill("#templateFilter", "zebra");
  await page.click("#templateFilterReset");
  await expect(page.locator("#templateFilter")).toHaveValue("");
  await expect(alpha).toBeVisible();
  await expect(beta).toBeVisible();

  await page.close();
});

// ---------------------------------------------------------------------------
// Test 4: inline Add + manage-mode delete with Undo — no native dialogs
// ---------------------------------------------------------------------------
test("inline Add saves a template; manage mode deletes it with Undo — no native dialogs", async () => {
  test.skip(!serviceWorker, "could not resolve the extension service worker — cannot seed chrome.storage");

  await seedTemplates([]);

  const page = await context.newPage();
  const dialogs: string[] = [];
  page.on("dialog", (dialog) => {
    dialogs.push(`${dialog.type()}: ${dialog.message()}`);
    void dialog.dismiss();
  });

  await serveFixture(page, "https://office.bexio.com/index.php/monitoring/edit", "monitoring-edit");
  await page.goto("https://office.bexio.com/index.php/monitoring/edit");
  await expect(page.locator("#SoulcodeExtensionTemplates")).toBeAttached({ timeout: 10_000 });

  // Add via the inline form. The form is shown first and the suggested name filled
  // in afterwards (so a failing form read cannot leave "+ Add" looking dead), so
  // wait for that suggestion before typing over it.
  await page.click("#AddNewTemplate");
  await expect(page.locator("#SoulcodeExtensionAddForm")).toBeVisible();
  await expect(page.locator("#templateNameInput")).not.toHaveValue("");
  await page.fill("#templateNameInput", "My E2E Template");
  await page.click("#templateNameSave");
  const newButton = page.locator("button.template-button", { hasText: "My E2E Template" });
  await expect(newButton).toBeAttached({ timeout: 10_000 });

  // Delete via manage mode
  await page.click("#ManageTemplates");
  await expect(page.locator("#SoulcodeExtensionTemplates")).toHaveClass(/manage-mode/);
  await page.click(".template-chip-delete");
  await expect(page.locator("button.template-button")).toHaveCount(0, { timeout: 10_000 });
  const toast = page.locator("#SoulcodeExtensionToast");
  await expect(toast).toContainText('Deleted "My E2E Template"');
  // The empty state has to catch up even though the delete does not re-render.
  await expect(page.locator("#templateFilterEmpty")).toBeHidden(); // nothing searched → stays silent

  // Leaving manage mode must not cancel the undo window.
  await page.click("#ManageTemplates");
  await expect(toast).toBeVisible();

  // Undo restores it (re-render leaves manage mode)
  await toast.locator("button").click();
  await expect(page.locator("button.template-button", { hasText: "My E2E Template" })).toBeAttached({
    timeout: 10_000,
  });

  expect(dialogs, "the template area must not open native dialogs").toEqual([]);

  await page.close();
});
