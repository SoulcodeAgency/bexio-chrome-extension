import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";
import type { TemplateFormValues } from "@bexio-chrome-extension/chrome-extension/src/utils/readCurrentFormValues";

// Selectors capture their elements at import time — fixture first, then import.
const importModule = async () =>
  await import("@bexio-chrome-extension/chrome-extension/src/utils/readCurrentFormValues");

describe("readCurrentFormValues", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
  });

  it("reads the filled fixture's form values", async () => {
    loadFixture("monitoring-edit-filled");
    const { readCurrentFormValues } = await importModule();
    const values = await readCurrentFormValues();
    expect(values.work).toBe("Work");
    expect(values.status).toBe("Erledigt");
    expect(values.project).toBe("Acme - Back Office");
    expect(values.package).toBe("Misc");
    expect(values.contactPerson).toBe("");
    expect(typeof values.contact).toBe("string");
    expect(typeof values.billable).toBe("boolean");
  });

  it("keeps only the first two words of the contact", async () => {
    loadFixture("monitoring-edit-filled");
    (document.querySelector("#autocomplete_monitoring_contact_id") as HTMLInputElement).value = "Acme AG Zurich";
    const { readCurrentFormValues } = await importModule();
    expect((await readCurrentFormValues()).contact).toBe("Acme AG");
  });
});

describe("suggestTemplateName", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
  });

  const values = (over: Partial<TemplateFormValues> = {}): TemplateFormValues => ({
    work: "",
    status: "",
    contact: "",
    contactPerson: "",
    project: "",
    package: "",
    billable: false,
    ...over,
  });

  it("prefers the package name, whitespace stripped", async () => {
    const { suggestTemplateName } = await importModule();
    expect(suggestTemplateName(values({ package: "Some Package", project: "P" }))).toBe("SomePackage");
  });

  it("falls back project → contact → work → 'New Template'", async () => {
    const { suggestTemplateName } = await importModule();
    expect(suggestTemplateName(values({ project: "Acme - Back Office" }))).toBe("Acme-BackOffice");
    expect(suggestTemplateName(values({ contact: "Acme AG" }))).toBe("AcmeAG");
    expect(suggestTemplateName(values({ work: "Project Management" }))).toBe("ProjectManagement");
    expect(suggestTemplateName(values())).toBe("New Template");
  });
});
