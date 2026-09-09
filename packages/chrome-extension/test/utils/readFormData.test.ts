import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";

// Mock initializeExtension so we don't try to boot the full content-script UI
vi.mock("@bexio-chrome-extension/chrome-extension/src/apps/bexioTimetrackingTemplates/index", () => ({
  initializeExtension: vi.fn(),
}));

describe("readTextFromSelect2", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
  });

  it("returns the .select2-chosen text for the work field (filled fixture)", async () => {
    loadFixture("monitoring-edit-filled");
    const { workField } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/selectors");
    const { default: readTextFromSelect2 } =
      await import("@bexio-chrome-extension/chrome-extension/src/utils/readTextFromSelect2");
    const result = await readTextFromSelect2(workField);
    // The filled fixture has "Work" in the select2-chosen span for the work field
    expect(result).toBe("Work");
  });

  it("returns the .select2-chosen text for the status field (filled fixture)", async () => {
    loadFixture("monitoring-edit-filled");
    const { statusField } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/selectors");
    const { default: readTextFromSelect2 } =
      await import("@bexio-chrome-extension/chrome-extension/src/utils/readTextFromSelect2");
    const result = await readTextFromSelect2(statusField);
    // The filled fixture has "Erledigt" in the status select2-chosen span
    expect(result).toBe("Erledigt");
  });

  it("returns the .select2-chosen text for the project field (filled fixture)", async () => {
    loadFixture("monitoring-edit-filled");
    const { projectField } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/selectors");
    const { default: readTextFromSelect2 } =
      await import("@bexio-chrome-extension/chrome-extension/src/utils/readTextFromSelect2");
    const result = await readTextFromSelect2(projectField);
    // The filled fixture has "Acme - Back Office" for the project
    expect(result).toBe("Acme - Back Office");
  });

  it("returns the .select2-chosen text for the package field (filled fixture)", async () => {
    loadFixture("monitoring-edit-filled");
    const { packageField } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/selectors");
    const { default: readTextFromSelect2 } =
      await import("@bexio-chrome-extension/chrome-extension/src/utils/readTextFromSelect2");
    const result = await readTextFromSelect2(packageField);
    // The filled fixture has "Misc" for the package
    expect(result).toBe("Misc");
  });

  it("returns empty string for the contactPerson field (not filled in fixture)", async () => {
    loadFixture("monitoring-edit-filled");
    const { contactPersonField } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/selectors");
    const { default: readTextFromSelect2 } =
      await import("@bexio-chrome-extension/chrome-extension/src/utils/readTextFromSelect2");
    const result = await readTextFromSelect2(contactPersonField);
    // The filled fixture has an empty select2-chosen span for contactPerson
    expect(result).toBe("");
  });
});

