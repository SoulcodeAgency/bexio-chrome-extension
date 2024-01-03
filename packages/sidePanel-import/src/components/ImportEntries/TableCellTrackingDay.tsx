import { Button } from "antd";
import { productionEnv } from "~/utils/development";
import openBexioTimeTrackingPage from "~/utils/openBexioTimeTrackingPage";

type ImportEntriesTableCellProps = {
  fieldValue: string;
  entryStatus: boolean;
  onButtonClick: () => void;
  onButtonClickReset: () => void;
};

const TableCellTrackingDay = (props: ImportEntriesTableCellProps) => {
  const noTimeToBookRegex = /^(0.00|0:00:00)$/;
  const entryIsEmpty = noTimeToBookRegex.test(props.fieldValue);

  async function clickHandler() {
    productionEnv && (await openBexioTimeTrackingPage());
    props.onButtonClick();
  }

  // TODO: we could even save this state into a new store (using date and entryIndex)
  let button = <Button onClick={clickHandler}>▶️</Button>;
  if (props.entryStatus) {
    button = <Button onClick={() => props.onButtonClickReset()}>✅</Button>;
  }

  let tableCell = <td>{props.fieldValue}</td>;
  if (entryIsEmpty) {
    tableCell = <td></td>;
  } else {
    tableCell = (
      <td>
        {props.fieldValue}
        {button}
      </td>
    );
  }
  return <>{tableCell}</>;
};

export default TableCellTrackingDay;
