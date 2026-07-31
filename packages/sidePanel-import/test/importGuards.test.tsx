/**
 * Short-row guards in the import flow (issue #90).
 *
 * `handleCsvData` now rejects rows that do not line up with the header, but an
 * import buffer persisted by an older version can still hold such a row. These
 * tests pin that neither the auto-mapper nor the apply path blows up on one.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, within } from "@testing-library/react";
import ImportEntries from "~/components/ImportEntries/ImportEntries";
import { autoMapTemplatesV3 } from "~/components/ImportEntries/AutoMapTemplatesV3";
import { TemplateContext } from "~/TemplateContext";
import { chromeStorage } from "@bexio-chrome-extension/shared";
import type { EntryExchangeData, TemplateEntry } from "@bexio-chrome-extension/shared/types";

const template: TemplateEntry = {
  templateName: "Falcon Template",
  keywords: "falcon",
  billable: true,
  contact: "Acme AG",
  contactPerson: "Doe Jane",
  id: "tmpl1",
  package: "Package Alpha",
  project: "Project Falcon",
  status: "In Arbeit",
  work: "Consulting",
};

describe("autoMapTemplatesV3 — short rows", () => {
  it("does not throw on a row that is missing a tag column", () => {
    const importHeader = ["Tag 1", "Tag 2", "01.07.2026"];
    // Second row has no "Tag 2" cell — `row[1]` is undefined.
    const importData = [["Project Falcon", "", "1:30:00"], ["Project Falcon"], []];

    let assignment: string[] = [];
    expect(() => {
      assignment = autoMapTemplatesV3(importData, [template], importHeader, [0, 1]);
    }).not.toThrow();

    // The rows that do have content still get mapped.
    expect(assignment[0]).toBe("tmpl1");
    expect(assignment[1]).toBe("tmpl1");
    expect(assignment[2]).toBeUndefined();
  });
});

describe("ImportEntries — applying an entry from a short row", () => {
  const sentMessages: unknown[] = [];

  beforeEach(async () => {
    document.body.innerHTML = "";
    sentMessages.length = 0;
    // chrome.tabs is not part of the shared chrome fake (it throws on unknown
    // members), so add just what applyImportEntry touches.
    (globalThis.chrome as unknown as Record<string, unknown>).tabs = {
      query: async () => [{ id: 1 }],
      sendMessage: async (_tabId: number, data: unknown) => {
        sentMessages.push(data);
      },
    };
    // A row without the (last) "Notes" column, as an older import buffer could
    // have stored it.
    await chromeStorage.save(["Tag 1", "01.07.2026", "Notes"], "importHeader");
    await chromeStorage.save([["Project Falcon", "1:30:00"]], "importData");
  });

  afterEach(() => {
    delete (globalThis.chrome as unknown as Record<string, unknown>).tabs;
  });

  it("falls back to the tag column instead of crashing on the missing Notes cell", async () => {
    const { container } = render(
      <TemplateContext.Provider value={{ templates: [template], reloadData: () => {} }}>
        <ImportEntries />
      </TemplateContext.Provider>,
    );
    await act(async () => {});

    const table = container.querySelector("table.importDataTable") as HTMLElement;
    expect(table).not.toBeNull();

    await act(async () => {
      fireEvent.click(within(table).getByRole("button", { name: "▶️" }));
    });

    // Regression (#90): getNotes returned undefined for the missing column and
    // `notes.length` threw a TypeError before the message was ever sent.
    expect(sentMessages).toHaveLength(1);
    const message = sentMessages[0] as EntryExchangeData;
    expect(message.mode).toBe("time+duration");
    expect(message.date).toBe("01.07.2026");
    expect(message.duration).toBe("1:30");
    expect(message.notes).toBe("Project Falcon");
  });
});
