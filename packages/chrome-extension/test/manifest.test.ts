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
  content_scripts?: { matches?: string[]; js?: string[]; css?: string[]; world?: string }[];
  web_accessible_resources?: { resources?: string[]; matches?: string[] }[];
}

const manifest: Manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));

/**
 * Chrome's match-pattern rule for the patterns this manifest uses (fixed scheme and host):
 * `*` in the path matches any run of characters, everything else matches literally.
 */
const matchesUrlPattern = (pattern: string, url: string) => {
  const literal = (part: string) => part.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  return new RegExp(`^${pattern.split("*").map(literal).join(".*")}$`).test(url);
};

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

  it("injects the tooltip content script and its stylesheet on the URL bexio's sidebar opens the time list with", () => {
    // The sidebar's "Zeiten" link loads /monitoring/list/resetListView/1, and bexio then rewrites
    // the address to /monitoring/list through the History API. Chrome matches the stylesheet
    // against the loaded URL but the script against the rewritten one, so a match on
    // /monitoring/list alone ran the toggle without bexioProjectList.css: no active option shown.
    const tooltipScript = manifest.content_scripts?.find((cs) =>
      cs.js?.includes("/src/apps/bexioProjectList/index.ts"),
    );
    expect(tooltipScript?.css).toEqual(["bexioProjectList.css"]);

    const matchesSidebarUrl = tooltipScript!.matches!.some((pattern) =>
      matchesUrlPattern(pattern, "https://office.bexio.com/index.php/monitoring/list/resetListView/1"),
    );
    expect(matchesSidebarUrl).toBe(true);
  });

  describe("bexio's new Angular time tracking (#168)", () => {
    const NEW_UI_URLS = [
      "https://office.bexio.com/index.php/time-tracking",
      "https://office.bexio.com/index.php/time-tracking?sortBy=date:desc&filter=all&filterBy=",
      "https://office.bexio.com/index.php/pr_project/show/id/12",
      "https://office.bexio.com/index.php/pr_project/listTimeTrackingSpa/projectId/12",
      "https://office.bexio.com/index.php/pr_project/showPackage/packageId/34",
    ];
    const scriptFor = (entry: string) => manifest.content_scripts?.find((cs) => cs.js?.includes(entry));

    it.each(NEW_UI_URLS)("injects the templates script (time entry modal) on %s", (url) => {
      const script = scriptFor("/src/apps/bexioTimetrackingTemplates/index.ts");
      expect(script!.matches!.some((pattern) => matchesUrlPattern(pattern, url))).toBe(true);
    });

    it.each(NEW_UI_URLS)("injects the remarks script and the MAIN-world grid script on %s", (url) => {
      for (const entry of ["/src/apps/bexioProjectList/index.ts", "/src/apps/bexioGridColumns/index.iife.ts"]) {
        expect(
          scriptFor(entry)!.matches!.some((pattern) => matchesUrlPattern(pattern, url)),
          entry,
        ).toBe(true);
      }
    });

    it("runs the grid column script in the page's MAIN world, as a self-contained IIFE", () => {
      // ag-grid's API hangs off a page-JS expando (`__agComponent`) that the isolated world cannot see.
      // crxjs builds `*.iife.ts` entries without its ESM loader, which needs chrome.runtime.getURL —
      // an API the MAIN world does not have.
      const script = scriptFor("/src/apps/bexioGridColumns/index.iife.ts");
      expect(script?.world).toBe("MAIN");
      expect(script?.css).toBeUndefined();
    });

    it("keeps the templates script (and its onMessage listener) to one entry per page", () => {
      // Two copies of the listener would each apply a side-panel request once.
      const templateScripts = (manifest.content_scripts ?? []).filter((cs) =>
        cs.js?.some((js) => js.includes("bexioTimetrackingTemplates")),
      );
      expect(templateScripts).toHaveLength(1);
    });
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
