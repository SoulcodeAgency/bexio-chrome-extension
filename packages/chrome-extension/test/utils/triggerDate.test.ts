import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";

describe("triggerDate", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
    // triggerDate is async but only awaits nothing time-sensitive in this function;
    // it dispatches pressEnter (a KeyboardEvent), no delay() call. No fake timers needed.
  });

  it("sets the date field value and dispatches a keydown Enter event", async () => {
    loadFixture("monitoring-edit");
    // Must import selectors after fixture is loaded (module-load quirk)
    const { dateField } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/dateField");
    const { default: triggerDate } = await import("@bexio-chrome-extension/chrome-extension/src/utils/triggerDate");

    const onKeydown = vi.fn();
    dateField.addEventListener("keydown", onKeydown);

    await triggerDate("20.05.2026");

    expect(dateField.value).toBe("20.05.2026");
    expect(onKeydown).toHaveBeenCalledTimes(1);
    const event = onKeydown.mock.calls[0][0] as KeyboardEvent;
    expect(event.type).toBe("keydown");
    // pressEnter is created with keyCode: 13 (deprecated but still set)
    expect(event.keyCode).toBe(13);
  });

  it("overwrites the pre-filled date in the fixture", async () => {
    loadFixture("monitoring-edit"); // fixture has value "13.05.2026"
    const { dateField } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/dateField");
    const { default: triggerDate } = await import("@bexio-chrome-extension/chrome-extension/src/utils/triggerDate");

    expect(dateField.value).toBe("13.05.2026");
    await triggerDate("01.01.2025");
    expect(dateField.value).toBe("01.01.2025");
  });
});
