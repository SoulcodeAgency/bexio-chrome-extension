import { describe, expect, it, vi } from "vitest";
import packageJson from "../../../../package.json";

/**
 * `VERSION` is what the injected Templates block prints in its `h2` title, and it is the
 * only place on the page that says which build is loaded. `npm run build:test` stamps a
 * fourth part into the built `manifest.json` only (`1.8.2.7`) and touches no tracked file,
 * so reading `package.json` would always print the release version — the exact failure this
 * pins. The module computes the value once at load, hence the dynamic imports.
 */
describe("packageInfo.VERSION", () => {
  it("reports the version from the loaded manifest, not package.json", async () => {
    vi.resetModules();
    const { VERSION } = await import("../../src/utils/packageInfo");

    expect(VERSION).toBe("0.0.0-fake");
    expect(VERSION).not.toBe(packageJson.version);
  });

  it("falls back to package.json when there is no extension around it", async () => {
    const realChrome = globalThis.chrome;
    // The chrome fake's guard throws on an unstubbed member, so "no extension" has to be
    // covered by a throw as well as by chrome being absent entirely.
    vi.stubGlobal("chrome", undefined);
    try {
      vi.resetModules();
      const { VERSION } = await import("../../src/utils/packageInfo");
      expect(VERSION).toBe(packageJson.version);
    } finally {
      vi.stubGlobal("chrome", realChrome);
      vi.resetModules();
    }
  });

  it("survives a chrome.runtime that has no getManifest", async () => {
    const realChrome = globalThis.chrome;
    vi.stubGlobal("chrome", {
      runtime: new Proxy(
        {},
        {
          get() {
            throw new Error("chrome fake: chrome.runtime.getManifest is not implemented");
          },
        },
      ),
    });
    try {
      vi.resetModules();
      const { VERSION } = await import("../../src/utils/packageInfo");
      expect(VERSION).toBe(packageJson.version);
    } finally {
      vi.stubGlobal("chrome", realChrome);
      vi.resetModules();
    }
  });
});
