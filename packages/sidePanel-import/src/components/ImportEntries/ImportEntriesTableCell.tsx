import { Button } from "antd";
import { useState } from "react";
import openBexioTimeTrackingPage from "~/utils/openBexioTimeTrackingPage";

type ImportEntriesTableCellProps = {
  columnHeader: string;
  fieldValue: string;
  onButtonClick: () => void;
};
const ImportEntriesTableCell = (props: ImportEntriesTableCellProps) => {
  const dateRegex = /^\d{2}[./]\d{2}[./]\d{4}$/;
  const noTimeToBookRegex = /^(0.00|0:00:00)$/;
  const columnIsATrackingDay = dateRegex.test(props.columnHeader);
  const entryIsEmpty = noTimeToBookRegex.test(props.fieldValue);
  const [clicked, setClicked] = useState(false);

  async function clickHandler() {
    await openBexioTimeTrackingPage();
    props.onButtonClick();
    // Change button state to clicked, so we have a visual feedback
    setClicked(true);
  }

  // TODO: we could even save this state into a new store (using date and entryIndex)
  let button = <Button onClick={clickHandler}>▶️</Button>;
  if (clicked) {
    button = <Button onClick={() => setClicked(false)}>✅</Button>;
  }

  let tableCell = <td>{props.fieldValue}</td>;
  if (columnIsATrackingDay && !entryIsEmpty) {
    tableCell = (
      <td>
        {props.fieldValue}
        {button}
      </td>
    );
  } else if (entryIsEmpty) {
    tableCell = <td></td>;
  }
  return <>{tableCell}</>;
};

export default ImportEntriesTableCell;
