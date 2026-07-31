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
    await vi.advanceTimersByTimeAsync(2000); // let the removal poll fire (interval = 250ms)

    await p;

    expect(inputEl.value).toBe("In Arbeit");
    expect(onKeydown).toHaveBeenCalledTimes(1);
    expect(onKeydown.mock.calls[0][0].keyCode).toBe(13);
    expect(searchKeydown).toHaveBeenCalledTimes(1);
    expect(searchInput.value).toBe("In Arbeit");
  });

  /** Injects the shared select2 drop and returns it plus its search input and a keydown spy. */
  function injectSearchBoxDrop() {
    const drop = document.createElement("div");
    drop.id = "select2-drop";
    const searchInput = document.createElement("input");
    drop.appendChild(searchInput);
    const searchKeydown = vi.fn();
    searchInput.addEventListener("keydown", searchKeydown);
    document.body.appendChild(drop);
    return { drop, searchInput, searchKeydown };
  }

  /** Replaces the Arbeitspaket select's options with `texts` (plus the empty placeholder). */
  function setPackageOptions(...texts: string[]) {
    const select = document.querySelector("#monitoring_pr_package_id") as HTMLSelectElement;
    select.innerHTML = "";
    for (const [index, text] of ["", ...texts].entries()) {
      const option = document.createElement("option");
      option.value = String(index);
      option.text = text;
      select.appendChild(option);
    }
  }

  it("waits for the AJAX repopulation instead of searching the previous template's options (#84)", async () => {
    // Template A was applied first, so the dependent Arbeitspaket select still holds
    // its options. Searching that stale list would either find nothing (hanging in
    // waitForSearchBoxFieldToBeRemoved) or pick a wrong package.
    loadFixture("monitoring-edit");
    const { packageFieldID } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/selectors");
    const { default: triggerField } = await import("@bexio-chrome-extension/chrome-extension/src/utils/triggerField");

    setPackageOptions("Package Alpha"); // template A's list
    const inputEl = document.querySelector(`${packageFieldID} input`) as HTMLInputElement;
    const onKeydown = vi.fn();
    inputEl.addEventListener("keydown", onKeydown);
    const { drop, searchInput, searchKeydown } = injectSearchBoxDrop();

    // Now template B is applied
    const p = triggerField(packageFieldID, "Package Beta");
    await vi.advanceTimersByTimeAsync(2000);

    // Nothing has been searched yet — the stale list does not contain the value.
    expect(inputEl.value).toBe("");
    expect(onKeydown).not.toHaveBeenCalled();
    expect(searchKeydown).not.toHaveBeenCalled();

    // The AJAX response for template B's project lands
    setPackageOptions("Package Beta", "Package Gamma");
    await vi.advanceTimersByTimeAsync(1000); // poll sees the fresh list → the search runs
    drop.remove();
    await vi.advanceTimersByTimeAsync(2000); // waitForSearchBoxFieldToBeRemoved

    await p;

    expect(inputEl.value).toBe("Package Beta");
    expect(searchInput.value).toBe("Package Beta");
    expect(searchKeydown).toHaveBeenCalledTimes(1);
  });

  it("still runs the search when the value never appears among the options (bounded wait, no hang)", async () => {
    // The value is genuinely gone (deleted package): after the bounded wait the
    // helper degrades to the old behaviour rather than polling forever.
    loadFixture("monitoring-edit");
    const { packageFieldID } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/selectors");
    const { default: triggerField } = await import("@bexio-chrome-extension/chrome-extension/src/utils/triggerField");

    setPackageOptions("Package Alpha");
    const inputEl = document.querySelector(`${packageFieldID} input`) as HTMLInputElement;
    const { drop, searchInput } = injectSearchBoxDrop();

    const p = triggerField(packageFieldID, "Deleted Package");
    // The 5000ms value budget elapses → the wait resolves anyway
    await vi.advanceTimersByTimeAsync(5000);
    drop.remove();
    await vi.advanceTimersByTimeAsync(2000);

    await p;

    expect(inputEl.value).toBe("Deleted Package");
    expect(searchInput.value).toBe("Deleted Package");
  });
});
