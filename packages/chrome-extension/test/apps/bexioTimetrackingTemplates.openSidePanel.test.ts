import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";

vi.mock("@bexio-chrome-extension/chrome-extension/src/apps/bexioTimetrackingTemplates/index", () => ({
  initializeExtension: vi.fn(async () => {}),
}));
vi.mock("@bexio-chrome-extension/chrome-extension/src/utils/fillForm", () => ({ default: vi.fn(async () => {}) }));

const render = async () => {
  const { default: renderHtml } =
    await import("@bexio-chrome-extension/chrome-extension/src/apps/bexioTimetrackingTemplates/renderHtml");
  await renderHtml([]);
};

const openButton = () => document.getElementById("OpenSidePanel") as HTMLButtonElement;
const toast = () => document.getElementById("SoulcodeExtensionToast");

describe("open side panel button", () => {
  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = "";
    loadFixture("monitoring-edit");
    await chrome.storage.local.set({ entries: [] });
  });

  it("asks the service worker to open the side panel — the content script cannot call sidePanel itself", async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    chrome.runtime.sendMessage = sendMessage;
    await render();

    openButton().click();

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({ mode: "openSidePanel" });
    await Promise.resolve();
    expect(toast()).toBeNull();
  });

  it("tells the user when the service worker cannot be reached instead of failing silently", async () => {
    chrome.runtime.sendMessage = vi.fn().mockRejectedValue(new Error("Could not establish connection."));
    await render();

    openButton().click();
    await vi.waitFor(() => expect(toast()).not.toBeNull());

    expect(toast()!.textContent).toContain("Could not open the side panel");
  });
});
