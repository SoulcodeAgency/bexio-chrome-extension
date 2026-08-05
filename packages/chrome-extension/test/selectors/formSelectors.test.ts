import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";

describe("form selectors (against monitoring-edit fixture)", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
  });

  it("selectors.ts resolves the select2 field ids and their inner inputs", async () => {
    loadFixture("monitoring-edit");
    const sel = await import("@bexio-chrome-extension/chrome-extension/src/selectors/selectors");
    expect(sel.workFieldID).toBe("#s2id_monitoring_client_service_id");
    expect(document.querySelector(sel.workFieldID)).not.toBeNull();
    expect(sel.workField).not.toBeNull(); // module-load query found `${workFieldID} input`
    expect(document.querySelector(sel.statusFieldID)).not.toBeNull();
    expect(document.querySelector(sel.projectFieldID)).not.toBeNull();
    expect(document.querySelector(sel.packageFieldID)).not.toBeNull();
    expect(document.querySelector(sel.contactPersonID)).not.toBeNull();
    expect(sel.loaderId).toBe("SoulcodeExtensionLoader");
  });

  it("billableCheckbox / contactField / dateField / durationField resolve to the right inputs", async () => {
    loadFixture("monitoring-edit");
    const { billableCheckbox } =
      await import("@bexio-chrome-extension/chrome-extension/src/selectors/billableCheckbox");
    const { contactField } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/contactField");
    const { dateField } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/dateField");
    const { durationField } = await import("@bexio-chrome-extension/chrome-extension/src/selectors/durationField");
    expect(billableCheckbox).toBeInstanceOf(HTMLInputElement);
    expect(billableCheckbox.type).toBe("checkbox");
    expect(contactField).toBeInstanceOf(HTMLInputElement);
    expect(dateField).toBeInstanceOf(HTMLInputElement);
    expect(durationField).toBeInstanceOf(HTMLInputElement);
  });

  it("getDescriptionField throws when the tinymce iframe document isn't populated", async () => {
    loadFixture("monitoring-edit"); // iframe element present, but jsdom won't have its inner #tinymce
    const { getDescriptionField } =
      await import("@bexio-chrome-extension/chrome-extension/src/selectors/descriptionField");
    expect(() => getDescriptionField()).toThrow("Description field not found");
    // The success path needs #tinymce injected into the iframe's contentDocument by hand
    // (`loadIframeFixture` in ../support/load-fixture); it is covered in
    // ../utils/triggerDescription.test.ts.
  });
});
