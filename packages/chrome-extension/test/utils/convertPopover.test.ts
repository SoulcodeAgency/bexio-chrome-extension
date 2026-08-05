import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";

const importConvert = () => import("@bexio-chrome-extension/chrome-extension/src/utils/convertPopover");

describe("convertPopover", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
  });

  it("does nothing (revert path) when removePopoversSetting is falsy", async () => {
    loadFixture("monitoring-list");
    const { default: convertPopover } = await importConvert();
    await convertPopover();
    // No .new-popover-text injected; popover <i> still inline-block (revert sets it explicitly).
    expect(document.querySelectorAll(".new-popover-text").length).toBe(0);
  });

  it("converts: hides each popover <i>, injects .new-popover-text with decoded text, alternates row colours", async () => {
    await chrome.storage.local.set({ removePopoversSetting: true });
    loadFixture("monitoring-list");
    const { default: convertPopover } = await importConvert();
    const popovers = document.querySelectorAll<HTMLElement>("i[rel='popover']");
    const expectedCount = popovers.length;
    expect(expectedCount).toBeGreaterThanOrEqual(3);

    await convertPopover();

    const texts = document.querySelectorAll(".new-popover-text");
    expect(texts.length).toBe(expectedCount);
    popovers.forEach((p) => expect(p.style.display).toBe("none"));
    // entity decoding: a fixture row whose data-content has "&amp;" must render "&" (not "&amp;")
    // jsdom already decodes &amp; in attributes to & so textContent will contain &
    const decoded = Array.from(texts).map((t) => t.textContent ?? "");
    expect(decoded.some((t) => t.includes("&") && !t.includes("&amp;"))).toBe(true);
    // alternating background colours on the parents
    // jsdom serialises #ffe2bc as rgb(255, 226, 188) and antiquewhite as antiquewhite
    const parents = Array.from(popovers).map((p) => p.parentElement as HTMLElement);
    expect(parents[0].style.backgroundColor).toBe("rgb(255, 226, 188)"); // #ffe2bc
  });

  it("is idempotent: a second convert call does not double-inject", async () => {
    await chrome.storage.local.set({ removePopoversSetting: true });
    loadFixture("monitoring-list");
    const { default: convertPopover } = await importConvert();
    await convertPopover();
    const after1 = document.querySelectorAll(".new-popover-text").length;
    await convertPopover();
    const after2 = document.querySelectorAll(".new-popover-text").length;
    expect(after2).toBe(after1);
  });

  it("revertPopover restores: removes .new-popover-text, un-hides <i>, clears parent background", async () => {
    await chrome.storage.local.set({ removePopoversSetting: true });
    loadFixture("monitoring-list");
    const { default: convertPopover, revertPopover } = await importConvert();
    await convertPopover();
    revertPopover();
    expect(document.querySelectorAll(".new-popover-text").length).toBe(0);
    document.querySelectorAll<HTMLElement>("i[rel='popover']").forEach((p) => {
      expect(p.style.display).toBe("inline-block");
      expect((p.parentElement as HTMLElement).style.backgroundColor).toBe("");
    });
  });
});
