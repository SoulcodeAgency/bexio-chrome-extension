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
    expect(classifyDependabotUpdate("Bump the actions-minor-patch group across 2 directories with 7 updates")).toBe(
      "group",
    );
  });

  // Dependabot *security* updates invent their own group names (npm_and_yarn,
  // github_actions) and ignore .github/dependabot.yml entirely — so those
  // groups are NOT capped at minor+patch and can carry majors. Only the group
  // names configured in dependabot.yml may auto-merge.
  it("returns unknown for the npm_and_yarn security group", () => {
    expect(
      classifyDependabotUpdate("chore(deps): bump the npm_and_yarn group across 2 directories with 12 updates"),
    ).toBe("unknown");
  });

  it("returns unknown for the github_actions security group", () => {
    expect(classifyDependabotUpdate("Bump the github_actions group with 2 updates")).toBe("unknown");
  });

  it("lets the group rule win over a version range in the same title", () => {
    expect(
      classifyDependabotUpdate(
        "chore(deps): bump next from 15.1.4 to 15.2.3 in /website in the npm_and_yarn group across 1 directory",
      ),
    ).toBe("unknown");
  });

  it("still merges a configured group", () => {
    expect(classifyDependabotUpdate("Bump the npm-minor-patch group with 4 updates")).toBe("group");
  });

  it("handles the real titles this repo has seen", () => {
    expect(
      classifyDependabotUpdate("chore(deps): bump dompurify from 3.3.1 to 3.4.11 in /packages/chrome-extension"),
    ).toBe("minor");
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

  // Multi-dependency security updates carry neither versions nor a group name
  // (this repo has produced these: PRs #60, #57, #17).
  it("returns unknown for a versionless multi-dependency title", () => {
    expect(classifyDependabotUpdate("chore(deps): bump minimatch and eslint")).toBe("unknown");
  });

  it("returns unknown for non-string input", () => {
    expect(classifyDependabotUpdate(undefined)).toBe("unknown");
    expect(classifyDependabotUpdate(42)).toBe("unknown");
  });
});
