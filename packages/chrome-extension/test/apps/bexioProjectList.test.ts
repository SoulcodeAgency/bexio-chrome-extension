import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";

// The monitoring-list fixture now includes the full bexio body (incl. .globalsearch),
// so renderHtml() runs against a realistic DOM and we exercise the actual code path
// rather than a mock — `#PopoverTextSwitcher` should end up next to .globalsearch.
describe("bexioProjectList content script", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("on /monitoring/list, imports, runs renderHtml, and injects #PopoverTextSwitcher next to .globalsearch", async () => {
    vi.stubGlobal("location", {
      ...window.location,
      pathname: "/index.php/monitoring/list",
    } as Location);
    loadFixture("monitoring-list");
    expect(document.getElementsByClassName("globalsearch").length).toBeGreaterThan(0);

    // index.ts calls initializeExtension() at top level — fire-and-forget; the real
    // renderHtml() is async, so we let microtasks + a tiny tick settle.
    const mod = await import("@bexio-chrome-extension/chrome-extension/src/apps/bexioProjectList/index");
    expect(mod).toBeDefined();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const toggle = document.getElementById("PopoverTextSwitcher");
    expect(toggle).not.toBeNull();
    expect(toggle?.tagName.toLowerCase()).toBe("button");
  });

  it("renderHtml throws when .globalsearch is absent (documents a known fragility)", async () => {
    // Load a real fixture, then strip the nav so renderHtml has nothing to insert next to.
    // We import renderHtml directly (NOT the app entry point) so the failure is a normal
    // rejected promise we can await — not an unhandled rejection at module-load time.
    loadFixture("monitoring-list");
    for (const el of Array.from(document.getElementsByClassName("globalsearch"))) {
      el.remove();
    }
    const { default: renderHtml } =
      await import("@bexio-chrome-extension/chrome-extension/src/apps/bexioProjectList/renderHtml");
    // KNOWN ISSUE: renderHtml has no fallback when bexio's .globalsearch is missing —
    // it throws "Cannot read properties of undefined (reading 'insertAdjacentHTML')".
    // Mirrored in docs/architecture/tooltip-replacement.md.
    await expect(renderHtml()).rejects.toThrow(/insertAdjacentHTML|undefined/);
    expect(document.getElementById("PopoverTextSwitcher")).toBeNull();
  });
});
