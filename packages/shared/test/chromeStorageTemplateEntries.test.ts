import { describe, expect, it } from "vitest";
import * as te from "../chromeStorageTemplateEntries";
import type { TemplateEntry } from "../types";

const sample = (over: Partial<TemplateEntry> = {}): TemplateEntry => ({
  templateName: "T",
  keywords: "",
  billable: true,
  contact: "",
  contactPerson: "",
  id: "id1",
  package: "",
  project: "",
  status: "Offen",
  work: "",
  ...over,
});

describe("chromeStorageTemplateEntries", () => {
  it("loadTemplates returns [] when nothing is stored", async () => {
    expect(await te.loadTemplates()).toEqual([]);
  });

  it("saveTemplates then loadTemplates round-trips an array", async () => {
    const entries = [sample({ id: "a", templateName: "Alpha" }), sample({ id: "b", templateName: "Beta" })];
    await te.saveTemplates(entries);
    const loaded = await te.loadTemplates();
    expect(loaded).toEqual(entries);
  });

  it("loadTemplates reads from the 'entries' storage key", async () => {
    const entries = [sample({ id: "x", templateName: "X" })];
    await chrome.storage.local.set({ entries });
    const loaded = await te.loadTemplates();
    expect(loaded).toEqual(entries);
  });

  it("deleteTemplate removes the entry with the matching id", async () => {
    await te.saveTemplates([sample({ id: "keep" }), sample({ id: "del", templateName: "Del" })]);
    await te.deleteTemplate("del");
    const loaded = await te.loadTemplates();
    expect(loaded).toEqual([sample({ id: "keep" })]);
  });

  it("updateTemplate shallow-merges by id", async () => {
    await te.saveTemplates([sample({ id: "u", templateName: "Old", keywords: "k" })]);
    await te.updateTemplate(sample({ id: "u", templateName: "New", keywords: "k" }));
    const loaded = await te.loadTemplates();
    expect(loaded).toEqual([sample({ id: "u", templateName: "New", keywords: "k" })]);
  });
});
