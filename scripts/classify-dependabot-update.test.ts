import { describe, expect, it } from "vitest";
import { classifyDependabotUpdate } from "./classify-dependabot-update";

// The auto-merge workflow merges anything this returns as patch/minor/group
// without a human looking at it, so the boundary cases matter more than usual.
describe("classifyDependabotUpdate", () => {
  it("classifies a patch bump", () => {
    expect(classifyDependabotUpdate("Bump lodash from 1.2.3 to 1.2.4")).toBe("patch");
  });

  it("classifies a minor bump", () => {
    expect(classifyDependabotUpdate("Bump lodash from 1.2.3 to 1.3.0")).toBe("minor");
  });

  it("classifies a major bump", () => {
    expect(classifyDependabotUpdate("Bump lodash from 1.2.3 to 2.0.0")).toBe("major");
  });

  it("classifies a grouped update", () => {
    expect(classifyDependabotUpdate("Bump the npm-minor-patch group with 5 updates")).toBe("group");
  });

  it("classifies a grouped update spanning directories", () => {
    expect(
      classifyDependabotUpdate("Bump the actions-minor-patch group across 2 directories with 7 updates"),
    ).toBe("group");
  });

  it("handles the real titles this repo has seen", () => {
    expect(classifyDependabotUpdate("chore(deps): bump dompurify from 3.3.1 to 3.4.11 in /packages/chrome-extension")).toBe("minor");
    expect(classifyDependabotUpdate("chore(deps-dev): bump vite from 5.4.21 to 6.4.3")).toBe("major");
    expect(classifyDependabotUpdate("chore(deps): bump picomatch from 2.3.1 to 2.3.2")).toBe("patch");
  });

  it("tolerates a v prefix", () => {
    expect(classifyDependabotUpdate("Bump actions/checkout from v4.2.2 to v7.0.1")).toBe("major");
  });

  it("ignores prerelease and build suffixes", () => {
    expect(classifyDependabotUpdate("Bump pkg from 1.2.3-beta.1 to 1.2.4+build.5")).toBe("patch");
  });

  // Anything not understood must fall through to a human rather than merge.
  it("returns unknown for an unparseable title", () => {
    expect(classifyDependabotUpdate("totally not a dependabot title")).toBe("unknown");
  });

  it("returns unknown for non-string input", () => {
    expect(classifyDependabotUpdate(undefined)).toBe("unknown");
    expect(classifyDependabotUpdate(42)).toBe("unknown");
  });
});
