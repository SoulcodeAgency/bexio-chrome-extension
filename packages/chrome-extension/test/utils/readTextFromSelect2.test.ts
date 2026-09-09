import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";

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
