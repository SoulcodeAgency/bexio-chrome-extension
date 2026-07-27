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

  it("sets contactField.value to the requested string", async () => {
    loadFixture("monitoring-edit");
    const { contactField } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/contactField");
    const { default: triggerContactField } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/triggerContactField"
    );

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
    const { default: triggerContactField } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/triggerContactField"
    );

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
    const { default: triggerContactField } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/triggerContactField"
    );

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
    const { default: triggerContactField } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/triggerContactField"
    );

    // Inject visible .ac_results so waitForContacts resolves
    const acResults = document.createElement("ul");
    acResults.className = "ac_results";
    acResults.style.display = "block";
    document.body.appendChild(acResults);

    let done = false;
    const p = triggerContactField(contactField, "Acme AG").then(() => { done = true; });

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

  it("hangs on waitForContacts when .ac_results never appears — no timeout mechanism", async () => {
    // This pins the known behavior: triggerContactField has no timeout, so if bexio's
    // autocomplete never produces .ac_results, the extension will stall indefinitely.
    // KNOWN ISSUE: triggerContactField (and waitForContacts) have no timeout — they wait forever
    // if the autocomplete results never appear.
    loadFixture("monitoring-edit");
    const { contactField } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/contactField");
    const { default: triggerContactField } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/triggerContactField"
    );

    let done = false;
    // Do NOT inject .ac_results — waitForContacts will poll forever
    triggerContactField(contactField, "Acme AG").then(() => { done = true; });

    await vi.advanceTimersByTimeAsync(10_000);
    expect(done).toBe(false); // still waiting — no timeout

    // Cleanup: inject .ac_results so the polling loop terminates
    const acResults = document.createElement("ul");
    acResults.className = "ac_results";
    acResults.style.display = "block";
    document.body.appendChild(acResults);
    await vi.advanceTimersByTimeAsync(2000);
  });
});
