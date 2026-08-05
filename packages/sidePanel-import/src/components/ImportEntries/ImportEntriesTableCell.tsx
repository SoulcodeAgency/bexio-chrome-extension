import TableCellTrackingDay from "./TableCellTrackingDay";
import TableCellBillable from "./TableCellBillable";
import { DATE_COLUMN_REGEX, FrozenColumn, frozenCellProps } from "./frozenColumns";

type ImportEntriesTableCellProps = {
  templateId: string;
  columnHeader: string;
  fieldValue: string;
  entryStatus: boolean;
  onButtonClick: () => void;
  onButtonClickReset: () => void;
  /** Set when this column is part of the frozen leading block; tracking days never are. */
  frozenColumn?: FrozenColumn;
};
const ImportEntriesTableCell = (props: ImportEntriesTableCellProps) => {
  const columnIsATrackingDay = DATE_COLUMN_REGEX.test(props.columnHeader);
  const columnIsBillable = props.columnHeader === "Billable";

  if (columnIsATrackingDay) {
    return (
      <TableCellTrackingDay
        fieldValue={props.fieldValue}
        entryStatus={props.entryStatus}
        onButtonClick={props.onButtonClick}
        onButtonClickReset={props.onButtonClickReset}
      />
    );
  } else if (columnIsBillable) {
    return (
      <TableCellBillable
        templateId={props.templateId}
        fieldValue={props.fieldValue}
        frozenColumn={props.frozenColumn}
      />
    );
  } else {
    // Frozen cells are clipped to their fixed width, so keep the full value reachable.
    return (
      <td {...frozenCellProps(props.frozenColumn)} title={props.frozenColumn ? props.fieldValue : undefined}>
        {props.fieldValue}
      </td>
    );
  }
};

export default ImportEntriesTableCell;
