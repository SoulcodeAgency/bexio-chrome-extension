import TableCellTrackingDay from "./TableCellTrackingDay";
import TableCellBillable from "./TableCellBillable";

type ImportEntriesTableCellProps = {
  templateId: string;
  columnHeader: string;
  fieldValue: string;
  onButtonClick: () => void;
};
const ImportEntriesTableCell = (props: ImportEntriesTableCellProps) => {
  const dateRegex = /^\d{2}[./]\d{2}[./]\d{4}$/;
  const columnIsATrackingDay = dateRegex.test(props.columnHeader);
  const columnIsBillable = props.columnHeader === "Billable";

  if (columnIsATrackingDay) {
    return (
      <TableCellTrackingDay
        fieldValue={props.fieldValue}
        onButtonClick={props.onButtonClick}
      />
    );
  } else if (columnIsBillable) {
    return (
      <TableCellBillable
        templateId={props.templateId}
        fieldValue={props.fieldValue}
      />
    );
  } else {
    return <td>{props.fieldValue}</td>;
  }
};

export default ImportEntriesTableCell;
