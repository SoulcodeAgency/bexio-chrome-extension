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
  // Remove double zeroes from the time string
  const simplifiedZeroes = props.fieldValue.replace(/00/g, "0");
  const noTimeToBookRegex = /^(0.0|0:0|0:0:0)$/;
  const entryIsEmpty = noTimeToBookRegex.test(simplifiedZeroes);

  async function clickHandler() {
    productionEnv && (await openBexioTimeTrackingPage());
    props.onButtonClick();
  }

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
