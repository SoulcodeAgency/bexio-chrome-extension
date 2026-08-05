import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";

describe("triggerContactField", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // The empty-value guard (#82). Without it, an empty query never opens .ac_results,
  // so waitForContacts (no timeout) polls forever and the loader overlay stays up.
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["an empty string", ""],
    ["a whitespace-only string", "   "],
  ])("returns immediately without touching the DOM when value is %s", async (_label, value) => {
    loadFixture("monitoring-edit");
    const { contactField } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/contactField");
    const { default: triggerContactField } =
      await import("@bexio-chrome-extension/chrome-extension/src/utils/triggerContactField");

    const before = contactField.value;
    const onClick = vi.fn();
    const onKeydown = vi.fn();
    contactField.addEventListener("click", onClick);
    contactField.addEventListener("keydown", onKeydown);

    // No .ac_results is injected on purpose: if the guard were missing this would hang.
    const p = triggerContactField(contactField, value);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();

    expect(contactField.value).toBe(before);
    expect(onClick).not.toHaveBeenCalled();
    expect(onKeydown).not.toHaveBeenCalled();
  });

  it("sets contactField.value to the requested string", async () => {
    loadFixture("monitoring-edit");
    const { contactField } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/contactField");
    const { default: triggerContactField } =
      await import("@bexio-chrome-extension/chrome-extension/src/utils/triggerContactField");

    // Inject visible .ac_results so waitForContacts resolves on first poll
    const acResults = document.createElement("ul");
    acResults.className = "ac_results";
    acResults.style.display = "block";
    document.body.appendChild(acResults);

    const p = triggerContactField(contactField, "Acme AG");

    // Let waitForContacts resolve (first poll)
    await vi.advanceTimersByTimeAsync(0);
    // Then delay(1000) fires
    await vi.advanceTimersByTimeAsync(1000);
    await p;

    expect(contactField.value).toBe("Acme AG");
  });

  it("clicks the contactField three times (to trigger the autocomplete)", async () => {
    loadFixture("monitoring-edit");
    const { contactField } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/contactField");
    const { default: triggerContactField } =
      await import("@bexio-chrome-extension/chrome-extension/src/utils/triggerContactField");

    const onClick = vi.fn();
    contactField.addEventListener("click", onClick);

    // Inject visible .ac_results so waitForContacts resolves
    const acResults = document.createElement("ul");
    acResults.className = "ac_results";
    acResults.style.display = "block";
    document.body.appendChild(acResults);

    const p = triggerContactField(contactField, "Acme AG");
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    await p;

    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("dispatches a keydown Enter event on contactField after waitForContacts resolves", async () => {
    loadFixture("monitoring-edit");
    const { contactField } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/contactField");
    const { default: triggerContactField } =
      await import("@bexio-chrome-extension/chrome-extension/src/utils/triggerContactField");

    const onKeydown = vi.fn();
    contactField.addEventListener("keydown", onKeydown);

    // Inject visible .ac_results so waitForContacts resolves
    const acResults = document.createElement("ul");
    acResults.className = "ac_results";
    acResults.style.display = "block";
    document.body.appendChild(acResults);

    const p = triggerContactField(contactField, "Acme AG");
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    await p;

    expect(onKeydown).toHaveBeenCalledTimes(1);
    const event = onKeydown.mock.calls[0][0] as KeyboardEvent;
    expect(event.type).toBe("keydown");
    expect(event.keyCode).toBe(13);
  });

  it("waits ~1000ms after pressing Enter (the delay() call at the end)", async () => {
    loadFixture("monitoring-edit");
    const { contactField } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/contactField");
    const { default: triggerContactField } =
      await import("@bexio-chrome-extension/chrome-extension/src/utils/triggerContactField");

    // Inject visible .ac_results so waitForContacts resolves
    const acResults = document.createElement("ul");
    acResults.className = "ac_results";
    acResults.style.display = "block";
    document.body.appendChild(acResults);

    let done = false;
    const p = triggerContactField(contactField, "Acme AG").then(() => {
      done = true;
    });

    // After waitForContacts resolves (0ms advance) + pressEnter fires synchronously,
    // the delay(1000) is pending.
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(false); // delay not elapsed yet

    await vi.advanceTimersByTimeAsync(999);
    expect(done).toBe(false); // still not done

    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(done).toBe(true);
  });

  it("rejects with a WaitForTimeoutError when .ac_results never appears (#83)", async () => {
    // If bexio's autocomplete never produces .ac_results (AJAX failure, offline, no
    // matching contact), waitForContacts gives up instead of stalling forever, so
    // fillForm's finally can hide the loader overlay.
    loadFixture("monitoring-edit");
    const { contactField } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/contactField");
    const { default: triggerContactField } =
      await import("@bexio-chrome-extension/chrome-extension/src/utils/triggerContactField");
    const { WaitForTimeoutError, POLL_TIMEOUT_MS } =
      await import("@bexio-chrome-extension/chrome-extension/src/utils/pollUntil");

    let error: unknown;
    // Do NOT inject .ac_results
    const p = triggerContactField(contactField, "Acme AG").catch((e: unknown) => {
      error = e;
    });

    await vi.advanceTimersByTimeAsync(POLL_TIMEOUT_MS - 1000);
    expect(error).toBeUndefined(); // still polling

    await vi.advanceTimersByTimeAsync(2000);
    await p;
    expect(error).toBeInstanceOf(WaitForTimeoutError);
  });
});
