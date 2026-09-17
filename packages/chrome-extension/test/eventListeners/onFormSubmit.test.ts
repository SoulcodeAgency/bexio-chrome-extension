/**
 * The content-script → side-panel half of the messaging contract: whenever bexio's
 * `#MonitoringForm` fires a `submit` event — the user clicking "Speichern", pressing Enter, or
 * the side panel's own `submit` request — the content script tells the extension pages via
 * `chrome.runtime.sendMessage({ mode: "form-submitted" })`, so the side panel can mark the entry
 * waiting on 📤 as booked. See docs/architecture/form-layer.md, "Messaging contract".
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChromeFake } from "../../../../test/support/chrome-fake";
import { loadFixture } from "../support/load-fixture";

async function loadWatcher() {
  const module = await import("@bexio-chrome-extension/chrome-extension/src/eventListeners/onFormSubmit");
  return module.watchMonitoringFormSubmit;
}

function submitForm() {
  const form = document.getElementById("MonitoringForm") as HTMLFormElement;
  // jsdom cannot navigate, so the default action is cancelled; only the event matters here.
  form.addEventListener("submit", (event) => event.preventDefault(), { once: true });
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

describe("watchMonitoringFormSubmit", () => {
  let sendMessage: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
    sendMessage = vi.spyOn(getChromeFake().runtime, "sendMessage").mockImplementation(async () => undefined);
  });

  it("sends form-submitted to the extension pages when the form submits", async () => {
    loadFixture("monitoring-edit");
    const watch = await loadWatcher();

    watch();
    submitForm();

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({ mode: "form-submitted" });
  });

  it("arms the form only once, however often the page UI is re-initialised", async () => {
    loadFixture("monitoring-edit");
    const watch = await loadWatcher();

    watch();
    watch();
    watch();
    submitForm();

    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("does nothing on a page without the form", async () => {
    const watch = await loadWatcher();

    expect(() => watch()).not.toThrow();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("survives a closed side panel (sendMessage rejects) without an unhandled rejection", async () => {
    loadFixture("monitoring-edit");
    sendMessage.mockImplementation(async () => {
      throw new Error("Could not establish connection. Receiving end does not exist.");
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    const watch = await loadWatcher();

    watch();
    submitForm();
    await new Promise((resolve) => setTimeout(resolve, 0));

    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("is armed by initializeExtension", async () => {
    loadFixture("monitoring-edit");
    const { initializeExtension } =
      await import("@bexio-chrome-extension/chrome-extension/src/apps/bexioTimetrackingTemplates/index");

    await initializeExtension();
    submitForm();

    expect(sendMessage).toHaveBeenCalledWith({ mode: "form-submitted" });
  });
});
