import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("test harness", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
  });

  it("provides a jsdom document", () => {
    expect(typeof document).toBe("object");
    expect(typeof document.querySelector).toBe("function");
  });

  it("provides the chrome.storage fake", async () => {
    await chrome.storage.local.set({ probe: 123 });
    const got = await chrome.storage.local.get("probe");
    expect(got).toEqual({ probe: 123 });
  });

  it("resets the chrome.storage fake between tests", async () => {
    const got = await chrome.storage.local.get("probe");
    expect(got).toEqual({}); // not 123 from the previous test
  });

  it("loads an HTML fragment into document.body via loadFixture-style read", () => {
    const html = readFileSync(resolve(__dirname, "__inline__/tiny.html"), "utf8");
    document.body.innerHTML = html;
    expect(document.getElementById("probe")).not.toBeNull();
    expect(document.querySelector("i[rel='popover']")?.getAttribute("data-content")).toBe("hello & goodbye");
  });
});