describe("readFormData", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("saves a new template entry with the form data and a 64-hex-char id", async () => {
    loadFixture("monitoring-edit-filled");
    vi.spyOn(globalThis, "prompt").mockReturnValue("My Template");
    vi.spyOn(globalThis, "alert").mockImplementation(() => {});
    vi.spyOn(globalThis, "confirm").mockReturnValue(true);

    const { default: readFormData } = await import("@bexio-chrome-extension/chrome-extension/src/utils/readFormData");
    await readFormData();

    const stored = await chrome.storage.local.get("entries");
    const entries: Array<Record<string, unknown>> = stored.entries as Array<Record<string, unknown>>;
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBe(1);

    const entry = entries[0];
    // templateName is set from prompt() return value
    expect(entry.templateName).toBe("My Template");
    // id is a 64-char lowercase hex SHA-256 hash
    expect(typeof entry.id).toBe("string");
    expect((entry.id as string).length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(entry.id as string)).toBe(true);

    // Check the form values that readFormData reads from the filled fixture
    // work: readTextFromSelect2(workField) → "Work"
    expect(entry.work).toBe("Work");
    // status: readTextFromSelect2(statusField) → "Erledigt"
    expect(entry.status).toBe("Erledigt");
    // project: readTextFromSelect2(projectField) → "Acme - Back Office"
    expect(entry.project).toBe("Acme - Back Office");
    // package: readTextFromSelect2(packageField) → "Misc"
    expect(entry.package).toBe("Misc");
    // billable: checkbox is unchecked in filled fixture
    expect(typeof entry.billable).toBe("boolean");
  });

  // ─── suggested template name ───────────────────────────────────────────────
  //
  // The name prefilled into prompt() is a fallback chain:
  //   package || project || contact || work || "New Template"
  // Every link runs through trimAll, which strips *all* whitespace, so the
  // suggestion is the field value with its spaces removed.

  /** Overwrite the rendered select2 text of one field in the loaded fixture. */
  function setSelect2Text(containerId: string, text: string) {
    const input = document.querySelector(`${containerId} input`)!;
    input.closest(".input")!.querySelector(".select2-chosen")!.textContent = text;
  }

  /** Overwrite the contact autocomplete input in the loaded fixture. */
  function setContact(text: string) {
    (document.querySelector("#autocomplete_monitoring_contact_id") as HTMLInputElement).value = text;
  }

  async function suggestedTemplateName(): Promise<string | undefined> {
    const promptSpy = vi.spyOn(globalThis, "prompt").mockReturnValue("My Template");
    vi.spyOn(globalThis, "alert").mockImplementation(() => {});
    vi.spyOn(globalThis, "confirm").mockReturnValue(true);

    const { default: readFormData } = await import("@bexio-chrome-extension/chrome-extension/src/utils/readFormData");
    await readFormData();

    return promptSpy.mock.calls[0]?.[1];
  }

  it("suggests the package name first, with whitespace stripped", async () => {
    loadFixture("monitoring-edit-filled");
    setSelect2Text("#s2id_monitoring_pr_package_id", "Some Package");

    expect(await suggestedTemplateName()).toBe("SomePackage");
  });

  it("falls back to the project when the package is empty", async () => {
    loadFixture("monitoring-edit-filled");
    setSelect2Text("#s2id_monitoring_pr_package_id", "");

    // The filled fixture's project is "Acme - Back Office"
    expect(await suggestedTemplateName()).toBe("Acme-BackOffice");
  });

  it("falls back to the contact when package and project are empty", async () => {
    loadFixture("monitoring-edit-filled");
    setSelect2Text("#s2id_monitoring_pr_package_id", "");
    setSelect2Text("#s2id_monitoring_pr_project_id", "");
    setContact("Acme AG Zurich");

    // readFormData keeps only the first two words of the contact
    expect(await suggestedTemplateName()).toBe("AcmeAG");
  });

  it("falls back to the work type when package, project and contact are empty", async () => {
    loadFixture("monitoring-edit-filled");
    setSelect2Text("#s2id_monitoring_pr_package_id", "");
    setSelect2Text("#s2id_monitoring_pr_project_id", "");
    setContact("");
    setSelect2Text("#s2id_monitoring_client_service_id", "Project Management");

    expect(await suggestedTemplateName()).toBe("ProjectManagement");
  });

  it("falls back to 'New Template' when every naming field is empty", async () => {
    loadFixture("monitoring-edit-filled");
    setSelect2Text("#s2id_monitoring_pr_package_id", "");
    setSelect2Text("#s2id_monitoring_pr_project_id", "");
    setContact("");
    setSelect2Text("#s2id_monitoring_client_service_id", "");

    expect(await suggestedTemplateName()).toBe("New Template");
  });

  it("aborts and saves nothing when prompt returns null", async () => {
    loadFixture("monitoring-edit-filled");
    vi.spyOn(globalThis, "prompt").mockReturnValue(null);
    const alertSpy = vi.spyOn(globalThis, "alert").mockImplementation(() => {});
    vi.spyOn(globalThis, "confirm").mockReturnValue(true);

    const { default: readFormData } = await import("@bexio-chrome-extension/chrome-extension/src/utils/readFormData");
    await readFormData();

    // alert must have been called to inform the user
    expect(alertSpy).toHaveBeenCalledWith("Please enter a name for the template");

    // Nothing should be saved
    const stored = await chrome.storage.local.get("entries");
    // Either the key doesn't exist or entries is empty
    const entries = stored.entries;
    expect(!entries || (Array.isArray(entries) && entries.length === 0)).toBe(true);
  });
});
