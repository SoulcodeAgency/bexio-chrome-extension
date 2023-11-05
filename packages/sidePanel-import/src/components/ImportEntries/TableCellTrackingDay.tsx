import { Button } from "antd";
import { useState } from "react";
import { productionEnv } from "~/utils/development";
import openBexioTimeTrackingPage from "~/utils/openBexioTimeTrackingPage";

type ImportEntriesTableCellProps = {
  fieldValue: string;
  onButtonClick: () => void;
};

const TableCellTrackingDay = (props: ImportEntriesTableCellProps) => {
  const noTimeToBookRegex = /^(0.00|0:00:00)$/;
  const entryIsEmpty = noTimeToBookRegex.test(props.fieldValue);
  const [clicked, setClicked] = useState(false);

  async function clickHandler() {
    productionEnv && (await openBexioTimeTrackingPage());
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
