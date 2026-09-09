import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const importModule = async () =>
  await import("@bexio-chrome-extension/chrome-extension/src/apps/bexioTimetrackingTemplates/panelToast");
const toast = () => document.getElementById("SoulcodeExtensionToast");

describe("panelToast", () => {
  let panel: HTMLElement;
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="panel"></div>';
    panel = document.getElementById("panel")!;
  });
  afterEach(() => vi.useRealTimers());

  it("renders text (as literal text) and auto-hides after 5 seconds", async () => {
    const { showPanelToast } = await importModule();
    showPanelToast(panel, { text: 'Deleted "<b>x</b>"' });
    expect(toast()!.textContent).toBe('Deleted "<b>x</b>"');
    expect(toast()!.querySelector("b")).toBeNull();
    vi.advanceTimersByTime(5000);
    expect(toast()).toBeNull();
  });

  it("fires the action once and hides immediately", async () => {
    const { showPanelToast } = await importModule();
    const onAction = vi.fn();
    showPanelToast(panel, { text: "Deleted", actionLabel: "Undo", onAction });
    const button = toast()!.querySelector("button")!;
    expect(button.textContent).toBe("Undo");
    button.click();
    expect(onAction).toHaveBeenCalledOnce();
    expect(toast()).toBeNull();
  });

  it("a second toast replaces the first, hidePanelToast removes it", async () => {
    const { showPanelToast, hidePanelToast } = await importModule();
    showPanelToast(panel, { text: "first" });
    showPanelToast(panel, { text: "second" });
    expect(document.querySelectorAll("#SoulcodeExtensionToast")).toHaveLength(1);
    expect(toast()!.textContent).toBe("second");
    hidePanelToast();
    expect(toast()).toBeNull();
  });
});
