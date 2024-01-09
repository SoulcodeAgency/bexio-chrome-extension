import {
  projectTableRows,
  projectTableTextCell,
  projectTableTextCellContent,
} from "../selectors/projectTable_TextCell";

async function convertPopoverToText() {
  // iterate over the rows, replacing the text cell content with the data-content attribute
  projectTableRows().forEach((row, index) => {
    if (projectTableTextCell(row)) {
      const content = projectTableTextCellContent(row);
      if (content) {
        const cell = projectTableTextCell(row);
        cell.innerHTML = content;
        cell.style.backgroundColor =
          index % 2 === 0 ? "antiquewhite" : "#ffe2bc";
      }
    }
  });
}

export default convertPopoverToText;
