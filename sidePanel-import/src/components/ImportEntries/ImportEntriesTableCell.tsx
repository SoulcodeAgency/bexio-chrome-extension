type ImportEntriesTableCellProps = {
  columnHeader: string;
  fieldValue: string;
};
const ImportEntriesTableCell = (props: ImportEntriesTableCellProps) => {
  const dateRegex = /^\d{2}\.\d{2}\.\d{4}$/;
  const emptyDateRegex = /^0:00:00$/;
  const columnIsATrackingDay = dateRegex.test(props.columnHeader);
  const entryIsEmpty = emptyDateRegex.test(props.fieldValue);

  let tableCell = <td>{props.fieldValue}</td>;
  if (columnIsATrackingDay && !entryIsEmpty) {
    tableCell = (
      <td>
        {props.fieldValue}
        <button>▶️</button>
      </td>
    );
  } else if (entryIsEmpty) {
    tableCell = <td></td>;
  }
  return <>{tableCell}</>;
};

export default ImportEntriesTableCell;
