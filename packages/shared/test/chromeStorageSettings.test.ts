import { describe, expect, it } from "vitest";
import * as settings from "../chromeStorageSettings";

describe("chromeStorageSettings", () => {
  describe("loadApplyNotesSetting", () => {
    it("returns true when nothing is stored (default)", async () => {
      expect(await settings.loadApplyNotesSetting()).toBe(true);
    });

    it("round-trips a saved value", async () => {
      await settings.saveApplyNotesSetting(false);
      expect(await settings.loadApplyNotesSetting()).toBe(false);
    });

    it("writes under the 'applyNotesSetting' storage key", async () => {
      await settings.saveApplyNotesSetting(false);
      const raw = await chrome.storage.local.get("applyNotesSetting");
      expect(raw).toEqual({ applyNotesSetting: false });
    });
  });

  describe("loadRemovePopoversSetting", () => {
    it("returns false when nothing is stored (default)", async () => {
      expect(await settings.loadRemovePopoversSetting()).toBe(false);
    });

    it("round-trips a saved value", async () => {
      await settings.saveRemovePopoversSetting(true);
      expect(await settings.loadRemovePopoversSetting()).toBe(true);
    });

    it("writes under the 'removePopoversSetting' storage key", async () => {
      await settings.saveRemovePopoversSetting(true);
      const raw = await chrome.storage.local.get("removePopoversSetting");
      expect(raw).toEqual({ removePopoversSetting: true });
    });
  });

  describe("loadActiveTabId", () => {
    it("returns undefined when nothing is stored (default)", async () => {
      expect(await settings.loadActiveTabId()).toBeUndefined();
    });

    it("round-trips a saved value", async () => {
      await settings.saveActiveTabId("import");
      expect(await settings.loadActiveTabId()).toBe("import");
    });

    it("writes under the 'activeTabId' storage key", async () => {
      await settings.saveActiveTabId("import");
      const raw = await chrome.storage.local.get("activeTabId");
      expect(raw).toEqual({ activeTabId: "import" });
    });
  });
});
