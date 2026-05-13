import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";

// ─── delay ───────────────────────────────────────────────────────────────────

describe("delay", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves after the specified milliseconds", async () => {
    const { default: delay } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/delay"
    );
    let done = false;
    const p = delay(100).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(99);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(done).toBe(true);
  });

  it("resolves immediately for delay(0)", async () => {
    const { default: delay } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/delay"
    );
    let done = false;
    const p = delay(0).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    await p;
    expect(done).toBe(true);
  });
});

// ─── trimAll ─────────────────────────────────────────────────────────────────

describe("trimAll", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("removes all whitespace from a string with extra spaces", async () => {
    const { default: trimAll } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/trimAll"
    );
    expect(trimAll("  a  b ")).toBe("ab");
  });

  it("returns empty string for an empty string", async () => {
    const { default: trimAll } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/trimAll"
    );
    expect(trimAll("")).toBe("");
  });

  it("returns empty string for undefined", async () => {
    const { default: trimAll } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/trimAll"
    );
    // `undefined !== undefined` is false → early return ""
    expect(trimAll(undefined as unknown as string)).toBe("");
  });

  it("throws TypeError for null (no null-guard in trimAll)", async () => {
    const { default: trimAll } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/trimAll"
    );
    // KNOWN ISSUE: trimAll does not guard against null — `null.length` throws TypeError
    expect(() => trimAll(null as unknown as string)).toThrow(TypeError);
  });

  it("returns empty string for an Element (element has no .length property)", async () => {
    const { default: trimAll } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/trimAll"
    );
    // In readFormData, trimAll is called with `workField` (an Element/null from querySelector).
    // Elements do not have a numeric .length, so `element.length > 0` is false → returns "".
    const el = document.createElement("input");
    expect(trimAll(el as unknown as string)).toBe("");
  });
});

// ─── toggleDisplayLoader ─────────────────────────────────────────────────────

describe("toggleDisplayLoader", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
  });

  it("sets the loader display to flex when called with no argument (show defaults to true)", async () => {
    loadFixture("monitoring-edit");
    const { toggleDisplayLoader } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/loader"
    );
    // jsdom does not implement startViewTransition, so swapDisplayStyle runs directly
    toggleDisplayLoader();
    const loader = document.getElementById("SoulcodeExtensionLoader") as HTMLElement;
    expect(loader.style.display).toBe("flex");
  });

  it("sets the loader display to none when called with false", async () => {
    loadFixture("monitoring-edit");
    const { toggleDisplayLoader } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/loader"
    );
    // First show the loader, then hide it
    toggleDisplayLoader(true);
    toggleDisplayLoader(false);
    const loader = document.getElementById("SoulcodeExtensionLoader") as HTMLElement;
    expect(loader.style.display).toBe("none");
  });

  it("swapDisplayStyle sets display directly without transition", async () => {
    loadFixture("monitoring-edit");
    const { swapDisplayStyle } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/loader"
    );
    swapDisplayStyle(true);
    const loader = document.getElementById("SoulcodeExtensionLoader") as HTMLElement;
    expect(loader.style.display).toBe("flex");
    swapDisplayStyle(false);
    expect(loader.style.display).toBe("none");
  });
});

// ─── pressEnter ──────────────────────────────────────────────────────────────

describe("pressEnter", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("is a KeyboardEvent with key not set and keyCode 13", async () => {
    const { default: pressEnter } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/pressEnter"
    );
    // pressEnter is a KeyboardEvent instance (not a function), exported as a reusable event object
    expect(pressEnter).toBeInstanceOf(KeyboardEvent);
    expect(pressEnter.type).toBe("keydown");
    // KNOWN ISSUE: pressEnter is created with `keyCode: 13` but not `key: "Enter"` — `key` defaults
    // to "" because the KeyboardEvent constructor init dict does not include a `key` property
    expect(pressEnter.keyCode).toBe(13);
    expect(pressEnter.bubbles).toBe(true);
    expect(pressEnter.cancelable).toBe(true);
  });

  it("can be dispatched to an element and fires its keydown listener", async () => {
    const { default: pressEnter } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/pressEnter"
    );
    const el = document.createElement("input");
    document.body.appendChild(el);
    const handler = vi.fn();
    el.addEventListener("keydown", handler);
    el.dispatchEvent(pressEnter);
    expect(handler).toHaveBeenCalledOnce();
    const event = handler.mock.calls[0][0] as KeyboardEvent;
    expect(event.keyCode).toBe(13);
  });
});

// ─── generateHash ─────────────────────────────────────────────────────────────

describe("generateHash", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns the known SHA-256 hex digest of 'abc'", async () => {
    const { default: generateHash } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/generateHash"
    );
    const hash = await generateHash("abc");
    expect(hash).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("returns a 64-character lowercase hex string", async () => {
    const { default: generateHash } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/generateHash"
    );
    const hash = await generateHash("hello world");
    expect(hash.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  it("returns different hashes for different inputs", async () => {
    const { default: generateHash } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/generateHash"
    );
    const h1 = await generateHash("foo");
    const h2 = await generateHash("bar");
    expect(h1).not.toBe(h2);
  });
});
