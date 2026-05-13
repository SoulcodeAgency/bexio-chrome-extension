import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";

describe("triggerCheckbox", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
  });

  it("sets a checkbox to checked when value is true — does NOT fire a change event", async () => {
    loadFixture("monitoring-edit");
    const { billableCheckbox } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/billableCheckbox");
    const { default: triggerCheckbox } = await import("@bexio-chrome-extension/chrome-extension/src/utils/triggerCheckbox");
    const onChange = vi.fn();
    billableCheckbox.addEventListener("change", onChange);
    expect(billableCheckbox.checked).toBe(false);
    await triggerCheckbox(billableCheckbox, true);
    expect(billableCheckbox.checked).toBe(true);
    // KNOWN ISSUE: triggerCheckbox does not dispatch a change event — only sets .checked directly
    expect(onChange).not.toHaveBeenCalled();
  });

  it("unchecks when value is false", async () => {
    loadFixture("monitoring-edit");
    const { billableCheckbox } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/billableCheckbox");
    const { default: triggerCheckbox } = await import("@bexio-chrome-extension/chrome-extension/src/utils/triggerCheckbox");
    billableCheckbox.checked = true;
    await triggerCheckbox(billableCheckbox, false);
    expect(billableCheckbox.checked).toBe(false);
  });

  it("does not change state when called without a boolean (undefined)", async () => {
    loadFixture("monitoring-edit");
    const { billableCheckbox } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/billableCheckbox");
    const { default: triggerCheckbox } = await import("@bexio-chrome-extension/chrome-extension/src/utils/triggerCheckbox");
    billableCheckbox.checked = false;
    await triggerCheckbox(billableCheckbox, undefined);
    expect(billableCheckbox.checked).toBe(false);
  });
});
