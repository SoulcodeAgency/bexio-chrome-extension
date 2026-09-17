import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// `public/service_worker.js` is plain JS that registers its listeners at module
// evaluation time. The shared chrome fake deliberately throws for `chrome.tabs`
// / `chrome.sidePanel` / `chrome.action`, so this file installs its own minimal
// stub before importing the worker, and captures the registered listeners.

interface SetOptionsCall {
  tabId: number;
  enabled: boolean;
  path?: string;
}

type Tab = { id?: number; url?: string };
type OnUpdatedListener = (tabId: number, info: Record<string, unknown>, tab: Tab) => Promise<void>;

type OnMessageListener = (message: unknown, sender: { tab?: Tab }) => void;

const setOptionsCalls: SetOptionsCall[] = [];
const createCalls: { url: string }[] = [];
const openCalls: { tabId: number }[] = [];
let onUpdated: OnUpdatedListener | undefined;
let onActionClicked: ((tab: Tab) => void) | undefined;
let onMessage: OnMessageListener | undefined;

const globals = globalThis as unknown as Record<string, unknown>;
const originalChrome = globals.chrome;

beforeAll(async () => {
  globals.chrome = {
    action: {
      onClicked: {
        addListener: (fn: (tab: Tab) => void) => {
          onActionClicked = fn;
        },
      },
    },
    sidePanel: {
      setPanelBehavior: () => Promise.resolve(),
      setOptions: async (options: SetOptionsCall) => {
        setOptionsCalls.push(options);
      },
      open: async (options: { tabId: number }) => {
        openCalls.push(options);
      },
    },
    tabs: {
      create: (options: { url: string }) => {
        createCalls.push(options);
      },
      onUpdated: {
        addListener: (fn: OnUpdatedListener) => {
          onUpdated = fn;
        },
      },
    },
    runtime: {
      onMessage: {
        addListener: (fn: OnMessageListener) => {
          onMessage = fn;
        },
      },
    },
  };
  await import("../public/service_worker.js");
});

afterAll(() => {
  globals.chrome = originalChrome;
});

beforeEach(() => {
  setOptionsCalls.length = 0;
  createCalls.length = 0;
  openCalls.length = 0;
});

describe("service worker side-panel gating", () => {
  it("registers the listeners it needs", () => {
    expect(typeof onUpdated).toBe("function");
    expect(typeof onActionClicked).toBe("function");
  });

  it("opens the bexio time tracking page when the toolbar icon is clicked", () => {
    onActionClicked!({ id: 1 });
    expect(createCalls).toEqual([{ url: "https://office.bexio.com/index.php/monitoring/edit" }]);
  });

  it.each([
    "https://office.bexio.com/index.php/monitoring",
    "https://office.bexio.com/index.php/monitoring/list",
    "https://office.bexio.com/index.php/monitoring/edit",
    "https://office.bexio.com/index.php/monitoring/edit/id/42",
  ])("enables the side panel on %s", async (url) => {
    await onUpdated!(7, { status: "complete" }, { id: 7, url });
    expect(setOptionsCalls).toEqual([{ tabId: 7, path: "/sidePanel-import/index.html", enabled: true }]);
  });

  it("disables the side panel on other bexio pages", async () => {
    await onUpdated!(7, {}, { id: 7, url: "https://office.bexio.com/index.php/kb_invoice/show/id/1" });
    expect(setOptionsCalls).toEqual([{ tabId: 7, enabled: false }]);
  });

  it("disables the side panel when the tab url is unknown", async () => {
    // Without the broad `tabs` permission Chrome hides `tab.url` for every host
    // the extension has no access to — i.e. everything that is not bexio. A
    // missing url must therefore disable the panel, not skip the update.
    await onUpdated!(7, { status: "complete" }, { id: 7 });
    expect(setOptionsCalls).toEqual([{ tabId: 7, enabled: false }]);
  });
});

describe("service worker open-side-panel relay", () => {
  it("registers the message listener", () => {
    expect(typeof onMessage).toBe("function");
  });

  it("opens the side panel for the sender's tab when the content script asks", () => {
    onMessage!({ mode: "openSidePanel" }, { tab: { id: 42 } });
    // Asserted right after the call, before any microtask: sidePanel.open() only
    // works inside the click's user gesture, which an `await` in the worker would lose.
    expect(openCalls).toEqual([{ tabId: 42 }]);
  });

  it("ignores other messages and requests that do not come from a tab", () => {
    onMessage!({ mode: "template", templateId: "x" }, { tab: { id: 42 } });
    onMessage!({ mode: "openSidePanel" }, {});
    expect(openCalls).toEqual([]);
  });
});
