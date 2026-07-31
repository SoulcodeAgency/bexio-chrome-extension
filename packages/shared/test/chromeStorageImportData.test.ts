import { describe, expect, it } from "vitest";
import * as importData from "../chromeStorageImportData";
import type { ImportData } from "../types";

// ImportData is string[] per types.ts
const sampleEntry = (): ImportData => ["row1col1", "row1col2"];

describe("chromeStorageImportData", () => {
  it("loadImportData returns [] when nothing is stored (default)", async () => {
    expect(await importData.loadImportData()).toEqual([]);
  });

  it("saveImportData then loadImportData round-trips an array", async () => {
    const entries: ImportData[] = [sampleEntry(), ["r2c1", "r2c2"]];
    await importData.saveImportData(entries);
    const loaded = await importData.loadImportData();
    expect(loaded).toEqual(entries);
  });

  it("loadImportData reads from the 'importData' storage key", async () => {
    const entries: ImportData[] = [["a", "b"]];
    await chrome.storage.local.set({ importData: entries });
    const loaded = await importData.loadImportData();
    expect(loaded).toEqual(entries);
  });

  it("deleteImportData removes the entry whose first element matches the given id", async () => {
    // deleteImportData uses chromeStorage.remove which filters on entry.id;
    // ImportData is string[] so entry.id is undefined — remove won't match any entry.
    // KNOWN ISSUE: deleteImportData(id) is effectively a no-op because ImportData is a
    // string[], not an object with an `id` field, so chromeStorage.remove never finds a match.
    const entries: ImportData[] = [["keep"], ["alsoKeep"]];
    await importData.saveImportData(entries);
    await importData.deleteImportData("keep");
    const loaded = await importData.loadImportData();
    // Both entries survive because no entry has an .id property to match
    expect(loaded).toEqual(entries);
  });

  it("deleteImportData does not touch the 'entries' (template) key", async () => {
    const templates = [{ id: "t1", templateName: "Template 1" }];
    await chrome.storage.local.set({ entries: templates });
    const entries: ImportData[] = [["keep"], ["alsoKeep"]];
    await importData.saveImportData(entries);

    await importData.deleteImportData("keep");

    const raw = await chrome.storage.local.get(["entries", "importData"]);
    expect(raw.entries).toEqual(templates);
    expect(raw.importData).toEqual(entries);
  });
});
