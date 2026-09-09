/**
 * `TableCellTrackingDay` — the ▶️ apply button opens the bexio time tracking
 * form before it applies the entry.
 *
 * Regression: the navigation used to sit behind `productionEnv`
 * (`process.env.NODE_ENV === "production"`), a guard meant for the standalone
 * Vite dev server where `chrome.tabs` does not exist. It also matched a
 * *development build of the extension*, where `chrome.tabs` is very much there —
 * Rollup then const-folded the whole call away, so clicking ▶️ on
 * `monitoring/list` never navigated and died in sendToBexioTab's "no content
 * script" toast instead.
 *
 * What the guard must actually key on is the presence of `chrome.tabs`, so
 * these tests cover both builds of the extension and the dev server.
 *
 * The chrome.* APIs are the in-memory fake from test/support/chrome-fake.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import TableCellTrackingDay from "~/components/ImportEntries/TableCellTrackingDay";
import { BEXIO_MONITORING_TIMETRACKING } from "~/utils/openBexioTimeTrackingPage";
import { getChromeFake } from "../../../test/support/chrome-fake";

const tabs = () => getChromeFake().tabs;

const MONITORING_LIST = "https://office.bexio.com/index.php/monitoring/list";

/** `TableCellTrackingDay` renders a `<td>`, so it needs a table around it. */
function renderCell(onButtonClick: () => void) {
  return render(
    <table>
      <tbody>
        <tr>
          <TableCellTrackingDay
            fieldValue="1:30:00"
            entryStatus={false}
            onButtonClick={onButtonClick}
            onButtonClickReset={() => {}}
          />
        </tr>
      </tbody>
    </table>,
  );
}

async function clickApply() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "▶️" }));
  });
}

describe("TableCellTrackingDay — applying from a page other than the form", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("navigates the active tab to the time tracking form and only then applies", async () => {
    tabs().__queryResult = [{ id: 42, url: MONITORING_LIST }];
    const onButtonClick = vi.fn();
    renderCell(onButtonClick);

    await clickApply();

    expect(tabs().__updates).toEqual([{ tabId: 42, properties: { url: BEXIO_MONITORING_TIMETRACKING } }]);
    // The entry must not be applied while the form is still loading — that is
    // exactly the state in which no content script answers.
    expect(onButtonClick).not.toHaveBeenCalled();

    await act(async () => {
      tabs().__emitUpdated(42, { status: "complete" }, { id: 42, url: BEXIO_MONITORING_TIMETRACKING });
      // openBexioTimeTrackingPage's render grace period.
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(onButtonClick).toHaveBeenCalledTimes(1);
  });

  it("applies straight away when the active tab is already on the form", async () => {
    tabs().__queryResult = [{ id: 42, url: BEXIO_MONITORING_TIMETRACKING }];
    const onButtonClick = vi.fn();
    renderCell(onButtonClick);

    await clickApply();

    expect(tabs().__updates).toHaveLength(0);
    expect(onButtonClick).toHaveBeenCalledTimes(1);
  });
});

describe("TableCellTrackingDay — outside the extension", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("still applies when chrome.tabs is unavailable (standalone Vite dev server)", async () => {
    delete (globalThis.chrome as unknown as Record<string, unknown>).tabs;
    const onButtonClick = vi.fn();
    renderCell(onButtonClick);

    await clickApply();

    expect(onButtonClick).toHaveBeenCalledTimes(1);
  });
});
