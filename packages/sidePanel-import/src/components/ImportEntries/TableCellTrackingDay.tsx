import { Button } from "antd";
import openBexioTimeTrackingPage from "~/utils/openBexioTimeTrackingPage";
import { getMessageApi } from "~/utils/messageApi";

type ImportEntriesTableCellProps = {
  fieldValue: string;
  /** Booked in bexio (persisted) — shown as ✅, a click resets it. */
  entryStatus: boolean;
  /** Filled into the open bexio form, waiting for the user's deliberate 📤 click. */
  readyToSubmit: boolean;
  onButtonClick: () => void;
  onButtonClickReset: () => void;
  onButtonClickSubmit: () => void;
};

/**
 * The per-day cell with its three button states:
 *
 * - ▶️ apply — fills the bexio form with this entry (and its template).
 * - 📤 submit — the form holds this entry; a second, deliberate click saves it in bexio. Never
 *   triggered automatically. Only the entry applied last can be in this state.
 * - ✅ booked — the content script reported that the form was submitted; a click resets the
 *   entry to ▶️.
 */
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
  } else if (props.readyToSubmit) {
    button = (
      <Button onClick={() => props.onButtonClickSubmit()} title="Save this entry in bexio">
        📤
      </Button>
    );
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
