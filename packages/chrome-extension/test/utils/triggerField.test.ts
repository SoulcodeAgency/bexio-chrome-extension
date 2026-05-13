import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";

describe("triggerField", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns immediately without touching the DOM when value is null", async () => {
    loadFixture("monitoring-edit");
    const { statusFieldID } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/selectors");
    const { default: triggerField } = await import("@bexio-chrome-extension/chrome-extension/src/utils/triggerField");

    const inputEl = document.querySelector(`${statusFieldID} input`) as HTMLInputElement;
    const onKeydown = vi.fn();
    inputEl.addEventListener("keydown", onKeydown);

    // null → early return, no DOM interaction
    const p = triggerField(statusFieldID, null);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();
    expect(onKeydown).not.toHaveBeenCalled();
  });

  it("returns immediately without touching the DOM when value is empty string", async () => {
    loadFixture("monitoring-edit");
    const { statusFieldID } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/selectors");
    const { default: triggerField } = await import("@bexio-chrome-extension/chrome-extension/src/utils/triggerField");

    const inputEl = document.querySelector(`${statusFieldID} input`) as HTMLInputElement;
    const onKeydown = vi.fn();
    inputEl.addEventListener("keydown", onKeydown);

    const p = triggerField(statusFieldID, "");
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();
    expect(onKeydown).not.toHaveBeenCalled();
  });

  it("for a field with preloaded select options: sets input value and dispatches pressEnter on both the field input and the search box", async () => {
    loadFixture("monitoring-edit");
    // statusFieldID select already has 6 options in fixture → waitForSelectOptions resolves immediately
    const { statusFieldID } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/selectors");
    const { default: triggerField } = await import("@bexio-chrome-extension/chrome-extension/src/utils/triggerField");

    const inputEl = document.querySelector(`${statusFieldID} input`) as HTMLInputElement;
    const onKeydown = vi.fn();
    inputEl.addEventListener("keydown", onKeydown);

    // Flow: waitForSelectOptions (resolves immediately: 6 options) → set value + pressEnter on inputEl
    //   → waitForSearchBoxField (needs #select2-drop input)
    //   → pressEnter on searchBox → waitForSearchBoxFieldToBeRemoved (needs #select2-drop input gone)
    //
    // Strategy: use a timer callback to inject #select2-drop after the first batch of microtasks
    // resolves, then remove it after the next batch. We do this by observing side-effects via the
    // keydown spy and manually toggling DOM state between advanceByTime ticks.

    // Prepare the search-box drop — inject it immediately so waitForSearchBoxField finds it on first poll
    const drop = document.createElement("div");
    drop.id = "select2-drop";
    const searchInput = document.createElement("input");
    drop.appendChild(searchInput);
    const searchKeydown = vi.fn();
    searchInput.addEventListener("keydown", searchKeydown);
    document.body.appendChild(drop);

    const p = triggerField(statusFieldID, "In Arbeit");

    // Advance enough for: waitForSelectOptions (already resolved synchronously since options > 1),
    // then the microtasks that set inputEl.value + dispatch pressEnter + start waitForSearchBoxField,
    // then waitForSearchBoxField (drop is present → resolves immediately on first check).
    await vi.advanceTimersByTimeAsync(0);
    // At this point waitForSearchBoxField found the drop and pressEnter fired on searchInput.
    // Now waitForSearchBoxFieldToBeRemoved is running — it sees the drop and schedules another timer.
    // Remove the drop so the next poll resolves.
    drop.remove();
    await vi.advanceTimersByTimeAsync(2000); // let the removal poll fire (interval = 1000ms)

    await p;

    expect(inputEl.value).toBe("In Arbeit");
    expect(onKeydown).toHaveBeenCalledTimes(1);
    expect(onKeydown.mock.calls[0][0].keyCode).toBe(13);
    expect(searchKeydown).toHaveBeenCalledTimes(1);
    expect(searchInput.value).toBe("In Arbeit");
  });
});
