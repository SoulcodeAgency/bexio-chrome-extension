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

const setOptionsCalls: SetOptionsCall[] = [];
const createCalls: { url: string }[] = [];
let onUpdated: OnUpdatedListener | undefined;
let onActionClicked: ((tab: Tab) => void) | undefined;

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
  };
  await import("../public/service_worker.js");
});

afterAll(() => {
  globals.chrome = originalChrome;
});

beforeEach(() => {
  setOptionsCalls.length = 0;
  createCalls.length = 0;
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
