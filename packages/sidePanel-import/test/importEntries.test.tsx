/**
 * Import parse → table rendering (issue #66).
 *
 * Feeds a ManicTime clipboard TSV through the real `handleCsvData` parser into
 * the real `ImportEntries` component and asserts the rendered table, including
 * the specialised cells:
 * - `TableCellBillable` — "Billable" → ✅, "Not billable" → ◻️
 * - `TableCellTrackingDay` — ▶️ apply-buttons on `dd.mm.yyyy` columns, no
 *   button for zero durations
 *
 * jsdom is enough (no browser, no built extension), so this runs on every PR.
 * The chrome.* APIs are the in-memory fake from test/support/chrome-fake.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { message } from "antd";
import ImportEntries from "~/components/ImportEntries/ImportEntries";
import { TemplateContext } from "~/TemplateContext";
import { NO_CONTENT_SCRIPT_MESSAGE } from "~/utils/sendToBexioTab";
import type { TemplateEntry } from "@bexio-chrome-extension/shared/types";

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

const TSV = [
  ["Tag 1", "Notes", "Billable", "01.07.2026", "02.07.2026", "Total"].join("\t"),
  ["Project Falcon", "Did stuff", "Billable", "1:30:00", "0:00:00", "1:30:00"].join("\t"),
  ["Internal", "", "Not billable", "0:45:00", "2:00:00", "2:45:00"].join("\t"),
  ["Total", "", "", "2:15:00", "2:00:00", "4:15:00"].join("\t"),
].join("\n");

async function renderImportEntries() {
  const result = render(
    <TemplateContext.Provider value={{ templates: [template], reloadData: () => {} }}>
      <ImportEntries />
    </TemplateContext.Provider>,
  );
  // Let the mount effects settle (they load the import buffer + the
  // "apply notes" setting from the chrome.storage fake).
  await act(async () => {});
  return result;
}

function pasteIntoTextarea(container: HTMLElement, value: string) {
  const textarea = container.querySelector("textarea");
  if (!textarea) throw new Error("import textarea not found");
  fireEvent.change(textarea, { target: { value } });
}

describe("ImportEntries — ManicTime TSV parse → table", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders the parsed entries with billable icons and ▶️ buttons on tracking-day columns", async () => {
    const { container } = await renderImportEntries();

    pasteIntoTextarea(container, TSV);

    const table = container.querySelector("table.importDataTable") as HTMLElement;
    expect(table).not.toBeNull();

    // Header: the parsed columns plus the "#" and "Template" columns.
    const headerTexts = Array.from(table.querySelectorAll("thead th")).map((th) => th.textContent);
    expect(headerTexts.slice(0, 2)).toEqual(["#", "Template"]);
    // The "Notes" header additionally hosts the apply-notes switch, so use contains.
    expect(headerTexts.some((t) => t?.includes("Tag 1"))).toBe(true);
    expect(headerTexts.some((t) => t?.includes("Billable"))).toBe(true);
    expect(headerTexts.some((t) => t?.includes("01.07.2026"))).toBe(true);

    const rows = table.querySelectorAll("tbody tr");
    // 2 data rows + 1 footer row
    expect(rows).toHaveLength(3);

    const [row1, row2, footer] = Array.from(rows);

    // Row 1: Tag 1 / Notes as plain cells, "Billable" → ✅ (TableCellBillable)
    expect(within(row1 as HTMLElement).getByText("Project Falcon")).toBeDefined();
    expect(within(row1 as HTMLElement).getByText("Did stuff")).toBeDefined();
    expect(within(row1 as HTMLElement).getByText("✅")).toBeDefined();
    // 1:30:00 appears twice in row 1 (tracking day and the plain "Total" column)
    expect(within(row1 as HTMLElement).getAllByText(/1:30:00/)).toHaveLength(2);

    // Row 2: "Not billable" → ◻️
    expect(within(row2 as HTMLElement).getByText("◻️")).toBeDefined();

    // TableCellTrackingDay renders a ▶️ button per non-zero duration on a
    // dd.mm.yyyy column: row 1 has one (0:00:00 renders an empty cell without
    // a button), row 2 has two. The "Total" column is not a tracking day.
    expect(within(table).getAllByRole("button", { name: "▶️" })).toHaveLength(3);

    // Each data row gets a template <select> fed from the TemplateContext.
    const templateSelects = within(row1 as HTMLElement).getAllByRole("combobox");
    expect(within(templateSelects[0]).getByText("Falcon Template")).toBeDefined();

    // Footer row shows the totals from the last TSV row.
    expect(within(footer as HTMLElement).getByText("4:15:00")).toBeDefined();
  });

  it("shows the parser error and no table when the required 'Tag 1' column is missing", async () => {
    const { container } = await renderImportEntries();

    pasteIntoTextarea(
      container,
      [
        ["Name", "01.07.2026"].join("\t"),
        ["Project Falcon", "1:30:00"].join("\t"),
        ["Total", "1:30:00"].join("\t"),
      ].join("\n"),
    );

    expect(screen.getByText(/Make sure you have atleast a column called 'Tag 1'/)).toBeDefined();
    expect(container.querySelector("table.importDataTable")).toBeNull();
  });
});

/**
 * Applying an entry (issue #86): the ▶️ button must never look like it did nothing. The chrome
 * fake has no `chrome.tabs`, so each test installs its own stub.
 */
describe("ImportEntries — applying an entry", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  function installTabsStub(sendMessage: () => Promise<unknown>) {
    (globalThis as unknown as { chrome: Record<string, unknown> }).chrome.tabs = {
      query: async () => [{ id: 7, url: "https://office.bexio.com/index.php/monitoring/edit" }],
      sendMessage,
      update: async () => ({}),
    };
  }

  beforeEach(() => {
    document.body.innerHTML = "";
    errorSpy = vi.spyOn(message, "error").mockImplementation((() => {}) as never);
    errorSpy.mockClear();
  });

  afterEach(() => {
    delete (globalThis as unknown as { chrome: Record<string, unknown> }).chrome.tabs;
  });

  it("marks the entry as applied when the content script acknowledges", async () => {
    installTabsStub(async () => ({ ok: true }));
    const { container } = await renderImportEntries();
    pasteIntoTextarea(container, TSV);

    const applyButton = within(container).getAllByRole("button", { name: "▶️" })[0];
    await act(async () => {
      fireEvent.click(applyButton);
    });

    expect(errorSpy).not.toHaveBeenCalled();
    expect(within(container).getAllByRole("button", { name: "✅" })).toHaveLength(1);
  });

  it("shows an actionable error and leaves the entry unmarked when no content script answers", async () => {
    installTabsStub(async () => {
      throw new Error("Could not establish connection. Receiving end does not exist.");
    });
    const { container } = await renderImportEntries();
    pasteIntoTextarea(container, TSV);

    const applyButton = within(container).getAllByRole("button", { name: "▶️" })[0];
    await act(async () => {
      fireEvent.click(applyButton);
    });

    expect(errorSpy).toHaveBeenCalledWith(NO_CONTENT_SCRIPT_MESSAGE);
    // Still applicable — no ✅ checkmark was set.
    expect(within(container).queryAllByRole("button", { name: "✅" })).toHaveLength(0);
    expect(within(container).getAllByRole("button", { name: "▶️" })).toHaveLength(3);
  });
});
