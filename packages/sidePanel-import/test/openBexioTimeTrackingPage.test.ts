/**
 * `openBexioTimeTrackingPage` — navigating the active tab to the bexio time
 * tracking form (issue #88).
 *
 * Pins: it waits for *the tab it navigated* (not any tab), it accepts only the
 * URLs the template content script is registered on, it gives up after
 * NAVIGATION_TIMEOUT_MS instead of hanging, and it never leaves a
 * `chrome.tabs.onUpdated` listener behind.
 *
 * The chrome.* APIs are the in-memory fake from test/support/chrome-fake.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import openBexioTimeTrackingPage, {
  BEXIO_MONITORING_TIMETRACKING,
  NAVIGATION_TIMEOUT_MS,
  isTimeTrackingPageUrl,
} from "~/utils/openBexioTimeTrackingPage";
import { getChromeFake } from "../../../test/support/chrome-fake";

const tabs = () => getChromeFake().tabs;
const listenerCount = () => tabs().onUpdated.__listeners.length;

/** Tracks settlement without letting a rejection escape as "unhandled". */
function track(promise: Promise<unknown>) {
  const state = { status: "pending" as "pending" | "resolved" | "rejected", error: undefined as unknown };
  promise.then(
    () => (state.status = "resolved"),
    (error) => {
      state.status = "rejected";
      state.error = error;
    },
  );
  return state;
}

describe("isTimeTrackingPageUrl", () => {
  it("matches exactly the manifest's content-script patterns", () => {
    expect(isTimeTrackingPageUrl(BEXIO_MONITORING_TIMETRACKING)).toBe(true);
    expect(isTimeTrackingPageUrl(`${BEXIO_MONITORING_TIMETRACKING}#anchor`)).toBe(true);
    expect(isTimeTrackingPageUrl(`${BEXIO_MONITORING_TIMETRACKING}/id/4711`)).toBe(true);
    expect(isTimeTrackingPageUrl(`${BEXIO_MONITORING_TIMETRACKING}/id/4711?foo=bar`)).toBe(true);

    expect(isTimeTrackingPageUrl(undefined)).toBe(false);
    expect(isTimeTrackingPageUrl("https://office.bexio.com/index.php/monitoring/list")).toBe(false);
    expect(isTimeTrackingPageUrl("https://office.bexio.com/index.php/login")).toBe(false);
    // Not a content-script match either (the plain pattern has no trailing `*`).
    expect(isTimeTrackingPageUrl(`${BEXIO_MONITORING_TIMETRACKING}Something`)).toBe(false);
  });
});

describe("openBexioTimeTrackingPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves immediately when the active tab is already on the form, without touching the tab", async () => {
    tabs().__queryResult = [{ id: 1, url: BEXIO_MONITORING_TIMETRACKING }];

    await expect(openBexioTimeTrackingPage()).resolves.toBe(true);

    expect(tabs().__updates).toHaveLength(0);
    expect(listenerCount()).toBe(0);
  });

  it("navigates the active tab and resolves once that tab has loaded the form", async () => {
    tabs().__queryResult = [{ id: 42, url: "https://office.bexio.com/index.php/monitoring/list" }];

    const state = track(openBexioTimeTrackingPage());
    await vi.advanceTimersByTimeAsync(0);

    expect(tabs().__updates).toEqual([{ tabId: 42, properties: { url: BEXIO_MONITORING_TIMETRACKING } }]);
    expect(listenerCount()).toBe(1);

    tabs().__emitUpdated(42, { status: "complete" }, { id: 42, url: BEXIO_MONITORING_TIMETRACKING });
    // The listener goes as soon as the event matched, before the render grace period.
    expect(listenerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(500);
    expect(state.status).toBe("resolved");
  });

  it("ignores load events of other tabs and of non-form URLs", async () => {
    tabs().__queryResult = [{ id: 42, url: "https://office.bexio.com/index.php/monitoring/list" }];

    const state = track(openBexioTimeTrackingPage());
    await vi.advanceTimersByTimeAsync(0);

    // Another tab reaching the form must not settle our promise…
    tabs().__emitUpdated(7, { status: "complete" }, { id: 7, url: BEXIO_MONITORING_TIMETRACKING });
    // …nor our tab reaching a different page (e.g. the login redirect)…
    tabs().__emitUpdated(42, { status: "complete" }, { id: 42, url: "https://office.bexio.com/index.php/login" });
    // …nor an intermediate, not-yet-complete event.
    tabs().__emitUpdated(42, { status: "loading" }, { id: 42, url: BEXIO_MONITORING_TIMETRACKING });

    await vi.advanceTimersByTimeAsync(500);
    expect(state.status).toBe("pending");
    expect(listenerCount()).toBe(1);

    tabs().__emitUpdated(42, { status: "complete" }, { id: 42, url: `${BEXIO_MONITORING_TIMETRACKING}/id/99` });
    await vi.advanceTimersByTimeAsync(500);
    expect(state.status).toBe("resolved");
    expect(listenerCount()).toBe(0);
  });

  it("rejects and removes the listener when the form never loads", async () => {
    tabs().__queryResult = [{ id: 42, url: "https://office.bexio.com/index.php/monitoring/list" }];

    const state = track(openBexioTimeTrackingPage());
    await vi.advanceTimersByTimeAsync(0);
    expect(listenerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(NAVIGATION_TIMEOUT_MS);

    expect(state.status).toBe("rejected");
    expect(String(state.error)).toContain("Timed out");
    expect(listenerCount()).toBe(0);
  });

  it("rejects without leaving a listener when the navigation itself fails", async () => {
    tabs().__queryResult = [{ id: 42, url: "https://office.bexio.com/index.php/monitoring/list" }];
    tabs().__updateError = new Error("tab closed");

    const state = track(openBexioTimeTrackingPage());
    await vi.advanceTimersByTimeAsync(0);

    expect(state.status).toBe("rejected");
    expect(String(state.error)).toContain("tab closed");
    expect(listenerCount()).toBe(0);
  });

  it("rejects when there is no tab to navigate", async () => {
    tabs().__queryResult = [];

    await expect(openBexioTimeTrackingPage()).rejects.toThrow("No tab found");
    expect(listenerCount()).toBe(0);
  });
});
