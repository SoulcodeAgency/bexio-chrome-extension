import { describe, expect, it } from "vitest";

/**
 * Pins the contract of the in-memory chrome fake (`test/support/chrome-fake.ts`) that every
 * storage test depends on: it serializes at both boundaries, exactly like the real
 * `chrome.storage.local`. Without this, a forgotten `save()` write-back would still appear
 * to work because caller and store shared the same object.
 */
describe("chrome fake — storage serialization boundary", () => {
  it("set() stores a copy: mutating the caller's object afterwards does not change storage", async () => {
    const entries = [{ id: "a", x: 1 }];
    await chrome.storage.local.set({ entries });
    entries[0].x = 99;
    entries.push({ id: "b", x: 2 });
    expect(await chrome.storage.local.get("entries")).toEqual({ entries: [{ id: "a", x: 1 }] });
  });

  it("get() returns a copy: mutating the result does not change storage", async () => {
    await chrome.storage.local.set({ entries: [{ id: "a", x: 1 }] });
    const first = (await chrome.storage.local.get("entries")).entries as { id: string; x: number }[];
    first[0].x = 99;
    expect(await chrome.storage.local.get("entries")).toEqual({ entries: [{ id: "a", x: 1 }] });
  });

  it("drops non-JSON data the way chrome.storage.local does", async () => {
    const arr: any[] = [{ id: "a" }];
    arr[-1] = { id: "stray" }; // non-index property — see docs/architecture/storage.md, issue 2
    await chrome.storage.local.set({ entries: arr, gone: undefined });
    const stored = (await chrome.storage.local.get("entries")).entries as any[];
    expect(stored).toEqual([{ id: "a" }]);
    expect(stored[-1]).toBeUndefined();
    expect((await chrome.storage.local.get("gone")).gone).toBeUndefined();
  });
});

/**
 * `chrome.storage.onChanged` is how the side panel notices templates the content script saved on
 * the bexio page (`packages/sidePanel-import/src/TemplateProvider.tsx`). The fake has to fire it
 * from the write methods, otherwise that subscription would look correct in tests while never
 * being exercised.
 */
describe("chrome fake — storage.onChanged", () => {
  type Changes = { [key: string]: chrome.storage.StorageChange };
  const record = () => {
    const seen: Array<{ changes: Changes; areaName: string }> = [];
    const listener = (changes: Changes, areaName: string) => {
      seen.push({ changes, areaName });
    };
    chrome.storage.onChanged.addListener(listener);
    return { seen, listener };
  };

  it("fires on set() with the area name and the new value", async () => {
    const { seen } = record();
    await chrome.storage.local.set({ entries: [{ id: "a" }] });

    expect(seen).toHaveLength(1);
    expect(seen[0].areaName).toBe("local");
    expect(seen[0].changes.entries.newValue).toEqual([{ id: "a" }]);
  });

  it("omits oldValue for a key that did not exist yet, and reports it on an update", async () => {
    const { seen } = record();
    await chrome.storage.local.set({ entries: [{ id: "a" }] });
    await chrome.storage.local.set({ entries: [{ id: "a" }, { id: "b" }] });

    expect("oldValue" in seen[0].changes.entries).toBe(false);
    expect(seen[1].changes.entries.oldValue).toEqual([{ id: "a" }]);
    expect(seen[1].changes.entries.newValue).toEqual([{ id: "a" }, { id: "b" }]);
  });

  it("fires on remove() with only an oldValue, and stays silent for an absent key", async () => {
    await chrome.storage.local.set({ entries: [{ id: "a" }] });
    const { seen } = record();

    await chrome.storage.local.remove("entries");
    expect(seen).toHaveLength(1);
    expect(seen[0].changes.entries.oldValue).toEqual([{ id: "a" }]);
    expect("newValue" in seen[0].changes.entries).toBe(false);

    await chrome.storage.local.remove("neverStored");
    expect(seen).toHaveLength(1);
  });

  it("stops calling a removed listener", async () => {
    const { seen, listener } = record();
    chrome.storage.onChanged.removeListener(listener);

    await chrome.storage.local.set({ entries: [{ id: "a" }] });
    expect(seen).toHaveLength(0);
  });
});

describe("chrome fake — throw-loudly guard", () => {
  it("throws for an unimplemented top-level member", () => {
    expect(() => (chrome as any).sidePanel).toThrow("chrome fake: chrome.sidePanel is not implemented");
  });

  it("throws for an unimplemented nested member", () => {
    expect(() => (chrome as any).storage.sync).toThrow("chrome fake: chrome.storage.sync is not implemented");
    expect(() => (chrome as any).runtime.connect).toThrow("chrome fake: chrome.runtime.connect is not implemented");
  });

  it("reports symbol properties instead of crashing on string conversion", () => {
    expect(() => (chrome as any)[Symbol.iterator]).toThrow(/chrome fake: chrome\.Symbol\(Symbol\.iterator\)/);
  });

  it("still exposes the implemented members", () => {
    expect(typeof chrome.storage.local.get).toBe("function");
    expect(typeof chrome.runtime.sendMessage).toBe("function");
    expect(typeof chrome.runtime.getURL).toBe("function");
    expect(typeof chrome.tabs.query).toBe("function");
    expect(typeof chrome.storage.onChanged.addListener).toBe("function");
    expect(chrome.runtime.lastError).toBeUndefined();
  });
});
