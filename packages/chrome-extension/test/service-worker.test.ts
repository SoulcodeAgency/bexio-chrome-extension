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
const queryCalls: { url?: string }[] = [];
let queryResult: Tab[] = [];
let onUpdated: OnUpdatedListener | undefined;
let onActionClicked: ((tab: Tab) => void) | undefined;
let onInstalled: (() => Promise<void>) | undefined;
let onStartup: (() => Promise<void>) | undefined;

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
    runtime: {
      onInstalled: {
        addListener: (fn: () => Promise<void>) => {
          onInstalled = fn;
        },
      },
      onStartup: {
        addListener: (fn: () => Promise<void>) => {
          onStartup = fn;
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
      query: async (query: { url?: string }) => {
        queryCalls.push(query);
        return queryResult;
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
  queryCalls.length = 0;
  queryResult = [];
});

describe("service worker side-panel gating", () => {
  it("registers the listeners it needs", () => {
    expect(typeof onUpdated).toBe("function");
    expect(typeof onActionClicked).toBe("function");
    expect(typeof onInstalled).toBe("function");
    expect(typeof onStartup).toBe("function");
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

describe("service worker side-panel enabling for tabs that already exist", () => {
  // `chrome.tabs.onUpdated` only fires when a tab navigates. A bexio monitoring
  // tab that is already open when the extension is installed, loaded unpacked
  // or reloaded would therefore never get its side panel enabled — so the
  // worker also sweeps the existing tabs on install and on browser startup.
  const monitoringTabs: Tab[] = [
    { id: 3, url: "https://office.bexio.com/index.php/monitoring/list" },
    { id: 9, url: "https://office.bexio.com/index.php/monitoring/edit/id/42" },
  ];

  it.each([
    ["onInstalled", () => onInstalled!()],
    ["onStartup", () => onStartup!()],
  ])("%s queries the open bexio monitoring tabs and enables the panel on each", async (_name, fire) => {
    queryResult = monitoringTabs;
    await fire();
    expect(queryCalls).toEqual([{ url: "https://office.bexio.com/index.php/monitoring*" }]);
    expect(setOptionsCalls).toEqual([
      { tabId: 3, path: "/sidePanel-import/index.html", enabled: true },
      { tabId: 9, path: "/sidePanel-import/index.html", enabled: true },
    ]);
  });

  it("does nothing when no bexio monitoring tab is open", async () => {
    await onInstalled!();
    expect(queryCalls).toHaveLength(1);
    expect(setOptionsCalls).toEqual([]);
  });

  it("skips a queried tab that has no id", async () => {
    queryResult = [{ url: "https://office.bexio.com/index.php/monitoring/list" }, monitoringTabs[0]];
    await onInstalled!();
    expect(setOptionsCalls).toEqual([{ tabId: 3, path: "/sidePanel-import/index.html", enabled: true }]);
  });
});
