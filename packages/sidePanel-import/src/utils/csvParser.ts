export function handleCsvData(csvString: string) {
  const rows = normalizeRows(csvString);
  // `rows` can be empty (e.g. the user cleared the textarea); fall back to an
  // empty line so the header/footer split below never touches `undefined`.
  const importHeader = (rows[0] ?? "").split("\t");
  const importFooter = (rows[rows.length - 1] ?? "").split("\t");
  const importData = rows.slice(1, -1).map((row: string) => row.split("\t"));

  validateData(rows, importHeader, importData);
  return { importFooter, importHeader, importData };
}

/**
 * Split the pasted clipboard block into non-empty lines.
 *
 * ManicTime's clipboard export uses CRLF line endings and usually ends with a
 * trailing newline. Both are normalized here — once, for the whole block — so
 * the header, the data rows and the footer are all treated identically. Without
 * the `trimEnd()` the trailing newline would make the *totals* row the last
 * data row instead of the footer, which renders it as a normal, applyable entry
 * (one click would book the day's total time into bexio).
 */
function normalizeRows(csvString: string): string[] {
  return csvString
    .replace(/\r/g, "")
    .trimEnd()
    .split("\n")
    .filter((row: string) => row.trim() !== "");
}

function validateData(rows: string[], importHeader: string[], importData: string[][]) {
  if (importHeader.find((column) => column === "Tag 1") === undefined) {
    const errorMessage =
      "The data could not be parsed correctly. Make sure you have atleast a column called 'Tag 1'";
    throw new Error(errorMessage);
  } else if (importHeader.length < 2) {
    const errorMessage =
      "The data could not be parsed correctly. Make sure you have atleast 2 columns separated by tabs";
    throw new Error(errorMessage);
  } else if (rows.length < 3) {
    const errorMessage =
      "We need at least 1 header row, 1 data row and 1 footer row (can be dummy).";
    throw new Error(errorMessage);
  }
  validateRowWidths(importHeader, importData);
  // TODO: add further checks to report errors with hints how to solve them
}

/**
 * Every data row must have exactly as many columns as the header.
 *
 * A row of a different width means the columns no longer line up with the
 * header, so the date columns (and with them the ▶️ apply buttons) would book
 * the wrong duration under the wrong date. The usual cause is a line break
 * inside a Notes value, which splits one entry across two lines — the import
 * description warns about this, and this check is what makes it visible instead
 * of silently applying misaligned data.
 */
function validateRowWidths(importHeader: string[], importData: string[][]) {
  const mismatches = importData
    .map((row, rowIndex) => ({ entry: rowIndex + 1, columns: row.length }))
    .filter((row) => row.columns !== importHeader.length);
  if (mismatches.length === 0) return;

  const details = mismatches
    .slice(0, 3)
    .map((row) => `entry ${row.entry} has ${row.columns}`)
    .join(", ");
  const more = mismatches.length > 3 ? ` (and ${mismatches.length - 3} more)` : "";
  const errorMessage =
    "The data could not be parsed correctly. Every row must have the same number of tab-separated columns " +
    `as the header (${importHeader.length}), but ${details}${more}. ` +
    `A line break inside a 'Notes' value is the usual cause — remove it and paste again.`;
  throw new Error(errorMessage);
}
