# Design: Automate Chrome Web Store publishing via GitHub Actions

**Date:** 2026-05-13
**Status:** Approved (pending written-spec review)
**Tracking issue:** [#32](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/32)
**Author:** brainstorming session (Fabian Gander + Claude)

## Background

Today, every release of the extension to the Chrome Web Store ends with a manual step: `createRelease.ps1` runs locally, builds and zips, then opens the Chrome Web Store dev console URL where a human drags the `.zip` and clicks "Submit for review". That manual step:

- Is error-prone (wrong file, forgotten step, wrong dev-console account).
- Binds releases to whoever has the credentials in their local browser session.
- Doesn't fit a "more agent-driven" workflow where releases should be triggerable without local tooling.

This spec adds a **CI-driven release path** that takes over from "PR merged to `main`" through "extension published on the Chrome Web Store", with no local script required. The existing `createRelease.ps1` path **is preserved unchanged** as a fallback for full manual control.

## Goal

PR merged to `main` → GitHub-hosted CI determines that a release is warranted, bumps versions, regenerates the changelog, batches it all in an auto-maintained "Release PR", waits for that PR to be merged, then builds a clean `unpacked/` + `.zip`, uploads it to the Chrome Web Store API, publishes, and attaches the zip to a GitHub Release as an archival artifact. No local script. No manual upload.

## Non-goals (out of scope for this spec)

- Touching `createRelease.ps1`, `Build.ps1`, `updateManifest.js`, or the existing npm `version:*` scripts. They remain functional, and the manual flow they implement remains supported.
- Auto-publishing on a local-script-pushed tag. The local path stays manual end-to-end; if you use `createRelease.ps1`, you also still manually upload to the dev console at the end.
- A separate "Beta" Chrome Web Store listing / staged-rollout pattern. Parked — the team accepts direct-to-prod risk for internal use (see PR #31 discussion).
- A required-reviewer / GitHub Environment gate before publishing. Not added — `release.published` directly triggers the upload.
- Branch protection rules on `main`. Neither flow needs them; they can be added separately if desired.
- Touching the vestigial `@swc/core` dependency or addressing the 51 pre-existing Dependabot alerts on `main`. Separate triage tasks.
- A commit-message linter / `commitlint`. The conventional-commit hygiene is self-policed via docs.

## Decisions taken during brainstorming

| Question | Decision |
| --- | --- |
| Removal of local script | **No** — keep `createRelease.ps1` and all its supporting scripts unchanged. The new CI path runs in parallel. |
| Release-trigger pattern | **`release-please` (Google)** — opens an auto-maintained "Release PR" on `main` from conventional-commit history; merging the Release PR creates the tag + GitHub Release, which fires the publish workflow. |
| CI runner | `ubuntu-latest` for both workflows. `Build.ps1` is PowerShell-Core-compatible and `pwsh` is preinstalled. |
| Upload action | `mnao305/chrome-extension-upload@v5` (minimal, well-maintained). |
| Publish gate | **No gate** — `release.published` directly triggers the upload + publish. The Release PR review itself is the implicit circuit breaker. |
| Manifest version sync | release-please's `extra-files` with a JSONPath `$.version` updates `packages/chrome-extension/public/manifest.json` in lockstep with `package.json`. |
| `package.json` "date" field | Not synced by the CI path (cosmetic only). `updateManifest.js`'s local-script behaviour is unchanged. |
| Tag format | Bare semver (`1.4.0`), no `v` prefix — matches existing tags `1.3.5`, `1.3.6`, etc. |
| GitHub Release artifact | Yes — the `.zip` is attached to the auto-created Release for archival/rollback. |

## Architecture

### The two coexisting release paths

```
                 ┌───────────────────────────────────────────────────────────┐
                 │ Path A — CI-driven via release-please (new, default)      │
                 │                                                           │
  feature PR ──► │ merge to main                                             │
                 │   ↓                                                       │
                 │ release-please-action: parse conventional commits         │
                 │ since last tag → decide release-worthiness → open or      │
                 │ update the Release PR on main                             │
                 │   ↓ (when you merge the Release PR)                       │
                 │ release-please pushes tag <v> + creates GitHub Release    │
                 │   ↓ (release.published event)                             │
                 │ publish-chrome-web-store workflow:                        │
                 │   checkout tag → npm ci → pwsh Build.ps1 -CreatePackage   │
                 │   → upload + publish to CWS via API → attach zip to       │
                 │   the GitHub Release                                      │
                 └───────────────────────────────────────────────────────────┘

                 ┌───────────────────────────────────────────────────────────┐
                 │ Path B — local script (existing, unchanged fallback)      │
                 │                                                           │
  human runs ──► │ npm run createRelease (PowerShell, local)                 │
                 │   ↓                                                       │
                 │ bumps package.json, runs updateManifest.js,               │
                 │ regenerates CHANGELOG.md, commits "Release: <v>",         │
                 │ tags, merges to main, pushes branches                     │
                 │   ↓                                                       │
                 │ human uploads the zip via the Chrome Web Store dev        │
                 │ console (the script opens the URL for them)               │
                 └───────────────────────────────────────────────────────────┘
```

### Coexistence

The two paths don't conflict. release-please reads commits since the last tag; whatever tag is at HEAD of `main` is its baseline. If the local script tags `1.3.7` and pushes, release-please sees `1.3.7` as latest and starts batching the next version on top of it. If a Release PR was already open when the local script ran, release-please updates the Release PR on the next push to `main` (rebasing onto the local-script commit). Last-write-wins on the manifest/package.json — no race.

Recommendation in the docs: pick one path per release and stick with it; don't interleave them mid-release.

### release-please core concept (one paragraph for the unfamiliar)

release-please does not push commits or tags to `main` directly. It maintains a Pull Request (its own auto-updating branch, `release-please--branches--main`) whose diff contains: the version bump in `package.json`, the version bump in the manifest, an appended section in `CHANGELOG.md`, and an updated `.release-please-manifest.json`. The PR is open as long as there are unreleased commits with `feat:` / `fix:` / `BREAKING CHANGE:` semantics. New commits to `main` cause release-please to *amend* its PR (re-titled with the new computed version if needed, re-generated changelog). When you merge that PR, the merge commit on `main` is what release-please tags and creates a GitHub Release for. The merge is your single review-and-approve moment per release.

### File layout (created or modified by this spec)

**Created:**

- `.github/workflows/release-please.yml` — the release-please orchestrator (runs `googleapis/release-please-action@v4` on every push to `main`).
- `.github/workflows/publish-chrome-web-store.yml` — the CWS uploader (triggered on `release.published` and `workflow_dispatch`).
- `release-please-config.json` — release-please configuration (release type, manifest-version `extra-files` entry, tag-style flags).
- `.release-please-manifest.json` — release-please's per-package version-tracking file (seeded with the current `1.3.5` from `main`).
- `docs/architecture/publishing.md` — canonical docs for both release paths.

**Modified:**

- `RELEASE.md` — reframed at the top with the two-paths note + a short "automatic" section above the existing "manual" section (preserved verbatim).
- `CLAUDE.md` — one-line addition in the "Releases" paragraph pointing at `docs/architecture/publishing.md`.
- `docs/architecture/build-and-release.md` — one-paragraph cross-link to `publishing.md` (this file was added by the test-harness work; the CWS work piggybacks on it once both PRs land).

**Untouched (verified preserved):** `createRelease.ps1`, `Build.ps1`, `updateManifest.js`, all `version:*` / `build:*` npm scripts, manifest.json structure, all `packages/*` workspaces.

### `release-please.yml` (orchestrator)

```yaml
name: release-please
on:
  push:
    branches: [main]

permissions:
  contents: write          # to push the Release PR's commits + create the tag
  pull-requests: write     # to open/update the Release PR

jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - uses: googleapis/release-please-action@v4
        with:
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json
          token: ${{ secrets.GITHUB_TOKEN }}
```

Uses the default `GITHUB_TOKEN` — no Personal Access Token, no GitHub App, because we are not bypassing branch protection (Section "Risks" expands on this).

### `publish-chrome-web-store.yml` (CWS upload)

```yaml
name: publish-chrome-web-store
on:
  release:
    types: [published]
  workflow_dispatch:
    inputs:
      tag:
        description: Tag to (re)publish (e.g. 1.4.0). Required for workflow_dispatch.
        required: true
      publish:
        description: Actually publish to the public CWS (vs upload-only smoke test)?
        type: boolean
        default: true

permissions:
  contents: write           # to upload the zip onto the GitHub Release as an artifact

concurrency:
  group: chrome-web-store-publish
  cancel-in-progress: false  # queue subsequent runs rather than killing in-flight ones

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.inputs.tag || github.ref }}

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - run: npm ci --workspaces --include-workspace-root

      - name: Build & package
        run: pwsh -File ./Build.ps1 -CreatePackage

      - name: Upload + publish to Chrome Web Store
        uses: mnao305/chrome-extension-upload@v5
        with:
          file-path: dist/bexio-chrome-extension.zip
          extension-id: ${{ secrets.CWS_EXTENSION_ID }}
          client-id: ${{ secrets.CWS_CLIENT_ID }}
          client-secret: ${{ secrets.CWS_CLIENT_SECRET }}
          refresh-token: ${{ secrets.CWS_REFRESH_TOKEN }}
          publish: ${{ github.event.inputs.publish != 'false' }}

      - name: Attach zip to the GitHub Release
        if: github.event_name == 'release'
        run: gh release upload "${{ github.event.release.tag_name }}" dist/bexio-chrome-extension.zip --clobber
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Notes:

- `pwsh -File ./Build.ps1 -CreatePackage` — invokes the existing build script via PowerShell Core (preinstalled on `ubuntu-latest`). The script is already PS-Core compatible.
- `workflow_dispatch` exists for two reasons: (a) first-ever smoke test before relying on the auto-trigger; (b) manual recovery (re-run for a given tag) if the auto-triggered upload failed.
- `Build.ps1` is known to swallow sub-build errors in its `catch` blocks (KNOWN ISSUE flagged in the test-harness work). If the build fails silently, the *next* step (the CWS upload) fails loudly because the zip will be missing or invalid. Acceptable trade-off; not worth a `Build.ps1` rework in this spec.

### `release-please-config.json`

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "release-type": "node",
  "include-component-in-tag": false,
  "include-v-in-tag": false,
  "packages": {
    ".": {
      "package-name": "@bexio-chrome-extension/main",
      "extra-files": [
        {
          "type": "json",
          "path": "packages/chrome-extension/public/manifest.json",
          "jsonpath": "$.version"
        }
      ]
    }
  }
}
```

- `release-type: node` — read/write `package.json` `version` field using npm conventions; matches `createRelease.ps1`'s use of `npm version`.
- `include-v-in-tag: false` — tags stay bare (`1.4.0`), matching the existing `1.3.5` / `1.3.6` style.
- `include-component-in-tag: false` — single-package repo from release-please's POV; the workspace `package.json` files in `packages/*` are not managed by release-please.
- `extra-files` — keep the manifest version in lockstep via JSONPath `$.version`.

### `.release-please-manifest.json`

```json
{
  ".": "1.3.5"
}
```

Seeded with the version currently on `main` (`a36d5cc`'s `package.json` says `1.3.5`). If `main` advances past that before this PR lands (e.g. a `Release: 1.3.6` lands first), update the seed to whatever the current value is. release-please will maintain this file from then on.

### Conventional-commit semantics summary

| Commit prefix examples | Bump |
| --- | --- |
| `feat: …`, `feat(scope): …` | minor (e.g. `1.3.5` → `1.4.0`) |
| `fix: …`, `fix(scope): …` | patch (e.g. `1.3.5` → `1.3.6`) |
| `feat!: …`, `fix!: …`, footer `BREAKING CHANGE: …` | major (e.g. `1.3.5` → `2.0.0`) |
| `chore:`, `docs:`, `test:`, `refactor:`, `style:`, `ci:`, `build:`, `perf:` | no release |
| Anything not starting with a recognized prefix | no release (silent) |

Scoped variants (`fix(release):`, `feat(side-panel):`) work identically to their unscoped form. **Non-conventional commits are silently treated as "no release"** — relevant for spotting the "I merged a feature, why didn't the Release PR appear?" failure mode.

**Forcing a specific version:** add a `Release-As: 2.0.0` footer line to any commit message. release-please respects it on the next Release PR.

## One-time setup procedure (CWS API credentials)

Four GitHub Actions secrets must be present before the publish workflow can succeed:

| Secret | Source |
| --- | --- |
| `CWS_EXTENSION_ID` | already known: `nbmjdligmcfaeebdihmgbdpahdfddlhm` |
| `CWS_CLIENT_ID` | OAuth client ID from Google Cloud (step 3 below) |
| `CWS_CLIENT_SECRET` | OAuth client secret from Google Cloud (step 3 below) |
| `CWS_REFRESH_TOKEN` | long-lived refresh token from the one-time OAuth flow (step 4 below) |

Procedure (run once, with the implementation plan; documented in `publishing.md`):

1. **Pick the Google account that owns the credentials** — must have at least "Editor" on the existing CWS listing. Stay signed in to it.
2. **Create or pick a Google Cloud project** at `console.cloud.google.com` → enable the **Chrome Web Store API** (APIs & Services → Library).
3. **Create an OAuth 2.0 client** of type **Desktop app** (APIs & Services → Credentials → Create credentials). The first time, configure the consent screen (External, app name "Soulcode CWS Publisher", add self as test user). Copy the resulting Client ID + Secret.
4. **Get the refresh token:** `npx --yes chrome-webstore-upload-keys` — provide the client id + secret when prompted, approve in the browser tab it opens, copy the printed refresh token. (Behind the scenes: standard OAuth flow with the `https://www.googleapis.com/auth/chromewebstore` scope.)
5. **Add all four values to repo secrets:** Settings → Secrets and variables → Actions → "New repository secret", four times, names matching exactly.
6. **Smoke test:** Actions tab → `publish-chrome-web-store` → "Run workflow" → enter the current latest tag (e.g. `1.3.5`) and set `publish: false`. The workflow uploads as a draft visible only in the dev console. Verify the draft, then either discard it or publish manually from the dev console. Once that works, the next real `release.published` event will run the full automated flow.

**Recovery if the refresh token is later revoked:** re-run step 4, update the `CWS_REFRESH_TOKEN` secret. The other three stay valid.

## Documentation deliverables

### New: `docs/architecture/publishing.md`

Canonical doc covering both release paths. Must include:

- **The two paths, side by side** — a comparison table (trigger / version control / manual steps / CWS upload automation / when to use), positioning the CI path as default and the local script as fallback.
- **The Release-PR walkthrough** — the 5-step "what you'll see in practice" sequence (merge feature PR → release-please opens Release PR → more PRs amend it → click Merge → tag + Release + publish workflow fires).
- **Conventional commits primer** — the table above plus a sentence on scopes and the silent-no-release rule.
- **Forcing a specific version** — `Release-As: <version>` footer override with a worked example.
- **One-time setup procedure** — the four-ingredient table and the six numbered steps verbatim from above; the refresh-token-revoked recovery note.
- **Manual recovery / re-publish** — using `workflow_dispatch` to re-run for a specific tag, with the `publish: false` smoke-test mode.
- **The local-script path** — brief description, link to `RELEASE.md`, explicit note that this path **still requires manual CWS upload** (it doesn't trigger the publish workflow because it doesn't create a GitHub Release).
- **Coexistence notes** — "pick one path per release" recommendation; what happens if both run in the same window (last-write-wins on manifest/package.json, no race).
- **Known limitations** — the few-minute lag between `main` commits and Release PR amendment; CWS go-live latency is Google's queue, not ours; the `package.json` "date" field is not maintained by the CI path (cosmetic only).

### Modified: `RELEASE.md`

Reframed at the top: "Two ways to release: the automatic CI path (preferred) and the manual local-script path (fallback). See `docs/architecture/publishing.md` for the full picture; this file is the day-to-day cheat sheet." Followed by a short "Automatic" section (~5 lines: PRs merge to `main`, a Release PR appears, click Merge when ready, publish is hands-free) and the **existing manual section retained verbatim** below it, prefixed with "Use this when you need to bypass the automated flow…".

### Modified: `CLAUDE.md`

One-line addition to the "Releases" paragraph: "For the automated CI path (recommended), see `docs/architecture/publishing.md`."

### Modified: `docs/architecture/build-and-release.md` *(from the test-harness PR)*

One-paragraph cross-link to `publishing.md` near the top, noting that this file describes the *build* and the local-script release flow; the *automated* release flow has its own doc. No content duplication.

## Risks & open items

1. **First-run validation depends on the four secrets existing before any release-worthy PR merges.** If a `feat:` PR is merged to `main` before the secrets are set, release-please opens a Release PR happily but the eventual publish workflow fails at the upload step. Mitigation: the implementation plan sequences "configure secrets" *before* "merge anything release-worthy", and `publishing.md` calls this out. Failure mode is loud and recoverable (`workflow_dispatch` retry once secrets are set).
2. **Branch protection on `main` is absent today and would need to be configured carefully.** Neither flow requires it. If added later: release-please pushes its Release PR commits to its own branch (`release-please--branches--main`), so a "no direct pushes to `main`" rule is fine. A "require status checks" rule that demands `publish-chrome-web-store` pass would be incorrect (that workflow runs *after* merge, not before).
3. **Conventional-commits discipline is not enforced.** Non-conventional commits silently produce "no release". The team self-polices per the docs. If this proves painful, a follow-up spec can add `commitlint` — explicitly deferred here to avoid friction for external contributors.
4. **`updateManifest.js` and release-please both write the manifest version.** Different code paths, same destination. Last-write-wins on overlap; no coordination needed.
5. **CWS review queue is opaque.** `publish: true` returns success once the upload + publish-request lands; the actual transition to live is queued by Google. Usually minutes for an established listing, occasionally hours, very occasionally rejected (e.g. new permissions). Not surfaced in CI — "watch your email + the dev console" remains a thing.
6. **The first-ever upload to a brand-new CWS listing isn't supported by the API.** Doesn't affect us (existing listing). Noting it for the future "beta listing" spec.
7. **The vestigial `@swc/core` dependency** (flagged in the test-harness review) is unrelated and stays untouched. If it's actually broken it'll show up in the build smoke test the publish workflow effectively re-runs.

## Deliverables checklist

- [ ] `.github/workflows/release-please.yml` per the snippet above.
- [ ] `.github/workflows/publish-chrome-web-store.yml` per the snippet above.
- [ ] `release-please-config.json` + `.release-please-manifest.json` per the snippets above (seed manifest from current `main` version at implementation time).
- [ ] `docs/architecture/publishing.md` covering everything in "Documentation deliverables".
- [ ] `RELEASE.md` reframed; existing manual section retained verbatim.
- [ ] `CLAUDE.md` one-line cross-link added.
- [ ] (After the test-harness PR lands) `docs/architecture/build-and-release.md` cross-link paragraph.
- [ ] One-time OAuth setup completed by the listing owner; four secrets configured in repo settings.
- [ ] `workflow_dispatch` smoke test against the current latest tag, `publish: false` — passes.
- [ ] Issue #32 closed by the implementation PR.
