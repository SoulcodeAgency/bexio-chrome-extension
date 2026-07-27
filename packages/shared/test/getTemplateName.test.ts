import { describe, expect, it } from "vitest";
import getTemplateName from "../getTemplateName";

describe("getTemplateName", () => {
  it("returns templateName when present", () => {
    expect(getTemplateName({ templateName: "Foo" } as any)).toBe("Foo");
  });

  it("falls back to id when templateName is missing", () => {
    expect(getTemplateName({ id: "abc" } as any)).toBe("abc");
  });

  it("falls back to a literal when both are missing", () => {
    expect(getTemplateName({} as any)).toBe("No template name found");
  });

  it("falls back when passed undefined", () => {
    expect(getTemplateName(undefined as any)).toBe("No template name found");
  });
});
