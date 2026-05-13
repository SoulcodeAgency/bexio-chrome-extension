import { describe, expect, it } from "vitest";
import sortTemplates from "../sortTemplates";

describe("sortTemplates", () => {
  it("sorts by template name (locale compare), ascending", () => {
    const input = [{ templateName: "Beta" }, { templateName: "alpha" }, { templateName: "Gamma" }] as any[];
    expect(sortTemplates(input).map((e) => e.templateName)).toEqual(["alpha", "Beta", "Gamma"]);
  });

  it("uses id as the name when templateName is absent", () => {
    const input = [{ id: "b" }, { templateName: "a" }] as any[];
    expect(sortTemplates(input).map((e) => e.templateName ?? e.id)).toEqual(["a", "b"]);
  });

  it("sorts in place and returns the same array reference", () => {
    // KNOWN ISSUE: sortTemplates mutates its argument (Array.prototype.sort)
    const input = [{ templateName: "b" }, { templateName: "a" }] as any[];
    const out = sortTemplates(input);
    expect(out).toBe(input);
  });
});
