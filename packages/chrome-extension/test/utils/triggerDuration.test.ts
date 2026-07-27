import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";

describe("triggerDuration", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
  });

  it("sets the duration field value and dispatches a keydown Enter event", async () => {
    loadFixture("monitoring-edit");
    // Must import selectors after fixture is loaded (module-load quirk)
    const { durationField } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/durationField");
    const { default: triggerDuration } = await import("@bexio-chrome-extension/chrome-extension/src/utils/triggerDuration");

    const onKeydown = vi.fn();
    durationField.addEventListener("keydown", onKeydown);

    await triggerDuration("01:30");

    expect(durationField.value).toBe("01:30");
    expect(onKeydown).toHaveBeenCalledTimes(1);
    const event = onKeydown.mock.calls[0][0] as KeyboardEvent;
    expect(event.type).toBe("keydown");
    // pressEnter is created with keyCode: 13
    expect(event.keyCode).toBe(13);
  });

  it("accepts an empty string (does not throw)", async () => {
    loadFixture("monitoring-edit");
    const { durationField } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/durationField");
    const { default: triggerDuration } = await import("@bexio-chrome-extension/chrome-extension/src/utils/triggerDuration");

    await expect(triggerDuration("")).resolves.toBeUndefined();
    expect(durationField.value).toBe("");
  });
});
