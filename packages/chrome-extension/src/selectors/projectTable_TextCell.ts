const textCellColumn = 5;
const projectTableId = "#dataTable";
export const projectTableRows = () =>
  document.querySelector(projectTableId).querySelectorAll("tr");
export const projectTableTextCell = (row: HTMLTableRowElement) =>
  row.querySelectorAll("td")[textCellColumn];
export const projectTableTextCellContent = (row: HTMLTableRowElement) =>
  projectTableTextCell(row)
    ?.querySelectorAll("i")[0]
    ?.getAttribute("data-content")
    .trim();
