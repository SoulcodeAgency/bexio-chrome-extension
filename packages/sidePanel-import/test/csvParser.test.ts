/**
 * `handleCsvData` — the ManicTime clipboard TSV parser (issues #90 / #98).
 *
 * Pure function, no DOM and no chrome.* involved. The important guarantees:
 * the *last non-empty* line is always the footer (never an applyable data row),
 * CR characters never survive into any cell, and every data row lines up with
 * the header.
 */
import { describe, expect, it } from "vitest";
import { handleCsvData } from "~/utils/csvParser";

const HEADER = ["Tag 1", "Notes", "Billable", "01.07.2026", "02.07.2026", "Total"];
const ROW_1 = ["Project Falcon", "Did stuff", "Billable", "1:30:00", "0:00:00", "1:30:00"];
const ROW_2 = ["Internal", "", "Not billable", "0:45:00", "2:00:00", "2:45:00"];
const TOTALS = ["Total", "", "", "2:15:00", "2:00:00", "4:15:00"];

function tsv(rows: string[][], { eol = "\n", trailing = "" } = {}) {
  return rows.map((row) => row.join("\t")).join(eol) + trailing;
}

describe("handleCsvData", () => {
  it("splits a ManicTime block into header, data rows and footer", () => {
    const { importHeader, importData, importFooter } = handleCsvData(tsv([HEADER, ROW_1, ROW_2, TOTALS]));

    expect(importHeader).toEqual(HEADER);
    expect(importData).toEqual([ROW_1, ROW_2]);
    expect(importFooter).toEqual(TOTALS);
  });

  it("keeps the totals row as the footer when the block ends with a trailing newline", () => {
    const { importData, importFooter } = handleCsvData(tsv([HEADER, ROW_1, ROW_2, TOTALS], { trailing: "\n" }));

    // Regression (#90): without trimming, the footer became [""] and the
    // totals row turned into an applyable data row — one click on its date
    // column would book the day's TOTAL time into bexio.
    expect(importFooter).toEqual(TOTALS);
    expect(importData).toEqual([ROW_1, ROW_2]);
  });

  it("tolerates several trailing newlines", () => {
    const { importData, importFooter } = handleCsvData(tsv([HEADER, ROW_1, TOTALS], { trailing: "\n\n\n" }));

    expect(importFooter).toEqual(TOTALS);
    expect(importData).toEqual([ROW_1]);
  });

  it("strips CR from the header and the footer, not just from the data rows", () => {
    const { importHeader, importData, importFooter } = handleCsvData(
      tsv([HEADER, ROW_1, TOTALS], { eol: "\r\n", trailing: "\r\n" }),
    );

    // Regression (#90): the last header cell used to keep its "\r", which broke
    // every exact match on a column name ("Tag 1", "Billable", "Notes") and the
    // dd.mm.yyyy tracking-day regex for that column.
    expect(importHeader).toEqual(HEADER);
    expect(importData).toEqual([ROW_1]);
    expect(importFooter).toEqual(TOTALS);
    expect(JSON.stringify({ importHeader, importData, importFooter })).not.toContain("\\r");
  });

  it("drops blank lines in the middle of the block", () => {
    const csv = [HEADER, ROW_1, ROW_2, TOTALS].map((row) => row.join("\t")).join("\n\n");

    const { importData, importFooter } = handleCsvData(csv);

    // Regression (#90): a blank line produced a [""] row, which later made
    // autoMapTemplatesV3 throw on `tagColumn.match(...)`.
    expect(importData).toEqual([ROW_1, ROW_2]);
    expect(importFooter).toEqual(TOTALS);
  });

  it("rejects a block whose header has no 'Tag 1' column", () => {
    expect(() => handleCsvData(tsv([["Name", "01.07.2026"], ROW_1, TOTALS]))).toThrow(
      /atleast a column called 'Tag 1'/,
    );
  });

  it("rejects an empty or whitespace-only paste with the 'Tag 1' message", () => {
    // The textarea fires onChange with "" when the user clears it — that must
    // report a parse error, not crash on rows[0].
    expect(() => handleCsvData("")).toThrow(/atleast a column called 'Tag 1'/);
    expect(() => handleCsvData("\r\n \n")).toThrow(/atleast a column called 'Tag 1'/);
  });

  it("rejects a single-column block", () => {
    expect(() => handleCsvData(["Tag 1", "Project Falcon", "Total"].join("\n"))).toThrow(
      /atleast 2 columns separated by tabs/,
    );
  });

  it("rejects a block without a data row (header + footer only)", () => {
    expect(() => handleCsvData(tsv([HEADER, TOTALS], { trailing: "\n" }))).toThrow(
      /at least 1 header row, 1 data row and 1 footer row/,
    );
  });

  it("rejects a data row with fewer columns than the header", () => {
    const short = ["Internal", "0:45:00"];

    expect(() => handleCsvData(tsv([HEADER, ROW_1, short, TOTALS]))).toThrow(
      /same number of tab-separated columns as the header \(6\), but entry 2 has 2/,
    );
  });

  it("rejects a data row with more columns than the header", () => {
    const long = [...ROW_2, "surplus"];

    expect(() => handleCsvData(tsv([HEADER, long, TOTALS]))).toThrow(/entry 1 has 7/);
  });

  it("names the first three mismatching rows and counts the rest", () => {
    const short = ["Internal", "0:45:00"];

    expect(() => handleCsvData(tsv([HEADER, short, short, short, short, TOTALS]))).toThrow(
      /entry 1 has 2, entry 2 has 2, entry 3 has 2 \(and 1 more\)/,
    );
  });

  it("points at a line break inside Notes as the likely cause", () => {
    // What a Notes value containing a line break actually looks like after the
    // paste: one entry split across two lines, both of the wrong width.
    const csv = [
      HEADER.join("\t"),
      "Project Falcon\tDid stuff",
      "and more\tBillable\t1:30:00\t0:00:00\t1:30:00",
      TOTALS.join("\t"),
    ].join("\n");

    expect(() => handleCsvData(csv)).toThrow(/line break inside a 'Notes' value/);
  });

  it("does not require the footer to have the header's width", () => {
    // The footer is display-only (no apply buttons), so a narrow totals row is
    // accepted rather than blocking the whole import.
    const { importFooter } = handleCsvData(tsv([HEADER, ROW_1, ["Total", "4:15:00"]]));

    expect(importFooter).toEqual(["Total", "4:15:00"]);
  });
});
