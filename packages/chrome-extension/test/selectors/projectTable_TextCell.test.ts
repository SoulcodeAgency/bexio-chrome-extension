import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";

describe("projectTable_TextCell selectors", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
  });

  it("getPopoverNodes finds every i[rel='popover'] in the monitoring list fixture", async () => {
    loadFixture("monitoring-list");
    const { getPopoverNodes } =
      await import("@bexio-chrome-extension/chrome-extension/src/selectors/projectTable_TextCell");
    const nodes = getPopoverNodes();
    expect(nodes.length).toBeGreaterThanOrEqual(3);
    nodes.forEach((n) => expect(n.tagName.toLowerCase()).toBe("i"));
  });

  it("getPopoverNodeText returns the data-content attribute", async () => {
    loadFixture("monitoring-list");
    const { getPopoverNodes, getPopoverNodeText } =
      await import("@bexio-chrome-extension/chrome-extension/src/selectors/projectTable_TextCell");
    const first = getPopoverNodes()[0];
    expect(getPopoverNodeText(first)).toBe(first.getAttribute("data-content"));
  });

  it("works the same on the project listMonitoring / showPackage / kb_invoice fixtures", async () => {
    for (const fixture of ["pr_project-listMonitoring", "pr_project-showPackage", "kb_invoice-show"]) {
      vi.resetModules();
      document.body.innerHTML = "";
      loadFixture(fixture);
      const { getPopoverNodes } =
        await import("@bexio-chrome-extension/chrome-extension/src/selectors/projectTable_TextCell");
      expect(getPopoverNodes().length).toBeGreaterThanOrEqual(1);
    }
  });
});
