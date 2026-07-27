// Deterministic semver classifier for Dependabot PR titles. The
// dependabot-auto-merge workflow calls this to decide whether a green PR may
// merge itself: patch / minor / group -> auto-merge; major / unknown -> leave
// for a human. It lives in its own file rather than inline in workflow bash so
// that the one piece with real branching logic can be unit-tested.
//
// Run directly with `node scripts/classify-dependabot-update.ts "<title>"`.
// Node strips the types natively (Node 22.18+/24), so there is no build step —
// the workflow pins Node 24 for that reason.
//
// Title shapes Dependabot emits:
//   single  "Bump <name> from 1.2.3 to 1.2.4"  (and lowercase "bump …")
//   grouped "Bump the <group-name> group with N updates"
//           "Bump the <group-name> group across N directories with M updates"
// Grouping is configured to bundle only minor+patch (majors excluded), so the
// `group` bucket is safe to auto-merge — see .github/dependabot.yml.

export type UpdateBucket = "patch" | "minor" | "major" | "group" | "unknown";

interface VersionCore {
  major: number;
  minor: number;
  patch: number;
}

export function classifyDependabotUpdate(title: unknown): UpdateBucket {
  if (typeof title !== "string") return "unknown";
  const trimmed = title.trim();

  // Grouped update PRs: "Bump the <group-name> group with N updates".
  if (/\bthe\s+\S+\s+group\b/i.test(trimmed)) return "group";

  // Single-package bump: "Bump <name> from <from> to <to>".
  const match = trimmed.match(/\bfrom\s+v?(\S+)\s+to\s+v?(\S+)/i);
  if (!match) return "unknown";

  const from = parseVersion(match[1]);
  const to = parseVersion(match[2]);
  if (!from || !to) return "unknown";

  if (to.major !== from.major) return "major";
  if (to.minor !== from.minor) return "minor";
  return "patch";
}

// Parse the major/minor/patch core of a version, ignoring any prerelease or
// build suffix. Returns null if the numeric core can't be read.
function parseVersion(raw: string): VersionCore | null {
  const core = raw.split(/[-+]/)[0];
  const parts = core.split(".");
  const nums = parts.map((p) => Number.parseInt(p, 10));
  if (nums.length === 0 || nums.some((n) => Number.isNaN(n))) return null;
  return { major: nums[0] ?? 0, minor: nums[1] ?? 0, patch: nums[2] ?? 0 };
}

// CLI entry point: prints the bucket on stdout for the workflow to capture.
// import.meta.main is Node 24+; the fallback keeps this working if the script
// is ever run on an older runtime.
const isMain =
  (import.meta as { main?: boolean }).main ??
  (process.argv[1]?.endsWith("classify-dependabot-update.ts") || false);

if (isMain) {
  process.stdout.write(classifyDependabotUpdate(process.argv[2] ?? ""));
}
