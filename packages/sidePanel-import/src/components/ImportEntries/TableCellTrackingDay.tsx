import { Button } from "antd";
import openBexioTimeTrackingPage from "~/utils/openBexioTimeTrackingPage";
import { getMessageApi } from "~/utils/messageApi";

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
    // Not gated on the build mode: a development build of the extension has to navigate
    // just like the production one. `openBexioTimeTrackingPage` itself is the one that
    // knows when there is no tab to navigate (the standalone Vite dev server).
    try {
      await openBexioTimeTrackingPage();
    } catch (error) {
      // Navigation failed (no tab, expired session redirect, timeout). Do not apply the
      // entry — the content script is not on that page — and say so instead of dying in
      // an unhandled rejection.
      console.warn("Could not open the bexio time-tracking page:", error);
      getMessageApi().error("Could not open the bexio time-tracking page. Open it manually and try again.");
      return;
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
