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
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "x", version: "9.9.9", date: "Jan 1, 2000" }, null, 2),
    );
    mkdirSync(join(dir, "packages", "chrome-extension", "public"), { recursive: true });
    writeFileSync(
      join(dir, "packages", "chrome-extension", "public", "manifest.json"),
      JSON.stringify({ name: "m", version: "0.0.0", manifest_version: 3 }, null, 4),
    );
    // The script uses `fs-extra`, which lives in the repo's node_modules; run with cwd=dir but
    // NODE_PATH pointing at the repo node_modules so the require resolves.
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("copies package.json version into manifest.json and stamps today's date into package.json", () => {
    execFileSync(process.execPath, [SCRIPT], {
      cwd: dir,
      env: { ...process.env, NODE_PATH: resolve(__dirname, "../../../node_modules") },
    });
    const manifest = JSON.parse(readFileSync(join(dir, "packages", "chrome-extension", "public", "manifest.json"), "utf8"));
    expect(manifest.version).toBe("9.9.9");
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    // date format: en-US "MMM D, YYYY" — just assert it changed away from the sentinel and parses.
    expect(pkg.date).not.toBe("Jan 1, 2000");
    expect(Number.isNaN(Date.parse(pkg.date))).toBe(false);
  });

  it("only rewrites the version field, leaving other manifest fields intact", () => {
    execFileSync(process.execPath, [SCRIPT], {
      cwd: dir,
      env: { ...process.env, NODE_PATH: resolve(__dirname, "../../../node_modules") },
    });
    const manifest = JSON.parse(readFileSync(join(dir, "packages", "chrome-extension", "public", "manifest.json"), "utf8"));
    expect(manifest.name).toBe("m");
    expect(manifest.manifest_version).toBe(3);
  });
});
