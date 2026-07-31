import { Button, message } from "antd";
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
    if (productionEnv) {
      try {
        await openBexioTimeTrackingPage();
      } catch (error) {
        // Without a tab to navigate there is nothing to apply the entry to — say so instead of
        // dying in an unhandled rejection.
        console.warn("Could not open the bexio time-tracking page:", error);
        message.error("Could not open the bexio time-tracking page. Open it manually and try again.");
        return;
      }
    }
    props.onButtonClick();
  }

  let button = <Button onClick={clickHandler}>▶️</Button>;
  if (props.entryStatus) {
    button = <Button onClick={() => props.onButtonClickReset()}>✅</Button>;
  }

  let tableCell = <td></td>;
  if (!entryIsEmpty) {
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
