import { beforeEach, describe, expect, it, vi } from "vitest";
import * as cs from "../chromeStorage";

describe("chromeStorage", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("save then load round-trips a value under the default key", async () => {
    await cs.save([{ id: "a" }]);
    const loaded = await cs.load<{ id: string }[]>();
    expect(loaded).toEqual([{ id: "a" }]);
  });

  it("load: key absent → undefined", async () => {
    const result = await cs.load("nope");
    expect(result).toBeUndefined();
  });

  it("load: custom key", async () => {
    await cs.save("v", "k");
    const result = await cs.load("k");
    expect(result).toBe("v");
  });

  it("save: writes under default key 'entries'", async () => {
    await cs.save([1, 2]);
    const raw = await chrome.storage.local.get("entries");
    expect(raw).toEqual({ entries: [1, 2] });
  });

  it("remove: filters out the entry with matching id from an array", async () => {
    await cs.save([{ id: "a" }, { id: "b" }]);
    await cs.remove("a");
    const loaded = await cs.load();
    expect(loaded).toEqual([{ id: "b" }]);
  });

  it("remove: when stored value is not an array → saves []", async () => {
    // KNOWN ISSUE: remove() silently replaces a non-array value with []
    await cs.save({ not: "array" });
    await cs.remove("x");
    const loaded = await cs.load();
    expect(loaded).toEqual([]);
  });

  it("remove: id not present → array unchanged", async () => {
    await cs.save([{ id: "a" }]);
    await cs.remove("zzz");
    const loaded = await cs.load();
    expect(loaded).toEqual([{ id: "a" }]);
  });

  it("update: replaces matching entry (shallow-merged)", async () => {
    await cs.save([
      { id: "a", x: 1 },
      { id: "b", x: 2 },
    ]);
    await cs.update({ id: "b", x: 9 });
    const loaded = await cs.load();
    expect(loaded).toEqual([
      { id: "a", x: 1 },
      { id: "b", x: 9 },
    ]);
  });

  it("update: throws if updatedEntry has no id", async () => {
    await expect(cs.update({} as any)).rejects.toThrow("No id found in updatedEntry");
  });

  it("update: id not found → silently does nothing (the arr[-1] write is dropped on serialization)", async () => {
    // KNOWN ISSUE: update() with an unknown id uses arr[-1] = {...} (findIndex returns -1),
    // which sets a non-index property on the array instead of throwing or appending. Storage
    // serializes to JSON, so that property is dropped and the update is silently lost.
    await cs.save([{ id: "a" }]);
    await cs.update({ id: "zzz", x: 1 });
    const loaded = await cs.load<{ id: string }[]>();
    expect(loaded).toEqual([{ id: "a" }]);
    expect((loaded as any)[-1]).toBeUndefined();
  });

  it("update: custom idKey — writes back to the given key and leaves 'entries' alone", async () => {
    await cs.save([{ id: "template" }], "entries");
    await cs.save([{ slug: "x", v: 1 }], "k");
    await cs.update({ slug: "x", v: 2 } as any, "k", "slug");
    // Assert against raw storage keys (both "k" and "entries"), so a write that
    // landed under the wrong key cannot be masked by reading through load().
    const raw = await chrome.storage.local.get(["k", "entries"]);
    expect(raw.k).toEqual([{ slug: "x", v: 2 }]);
    expect(raw.entries).toEqual([{ id: "template" }]);
  });

  it("remove: custom key — writes back to the given key and leaves 'entries' alone", async () => {
    await cs.save([{ id: "template" }], "entries");
    await cs.save([{ id: "a" }, { id: "b" }], "k");
    await cs.remove("a", "k");
    const raw = await chrome.storage.local.get(["k", "entries"]);
    expect(raw.k).toEqual([{ id: "b" }]);
    expect(raw.entries).toEqual([{ id: "template" }]);
  });

  it("clear: removes the key", async () => {
    await cs.save([1], "k");
    await cs.clear("k");
    const loaded = await cs.load("k");
    expect(loaded).toBeUndefined();
  });
});
