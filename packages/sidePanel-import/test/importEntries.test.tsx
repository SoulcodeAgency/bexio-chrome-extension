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
    <TemplateContext.Provider value={{ templates: [template], reloadData: async () => {} }}>
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

  /**
   * Frozen leading columns (issue #12). `getFrozenColumns` owns which columns are pinned and is
   * pinned in test/frozenColumns.test.ts; this checks that every cell of the leading block
   * actually receives it — header, data rows and the footer row alike — and that the scrolling
   * columns are left alone.
   *
   * Each pinned cell reads its offset from a `--frozen-left-N` custom property that
   * `useFrozenColumnOffsets` measures onto the table. Nothing here sets a width: the columns
   * size themselves to their content so nothing is ever clipped. The measured pixel values
   * cannot be asserted — jsdom has no layout — and are verified in the browser instead.
   */
  it("pins the columns before the first date column and leaves the date columns scrolling", async () => {
    const { container } = await renderImportEntries();

    pasteIntoTextarea(container, TSV);

    const table = container.querySelector("table.importDataTable") as HTMLElement;
    const rows = [
      Array.from(table.querySelectorAll("thead th")) as HTMLElement[],
      ...Array.from(table.querySelectorAll("tbody tr")).map(
        (row) => Array.from(row.querySelectorAll("td")) as HTMLElement[],
      ),
    ];
    // Header + 2 data rows + footer row, each with 2 extra columns in front of the 6 imported ones.
    expect(rows).toHaveLength(4);

    for (const cells of rows) {
      expect(cells).toHaveLength(8);

      // "#", "Template", "Tag 1", "Notes", "Billable" — the block that stays put.
      for (let position = 0; position < 5; position++) {
        const cell = cells[position];
        expect(cell.className).toContain("frozenColumn");
        expect(cell.style.left).toBe(`var(--frozen-left-${position})`);
        // A fixed width would clip the content — the whole point is that it does not.
        expect(cell.style.width).toBe("");
      }

      // "Billable" is the rightmost frozen column and carries the separating shadow.
      expect(cells[4].className).toContain("frozenColumn--last");
      expect(cells[3].className).not.toContain("frozenColumn--last");

      // The two tracking days and the trailing "Total" column scroll.
      for (const cell of cells.slice(5)) {
        expect(cell.className).not.toContain("frozenColumn");
        expect(cell.style.left).toBe("");
      }
    }
  });

  /**
   * The usage help is long enough to push the table off screen, so it is collapsed by default
   * and only costs its header row until the user asks for it.
   */
  it("keeps the usage help collapsed until it is opened", async () => {
    const { container } = await renderImportEntries();

    pasteIntoTextarea(container, TSV);

    expect(screen.queryByText("Date and Time will get applied on the bexio form directly.")).toBeNull();

    fireEvent.click(screen.getByText("How to use this"));

    expect(screen.getByText("Date and Time will get applied on the bexio form directly.")).toBeDefined();
  });

  it("pins nothing when the import has no date column", async () => {
    const { container } = await renderImportEntries();

    pasteIntoTextarea(
      container,
      [
        ["Tag 1", "Billable", "Total"].join("\t"),
        ["Project Falcon", "Billable", "1:30:00"].join("\t"),
        ["Total", "", "1:30:00"].join("\t"),
      ].join("\n"),
    );

    const table = container.querySelector("table.importDataTable") as HTMLElement;
    expect(table.querySelectorAll(".frozenColumn")).toHaveLength(0);
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

/**
 * Stale import state across a side-panel reload (issue #87).
 *
 * `entryStatus` and `importTemplates` are keyed by row/column index into `importData`.
 * A new paste must not leave the previous import's status/templates behind, otherwise a
 * reload pairs new rows with old checkmarks and old templates — one click would then book
 * the wrong project, and rows already marked "applied" would silently be skipped.
 */
// One column narrower than TSV, so the tracking day sits at column index 2 instead of 3 and a
// stale `entryStatus` key of dataset A would be recognisable.
const TSV_B = [
  ["Tag 1", "Billable", "03.07.2026", "Total"].join("\t"),
  ["Project Condor", "Billable", "2:00:00", "2:00:00"].join("\t"),
  ["Total", "", "2:00:00", "2:00:00"].join("\t"),
].join("\n");

const IMPORT_DATA_B = [["Project Condor", "Billable", "2:00:00", "2:00:00"]];

/** Applies the first ▶️ button and lets the async send/apply chain settle. */
async function clickFirstApplyButton(container: HTMLElement) {
  const button = within(container).getAllByRole("button", { name: "▶️" })[0];
  await act(async () => {
    fireEvent.click(button);
  });
  await act(async () => {});
}

async function readImportBuffer() {
  return await chrome.storage.local.get([
    "importHeader",
    "importData",
    "importFooter",
    "entryStatus",
    "importTemplates",
  ]);
}

describe("ImportEntries — import state does not survive a new import (issue #87)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    // applyImportEntry / applyTemplate talk to the active tab; the chrome fake has no tabs API.
    (chrome as unknown as { tabs: unknown }).tabs = {
      query: async () => [{ id: 1, url: "https://office.bexio.com/index.php/monitoring/edit" }],
      sendMessage: async () => undefined,
      update: async () => undefined,
    };
  });

  afterEach(() => {
    delete (chrome as unknown as { tabs?: unknown }).tabs;
  });

  it("drops the previous status and templates when a new import is pasted and saved", async () => {
    const first = await renderImportEntries();

    // Dataset A: auto map the templates and apply one entry.
    pasteIntoTextarea(first.container, TSV);
    await act(async () => {
      fireEvent.click(within(first.container).getByRole("button", { name: "Auto map templates" }));
    });
    await clickFirstApplyButton(first.container);

    expect(within(first.container).getAllByRole("button", { name: "✅" })).toHaveLength(1);
    const bufferAfterA = await readImportBuffer();
    expect(bufferAfterA.entryStatus).toEqual({ "3-0": true });
    expect(bufferAfterA.importTemplates).toEqual(["tmpl1"]);

    // Dataset B replaces it, and gets saved.
    pasteIntoTextarea(first.container, TSV_B);
    await act(async () => {
      fireEvent.click(within(first.container).getByRole("button", { name: "Save this import" }));
    });

    const bufferAfterB = await readImportBuffer();
    expect(bufferAfterB.importData).toEqual(IMPORT_DATA_B);
    expect(bufferAfterB.entryStatus).toEqual({});
    expect(bufferAfterB.importTemplates).toEqual([]);

    // Reopening the side panel re-mounts the component and re-reads storage.
    first.unmount();
    const second = await renderImportEntries();

    expect(within(second.container).getByText("Project Condor")).toBeDefined();
    expect(within(second.container).queryAllByRole("button", { name: "✅" })).toHaveLength(0);
    expect(within(second.container).getAllByRole("button", { name: "▶️" })).toHaveLength(1);
    const templateSelect = second.container.querySelector("tbody select") as HTMLSelectElement;
    expect(templateSelect.value).toBe("");
  });

  it("keeps both statuses when a second entry is applied before the first one settles", async () => {
    const { container } = await renderImportEntries();

    pasteIntoTextarea(container, TSV);
    const buttons = within(container).getAllByRole("button", { name: "▶️" });
    // Both clicks happen before the async apply chain of the first one resolves — the status of
    // the first entry must not be clobbered by the stale state the second click started from.
    await act(async () => {
      fireEvent.click(buttons[0]);
      fireEvent.click(buttons[1]);
    });
    await act(async () => {});

    const buffer = await readImportBuffer();
    expect(buffer.entryStatus).toEqual({ "3-0": true, "3-1": true });
    expect(within(container).getAllByRole("button", { name: "✅" })).toHaveLength(2);
  });

  it("keeps storage consistent when new data is pasted but not saved", async () => {
    const first = await renderImportEntries();

    pasteIntoTextarea(first.container, TSV);
    await clickFirstApplyButton(first.container);

    // No "Save this import" click for dataset B — but applying an entry still persists a status,
    // so the stored rows have to be B's already.
    pasteIntoTextarea(first.container, TSV_B);
    await clickFirstApplyButton(first.container);

    const buffer = await readImportBuffer();
    expect(buffer.importData).toEqual(IMPORT_DATA_B);
    expect(buffer.entryStatus).toEqual({ "2-0": true });

    first.unmount();
    const second = await renderImportEntries();

    // The single checkmark belongs to the row the user actually applied.
    expect(within(second.container).getByText("Project Condor")).toBeDefined();
    expect(within(second.container).queryAllByRole("button", { name: "✅" })).toHaveLength(1);
  });
});
