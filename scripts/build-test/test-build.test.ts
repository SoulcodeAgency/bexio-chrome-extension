import { describe, expect, it } from "vitest";
import { assertReplaceableTarget, isSameDirectory, nextBuildNumber, testBuildVersion } from "./test-build.ts";

describe("testBuildVersion", () => {
  it("appends the build number as the fourth part of the release version", () => {
    expect(testBuildVersion("1.8.2", 7)).toBe("1.8.2.7");
  });

  it("replaces an existing fourth part instead of adding a fifth", () => {
    expect(testBuildVersion("1.8.2.3", 7)).toBe("1.8.2.7");
  });

  it("rejects a build number Chrome does not accept in a manifest version (0–65535)", () => {
    expect(() => testBuildVersion("1.8.2", 65536)).toThrow(/65535/);
  });

  it("rejects a base version that is not numeric", () => {
    expect(() => testBuildVersion("1.8.2-beta", 1)).toThrow(/1\.8\.2-beta/);
  });
});

describe("nextBuildNumber", () => {
  it("starts at 1 when no build number was stored yet", () => {
    expect(nextBuildNumber(undefined)).toBe(1);
  });

  it("counts on from the stored number", () => {
    expect(nextBuildNumber("41\n")).toBe(42);
  });

  it("starts again at 1 when the stored value is unreadable", () => {
    expect(nextBuildNumber("garbage")).toBe(1);
  });
});

describe("assertReplaceableTarget", () => {
  it("accepts a missing or empty folder", () => {
    expect(() => assertReplaceableTarget("E:/repo/unpacked", undefined)).not.toThrow();
    expect(() => assertReplaceableTarget("E:/repo/unpacked", [])).not.toThrow();
  });

  it("accepts a folder holding a previous extension build", () => {
    expect(() =>
      assertReplaceableTarget("E:/repo/unpacked", ["manifest.json", "sidePanel-import", "build-info.json"]),
    ).not.toThrow();
  });

  it("refuses a folder that is not an extension build, since its whole content gets replaced", () => {
    expect(() => assertReplaceableTarget("E:/repo/unpacked", ["notes.txt"])).toThrow(/E:\/repo\/unpacked/);
  });
});

describe("isSameDirectory", () => {
  it("treats paths that differ only in separators or case as the same folder on Windows", () => {
    expect(isSameDirectory("E:/git/repo/unpacked", "e:\\git\\repo\\unpacked\\", "win32")).toBe(true);
  });

  it("compares case-sensitively elsewhere", () => {
    expect(isSameDirectory("/repo/Unpacked", "/repo/unpacked", "linux")).toBe(false);
  });
});
