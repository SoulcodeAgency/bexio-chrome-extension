import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPT = resolve(__dirname, "../../../updateManifest.js"); // repo-root updateManifest.js

describe("updateManifest.js", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "bexio-um-"));
    // Replicate the directory layout the script expects.
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x", version: "9.9.9" }, null, 2));
    mkdirSync(join(dir, "packages", "chrome-extension", "public"), { recursive: true });
    writeFileSync(
      join(dir, "packages", "chrome-extension", "public", "manifest.json"),
      JSON.stringify({ name: "m", version: "0.0.0", manifest_version: 3 }, null, 4),
    );
    writeFileSync(join(dir, ".release-please-manifest.json"), '{\n  ".": "0.0.0"\n}\n');
    // The script uses `fs-extra`, which lives in the repo's node_modules; run with cwd=dir but
    // NODE_PATH pointing at the repo node_modules so the require resolves.
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("copies package.json version into manifest.json", () => {
    execFileSync(process.execPath, [SCRIPT], {
      cwd: dir,
      env: { ...process.env, NODE_PATH: resolve(__dirname, "../../../node_modules") },
    });
    const manifest = JSON.parse(
      readFileSync(join(dir, "packages", "chrome-extension", "public", "manifest.json"), "utf8"),
    );
    expect(manifest.version).toBe("9.9.9");
  });

  // It used to stamp a "date" field into package.json. Only the manual release path runs this
  // script, so every release-please release left the date stale (1.4.0 to 1.9.0 all said
  // "Jan 5, 2026"). The date is now stamped at build time - scripts/build-date/buildDate.ts.
  it("leaves package.json untouched", () => {
    const before = readFileSync(join(dir, "package.json"), "utf8");
    execFileSync(process.execPath, [SCRIPT], {
      cwd: dir,
      env: { ...process.env, NODE_PATH: resolve(__dirname, "../../../node_modules") },
    });
    expect(readFileSync(join(dir, "package.json"), "utf8")).toBe(before);
  });

  it("copies package.json version into .release-please-manifest.json", () => {
    execFileSync(process.execPath, [SCRIPT], {
      cwd: dir,
      env: { ...process.env, NODE_PATH: resolve(__dirname, "../../../node_modules") },
    });
    const releasePleaseManifest = JSON.parse(readFileSync(join(dir, ".release-please-manifest.json"), "utf8"));
    expect(releasePleaseManifest["."]).toBe("9.9.9");
  });

  it("does not fail when .release-please-manifest.json is absent", () => {
    rmSync(join(dir, ".release-please-manifest.json"));
    expect(() =>
      execFileSync(process.execPath, [SCRIPT], {
        cwd: dir,
        env: { ...process.env, NODE_PATH: resolve(__dirname, "../../../node_modules") },
      }),
    ).not.toThrow();
    const manifest = JSON.parse(
      readFileSync(join(dir, "packages", "chrome-extension", "public", "manifest.json"), "utf8"),
    );
    expect(manifest.version).toBe("9.9.9");
  });

  it("only rewrites the version field, leaving other manifest fields intact", () => {
    execFileSync(process.execPath, [SCRIPT], {
      cwd: dir,
      env: { ...process.env, NODE_PATH: resolve(__dirname, "../../../node_modules") },
    });
    const manifest = JSON.parse(
      readFileSync(join(dir, "packages", "chrome-extension", "public", "manifest.json"), "utf8"),
    );
    expect(manifest.name).toBe("m");
    expect(manifest.manifest_version).toBe(3);
  });
});
