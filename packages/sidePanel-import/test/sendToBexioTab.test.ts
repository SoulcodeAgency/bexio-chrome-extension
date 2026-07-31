/**
 * Side-panel → content-script messaging feedback (issue #86).
 *
 * Every path through `sendToBexioTab` (and the two wrappers built on it) must either succeed or
 * tell the user why it did not. The cases pinned here are the ones that used to be swallowed by
 * the detached `(async () => {...})()` IIFEs: no `chrome.tabs`, an empty `chrome.tabs.query`
 * result, and a rejecting `chrome.tabs.sendMessage` (the "Receiving end does not exist" case that
 * happens on every bexio page other than `monitoring/edit`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { message } from "antd";
import applyTemplate from "~/utils/applyTemplate";
import reloadExtension, { RELOAD_UNREACHABLE_MESSAGE } from "~/utils/reloadExtension";
import {
  NO_ACTIVE_TAB_MESSAGE,
  NO_CONTENT_SCRIPT_MESSAGE,
  NO_EXTENSION_APIS_MESSAGE,
  sendToBexioTab,
} from "~/utils/sendToBexioTab";

type TabsStub = {
  query: ReturnType<typeof vi.fn>;
  sendMessage: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

/** Overrides the shared fake's `chrome.tabs` with a deterministic per-test stub. */
function installTabsStub(overrides: Partial<TabsStub> = {}): TabsStub {
  const tabs: TabsStub = {
    query: vi.fn(async () => [{ id: 7, url: "https://office.bexio.com/index.php/monitoring/edit" }]),
    sendMessage: vi.fn(async () => ({ ok: true })),
    update: vi.fn(async () => ({})),
    ...overrides,
  };
  (globalThis as unknown as { chrome: Record<string, unknown> }).chrome.tabs = tabs;
  return tabs;
}

function removeTabsStub() {
  delete (globalThis as unknown as { chrome: Record<string, unknown> }).chrome.tabs;
}

const reload = { mode: "reload" } as const;

describe("sendToBexioTab", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warningSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // antd's static message renders into the document; stub it and start each test from a clean
    // call list (vi.spyOn returns the existing spy when the property is already mocked).
    errorSpy = vi.spyOn(message, "error").mockImplementation((() => {}) as never);
    warningSpy = vi.spyOn(message, "warning").mockImplementation((() => {}) as never);
    errorSpy.mockClear();
    warningSpy.mockClear();
  });

  afterEach(() => {
    removeTabsStub();
  });

  it("resolves with the tab id and sends the payload when a content script answers", async () => {
    const tabs = installTabsStub();

    const result = await sendToBexioTab(reload);

    expect(result).toEqual({ ok: true, tabId: 7 });
    expect(tabs.sendMessage).toHaveBeenCalledWith(7, reload);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("reports missing extension APIs instead of throwing", async () => {
    // No chrome.tabs — the same situation as the standalone Vite dev server. The
    // shared fake ships a tabs stand-in (issue #88), so it is removed explicitly;
    // the guard then throws on access and getTabsApi() reports the API as absent.
    removeTabsStub();
    const result = await sendToBexioTab(reload);

    expect(result.ok).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(NO_EXTENSION_APIS_MESSAGE);
  });

  it("reports an empty chrome.tabs.query result (tab === undefined)", async () => {
    const tabs = installTabsStub({ query: vi.fn(async () => []) });

    const result = await sendToBexioTab(reload);

    expect(result.ok).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(NO_ACTIVE_TAB_MESSAGE);
    expect(tabs.sendMessage).not.toHaveBeenCalled();
  });

  it("reports a tab without an id", async () => {
    installTabsStub({ query: vi.fn(async () => [{ url: "https://office.bexio.com/" }]) });

    const result = await sendToBexioTab(reload);

    expect(result.ok).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(NO_ACTIVE_TAB_MESSAGE);
  });

  it("reports a rejecting chrome.tabs.query", async () => {
    installTabsStub({
      query: vi.fn(async () => {
        throw new Error("query blew up");
      }),
    });

    const result = await sendToBexioTab(reload);

    expect(result.ok).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("query blew up"));
  });

  it("reports a missing receiving end with actionable text", async () => {
    installTabsStub({
      sendMessage: vi.fn(async () => {
        throw new Error("Could not establish connection. Receiving end does not exist.");
      }),
    });

    const result = await sendToBexioTab(reload);

    expect(result.ok).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(NO_CONTENT_SCRIPT_MESSAGE);
  });

  it("uses the caller's unreachable message and severity", async () => {
    installTabsStub({
      sendMessage: vi.fn(async () => {
        throw new Error("Receiving end does not exist.");
      }),
    });

    await sendToBexioTab(reload, { unreachableMessage: "custom text", unreachableLevel: "warning" });

    expect(warningSpy).toHaveBeenCalledWith("custom text");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("reports an { ok: false } answer from the content script", async () => {
    installTabsStub({ sendMessage: vi.fn(async () => ({ ok: false, error: "template gone" })) });

    const result = await sendToBexioTab(reload);

    expect(result.ok).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("template gone"));
  });

  it("accepts an undefined answer (content script that does not respond)", async () => {
    installTabsStub({ sendMessage: vi.fn(async () => undefined) });

    const result = await sendToBexioTab(reload);

    expect(result).toEqual({ ok: true, tabId: 7 });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  describe("applyTemplate", () => {
    it("sends the template and re-focuses the tab", async () => {
      const tabs = installTabsStub();

      await expect(applyTemplate("tmpl1", true)).resolves.toBe(true);

      expect(tabs.sendMessage).toHaveBeenCalledWith(7, {
        mode: "template",
        templateId: "tmpl1",
        timeEntryBillable: true,
      });
      expect(tabs.update).toHaveBeenCalledWith(7, { active: true });
    });

    it("resolves to false and shows an error when the tab has no content script", async () => {
      const tabs = installTabsStub({
        sendMessage: vi.fn(async () => {
          throw new Error("Could not establish connection. Receiving end does not exist.");
        }),
      });

      await expect(applyTemplate("tmpl1")).resolves.toBe(false);

      expect(errorSpy).toHaveBeenCalledWith(NO_CONTENT_SCRIPT_MESSAGE);
      expect(tabs.update).not.toHaveBeenCalled();
    });

    it("still resolves to true when re-focusing the tab fails", async () => {
      installTabsStub({
        update: vi.fn(async () => {
          throw new Error("no such tab");
        }),
      });

      await expect(applyTemplate("tmpl1")).resolves.toBe(true);
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe("reloadExtension", () => {
    it("warns (does not error) when the bexio page cannot refresh its template list", async () => {
      installTabsStub({
        sendMessage: vi.fn(async () => {
          throw new Error("Could not establish connection. Receiving end does not exist.");
        }),
      });

      await expect(reloadExtension()).resolves.toBe(false);

      expect(warningSpy).toHaveBeenCalledWith(RELOAD_UNREACHABLE_MESSAGE);
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });
});
