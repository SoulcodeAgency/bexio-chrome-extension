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
//
// Grouped titles come from two unrelated systems and only one of them is safe:
//   - the `groups:` in .github/dependabot.yml, which are capped at
//     update-types: [minor, patch], so majors never land in them;
//   - Dependabot *security* updates, which invent their own groups named
//     `npm_and_yarn` / `github_actions`. Those ignore dependabot.yml entirely
//     and CAN contain major bumps.
// The title shape is identical, so the group name itself is the only
// discriminator — hence the allowlist below rather than a shape match.

export type UpdateBucket = "patch" | "minor" | "major" | "group" | "unknown";

// Group names configured in .github/dependabot.yml. An allowlist, not a
// blocklist, so any group name GitHub introduces later fails closed and waits
// for a human. Renaming a group there without renaming it here stops those PRs
// from auto-merging — that file carries a comment saying so.
const AUTO_MERGEABLE_GROUPS: ReadonlySet<string> = new Set(["npm-minor-patch", "actions-minor-patch"]);

interface VersionCore {
  major: number;
  minor: number;
  patch: number;
}

export function classifyDependabotUpdate(title: unknown): UpdateBucket {
  if (typeof title !== "string") return "unknown";
  const trimmed = title.trim();

  // Grouped update PRs: "Bump the <group-name> group with N updates". Checked
  // before the version range on purpose — a security-group title can also carry
  // a "from X to Y" (e.g. "bump next from 15.1.4 to 15.2.3 … in the
  // npm_and_yarn group"), and the range describes one member, not the group.
  const group = trimmed.match(/\bthe\s+(\S+)\s+group\b/i);
  if (group) {
    return AUTO_MERGEABLE_GROUPS.has(group[1].toLowerCase()) ? "group" : "unknown";
  }

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
