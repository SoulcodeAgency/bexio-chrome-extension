import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";
import type { TemplateEntry } from "@bexio-chrome-extension/shared/types";

const template = (over: Partial<TemplateEntry> = {}): TemplateEntry => ({
  templateName: "Project Falcon",
  keywords: "",
  billable: false,
  contact: "Acme AG",
  contactPerson: "Doe Jane",
  id: "tmpl1",
  package: "Package Alpha",
  project: "Project Falcon",
  status: "In Arbeit",
  work: "",
  ...over,
});

describe("updateActiveTemplate", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
  });

  it("overwrites the stored fields with the form values, keeping id, templateName and keywords", async () => {
    loadFixture("monitoring-edit-filled");
    const existing = template({ id: "keep-me", templateName: "Keep Name", keywords: "kw stays", work: "Old" });
    await chrome.storage.local.set({ entries: [existing] });

    const { updateActiveTemplate } =
      await import("@bexio-chrome-extension/chrome-extension/src/utils/updateActiveTemplate");
    expect(await updateActiveTemplate("keep-me")).toBe(true);

    const stored = (await chrome.storage.local.get("entries")).entries as TemplateEntry[];
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe("keep-me");
    expect(stored[0].templateName).toBe("Keep Name");
    expect(stored[0].keywords).toBe("kw stays");
    expect(stored[0].work).toBe("Work"); // from the filled fixture
    expect(stored[0].project).toBe("Acme - Back Office");
  });

  it("returns false and writes nothing for an unknown id", async () => {
    loadFixture("monitoring-edit-filled");
    await chrome.storage.local.set({ entries: [template({ id: "other" })] });
    const { updateActiveTemplate } =
      await import("@bexio-chrome-extension/chrome-extension/src/utils/updateActiveTemplate");
    expect(await updateActiveTemplate("missing")).toBe(false);
    const stored = (await chrome.storage.local.get("entries")).entries as TemplateEntry[];
    expect(stored.map((e) => e.id)).toEqual(["other"]);
  });
});
