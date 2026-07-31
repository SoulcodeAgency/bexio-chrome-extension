import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The source manifest (the one committed to git). The built copy in `unpacked/`
// is checked by `build-smoke.slow.test.ts`, which needs PowerShell; this test
// pins the parts that carry a privacy cost, so widening them is deliberate.
const MANIFEST = resolve(__dirname, "../public/manifest.json");

interface Manifest {
  permissions?: string[];
  host_permissions?: string[];
  optional_permissions?: string[];
  optional_host_permissions?: string[];
  content_scripts?: { matches?: string[] }[];
  web_accessible_resources?: { resources?: string[]; matches?: string[] }[];
}

const manifest: Manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));

describe("manifest.json scoping", () => {
  it("requests only the API permissions the extension actually uses", () => {
    // `storage` → chrome.storage.local, `sidePanel` → chrome.sidePanel.
    // Deliberately *not* `tabs`: chrome.tabs.query/create/update/sendMessage all
    // work without it, and the only property that needs elevated access
    // (`tab.url`, read in the service worker and in openBexioTimeTrackingPage)
    // is covered by the office.bexio.com host permission below.
    expect(manifest.permissions).toEqual(["storage", "sidePanel"]);
    expect(manifest.permissions).not.toContain("tabs");
    expect(manifest.optional_permissions ?? []).not.toContain("tabs");
  });

  it("holds a host permission for office.bexio.com only", () => {
    expect(manifest.host_permissions).toEqual(["https://office.bexio.com/*"]);
  });

  it("never grants host access beyond office.bexio.com", () => {
    const hosts = [
      ...(manifest.host_permissions ?? []),
      ...(manifest.optional_host_permissions ?? []),
      ...(manifest.content_scripts ?? []).flatMap((cs) => cs.matches ?? []),
      ...(manifest.web_accessible_resources ?? []).flatMap((war) => war.matches ?? []),
    ];
    expect(hosts.length).toBeGreaterThan(0);
    for (const pattern of hosts) {
      expect(pattern, `host pattern is broader than office.bexio.com: ${pattern}`).toMatch(
        /^https:\/\/office\.bexio\.com(\/|$)/,
      );
    }
  });

  it("exposes web-accessible resources to office.bexio.com only", () => {
    // A resource readable from `https://*/*` lets any site probe
    // chrome-extension://<id>/<resource> and fingerprint the visitor as a user
    // of this extension. The logo is only ever loaded by the loader overlay that
    // the content script injects into office.bexio.com.
    expect(manifest.web_accessible_resources).toEqual([
      {
        resources: ["assets/logo_orig.png"],
        matches: ["https://office.bexio.com/*"],
      },
    ]);
  });
});
