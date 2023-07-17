import { useState } from "react";

type ImportEntriesTableCellProps = {
  columnHeader: string;
  fieldValue: string;
  onButtonClick: () => void;
};
const ImportEntriesTableCell = (props: ImportEntriesTableCellProps) => {
  const dateRegex = /^\d{2}\.\d{2}\.\d{4}$/;
  const emptyDateRegex = /^0:00:00$/;
  const columnIsATrackingDay = dateRegex.test(props.columnHeader);
  const entryIsEmpty = emptyDateRegex.test(props.fieldValue);
  const [clicked, setClicked] = useState(false);

  function clickHandler() {
    props.onButtonClick();
    setClicked(true);
  }

  // TODO: we could even save this state into a new store (using date and entryIndex)
  let button = <button onClick={clickHandler}>▶️</button>;
  if (clicked) {
    button = <button onClick={() => setClicked(false)}>✅</button>;
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
