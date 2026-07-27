import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "../../../");
const UNPACKED = resolve(REPO, "unpacked");

// Windows PowerShell on Windows, PowerShell Core elsewhere. The npm scripts hardcode
// `powershell`, which does not exist on Linux/macOS, so the build is invoked directly.
const PS_EXE = process.platform === "win32" ? "powershell" : "pwsh";

function hasPowerShell(): boolean {
  try {
    execFileSync(PS_EXE, ["-Command", "$PSVersionTable.PSVersion.Major"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe.skipIf(!hasPowerShell())("build smoke test", () => {
  it("produces a valid unpacked/ extension", () => {
    rmSync(UNPACKED, { recursive: true, force: true });
    // Runs Build.ps1 → vite build (dev mode) for both packages.
    execFileSync(PS_EXE, ["-File", resolve(REPO, "Build.ps1"), "-Development"], {
      cwd: REPO,
      stdio: "inherit",
    });

    // 1) manifest exists and parses
    const manifestPath = resolve(UNPACKED, "manifest.json");
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

    // 2) version matches root package.json
    const rootPkg = JSON.parse(readFileSync(resolve(REPO, "package.json"), "utf8"));
    expect(manifest.version).toBe(rootPkg.version);

    // 3) every file the manifest references exists in unpacked/
    const referenced: string[] = [];
    for (const cs of manifest.content_scripts ?? []) {
      for (const j of cs.js ?? []) referenced.push(j);
      for (const c of cs.css ?? []) referenced.push(c);
    }
    if (manifest.background?.service_worker) referenced.push(manifest.background.service_worker);
    for (const rel of referenced) {
      const p = resolve(UNPACKED, rel.replace(/^\//, ""));
      expect(existsSync(p), `manifest references missing file: ${rel}`).toBe(true);
    }

    // 4) the side panel built
    expect(existsSync(resolve(UNPACKED, "sidePanel-import", "index.html")), "sidePanel-import/index.html missing").toBe(true);
  }, 180_000); // generous timeout for two Vite builds
});
