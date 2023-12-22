export function handleCsvData(csvString: string) {
  const rows = csvString.split("\n");
  const importHeader = rows[0].split("\t");
  const importFooter = rows[rows.length - 1].split("\t");
  const importData = rows
    .slice(1)
    .slice(0, -1)
    .map((row) => row.replace(/\r/g, ""))
    .map((row: string) => row.split("\t"));

  validateData(rows, importHeader);
  return { importFooter, importHeader, importData };
}

function validateData(rows: string[], importHeader: string[]) {
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
  // TODO: add further checks to report errors with hints how to solve them
}
