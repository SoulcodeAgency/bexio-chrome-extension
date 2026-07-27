# Publishing the extension

This file is the canonical documentation for how releases reach the Chrome Web Store. There are **two release paths**, both supported. Pick one per release and don't interleave them mid-release.

## The two paths at a glance

| | Automatic (CI) | Manual (local script) |
| --- | --- | --- |
| Trigger | Merge a Release PR on `main` | Run `npm run createRelease` locally |
| Who bumps the version | `release-please` — always a minor bump (see below) | The human running the script (picks patch/minor/major interactively) |
| Who regenerates `CHANGELOG.md` | `release-please` (from conventional commits) | `git-cliff` invoked by the script |
| Who syncs `manifest.json` version | `release-please` `extra-files` JSONPath | `updateManifest.js` invoked by the script |
| Who builds & zips | The publish workflow on `ubuntu-latest` | The human's local machine |
| CWS upload | Automatic via the Chrome Web Store API | Manual: drag-and-drop into the dev console |
| GitHub Release with `.zip` attached | Yes, automatically | No |
| When to use | Default. Almost always. | Bypass / emergency / debugging CI |

## The automatic path — release-please

### The Release PR concept (read this first)

`release-please` does **not** push commits or tags directly to `main`. It maintains a single Pull Request whose diff contains the version bump in `package.json`, the matching version bump in `packages/chrome-extension/public/manifest.json`, an appended section in `CHANGELOG.md`, and an updated `.release-please-manifest.json`. The PR sits open as long as there are unreleased release-worthy commits on `main`.

New commits to `main` cause `release-please` to **amend the same PR** — it doesn't open new ones. The PR title shows the computed next version. When you merge the Release PR, the merge commit is what `release-please` tags and creates a GitHub Release for. Merging the Release PR is your single review-and-approve moment per release.

### What you'll see in practice

1. You merge a feature PR with a conventional-commit message (e.g. `feat: add automapper score export`) to `main`.
2. Within a minute or two, `release-please` opens a PR titled something like `chore(main): release 1.4.0`. Its diff is the version bump + changelog + manifest sync.
3. More PRs merged to `main` over the following days — `release-please` edits the same Release PR to include the new changes. The PR is your continuously-updated "what's about to ship".
4. When you're ready: review the Release PR, click Merge.
5. The merge commit triggers `release-please` to push the tag (e.g. `1.4.0`) and create a GitHub Release. The Release-published event fires `publish-chrome-web-store.yml`, which builds the extension, uploads it to the CWS API, publishes it, and attaches the zip to the GitHub Release as an artifact.

### Conventional commits: what triggers a release

**Every store release is a minor bump** — `1.3.5` → `1.4.0` → `1.5.0` → … This is set by `"versioning": "always-bump-minor"` in `release-please-config.json`. Commit types decide *whether* a release happens and how the changelog is grouped; they no longer decide the size of the bump.

| Commit prefix | Effect |
| --- | --- |
| `feat: …`, `feat(scope): …` | release, listed under "Features" |
| `fix: …`, `fix(scope): …` | release, listed under "Bug Fixes" |
| `feat!: …`, `fix!: …`, or any commit with a `BREAKING CHANGE:` footer | release, flagged as breaking in the changelog — still a minor bump. Use `Release-As: 2.0.0` if a breaking change deserves a major |
| `chore:`, `docs:`, `test:`, `refactor:`, `style:`, `ci:`, `build:`, `perf:` | no release |
| Anything not starting with a recognized prefix | no release (silent) |

Scoped variants (`fix(release):`, `feat(side-panel):`) work identically to their unscoped form. Note that scope does **not** exempt a commit from triggering a release: `fix(test):` is still a `fix` and will open a Release PR. Use `test:` or `chore(test):` for test-only work.

**Why always-minor:** patch numbers are reserved for local dev builds (`npm run build:devRelease` bumps the patch on your machine so you can tell loaded unpacked builds apart — never commit that bump). The store version is the only version that matters, and it moves in minors. Individual fixes are still listed by name in the changelog under the minor's heading. To go back to standard semver, remove the `versioning` line — the change is not retroactive.

**Silent-no-release warning:** if you merge a feature using a non-conventional commit message (or `chore:` by mistake), no Release PR will appear. Look at the message before merging. If you've already merged and want a release anyway, add an empty `feat:` or `fix:` commit to `main` ("nudge commit") — `release-please` will pick it up on the next push.

### Forcing a specific version (`Release-As`)

Add a `Release-As: <version>` footer to any commit message and merge it. `release-please` respects it and bumps to exactly that version on the next Release PR. Example:

```
chore: prepare 2.0.0 rebrand

Release-As: 2.0.0
```

### Manual recovery / re-publish

If the auto-triggered `publish-chrome-web-store` workflow fails (CWS API hiccup, expired secret, etc.) after a Release PR merge, re-run it manually:

1. GitHub repo → Actions → `publish-chrome-web-store` → "Run workflow".
2. Enter the tag (e.g. `1.4.0`) and leave `publish: true`.
3. Run. The workflow checks out the tag, rebuilds, re-uploads, re-publishes.

For a dry run (e.g. validating credentials, smoke testing changes to the workflow): same procedure with `publish: false`. The zip uploads to CWS as a draft visible only in the dev console; nothing goes live.

## The manual path — `createRelease.ps1`

Unchanged from the long-standing release flow. See `RELEASE.md` for the step-by-step. **Important:** this path still requires manually uploading the produced `dist/bexio-chrome-extension.zip` via the Chrome Web Store dev console — it does **not** trigger the `publish-chrome-web-store` workflow (because it doesn't create a GitHub Release).

Use this when you need to bypass the automated flow: emergency releases, debugging the CI workflow, or releasing without conventional-commit hygiene.

## Coexistence

The two paths don't conflict. `release-please` tracks the latest git tag on `main` and computes the next version on top of it, whatever produced that tag. If `createRelease.ps1` tagged `1.3.7` and pushed, `release-please` will batch the next minor on top of `1.3.7` (i.e. `1.4.0`) in its next Release PR. If a Release PR was already open when the local script ran, `release-please` will update the Release PR on the next push to `main` (rebasing onto the local-script commit). `manifest.json` and `package.json` are last-write-wins on overlap — no race condition, just whichever path finalises last.

Recommendation: pick one path per release and stick with it.

## One-time setup (required before the first CI release)

> Prefer to work through this as a tick-off list in German? See `docs/architecture/publishing-setup.de.md` — same steps, checklist form.

Four GitHub Actions secrets must be configured in repo settings → Secrets and variables → Actions:

| Secret | What it is | Source |
| --- | --- | --- |
| `CWS_EXTENSION_ID` | The CWS listing id | `nbmjdligmcfaeebdihmgbdpahdfddlhm` (public) |
| `CWS_CLIENT_ID` | OAuth client id | Step 3 below |
| `CWS_CLIENT_SECRET` | OAuth client secret | Step 3 below |
| `CWS_REFRESH_TOKEN` | Long-lived OAuth refresh token | Step 4 below |

Procedure (run once, by the listing owner):

1. **Pick the Google account that owns the credentials.** It needs at least the **Item Manager** role on the CWS listing (the four roles are Viewer, Item Manager, Editor, Admin; Item Manager is enough to upload packages). Stay signed in to it for every step below — client id, secret and refresh token must all originate from this one account, or the upload fails on permissions. Use a function account (e.g. `dev@…`) rather than a personal one: the Chrome Web Store API does not support service accounts, so the pipeline permanently depends on this human account existing.
2. **Create or pick a Google Cloud project** at `https://console.cloud.google.com/`. Enable the **Chrome Web Store API**: APIs & Services → Library → search "Chrome Web Store API" → Enable.
3. **Configure the consent screen**, then **create an OAuth 2.0 client** of type **Desktop app**. Both live under **Google Auth Platform** (`console.cloud.google.com/auth/overview`) in the current console.
   - Consent screen: app name (e.g. "Soulcode CWS Publisher"), support + contact email, user type **External** ("Internal" requires a Google Cloud Organization and is unavailable here).
   - **Then set the publishing status to "In production"** (Audience → "Publish app"). This is not optional: with user type External and status "Testing", Google issues refresh tokens that **expire after 7 days**, so the pipeline would start failing with a 401 a week later. Publishing does not make the app discoverable — there is no directory of OAuth clients, and it is unusable without the client id *and* secret.
   - Client: Clients → "Create client" → type **Desktop app** (*not* "Chrome extension" — that type is for an extension authenticating end users). Name it e.g. "cws-publisher (GitHub Actions)".
   - **Download the JSON immediately.** The client secret is shown only once. A lost secret can be regenerated on the same client, but not recovered.
4. **Get the refresh token.** Easiest via the `chrome-webstore-upload-keys` CLI:

   ```bash
   npx --yes chrome-webstore-upload-keys
   ```

   It will ask for the client id + secret, open a browser tab on a Google consent page, and print the refresh token to your terminal. Two things to watch: **check which account the consent screen is using** (it must be the account from step 1 — easy to get wrong with several Google accounts in one browser), and expect the **"Google hasn't verified this app"** warning — click "Advanced" → "Go to … (unsafe)". The app is unverified because it is only ever used internally; verification is not required for that.
5. **Add all four values to repo secrets.** GitHub repo → Settings → Secrets and variables → Actions → "New repository secret", four times, names matching exactly: `CWS_EXTENSION_ID`, `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`.
6. **Smoke test — credentials only.** Actions tab → `publish-chrome-web-store` → "Run workflow" → current latest tag, `publish: false`.

   Note the ordering: GitHub only registers workflows that exist on the **default branch**, so neither workflow is dispatchable until the branch carrying them has merged to `main`. This step therefore comes *after* the merge, not before.

   Note what this can and cannot prove. The CWS API rejects any upload whose manifest version is not **higher** than the published one ("If you have not increased the version field in your extension's manifest file, this will fail"), and the latest tag by definition carries the published version. So a full dry run is not possible — but the failure mode is still informative:

   - **401 / 403 from Google** → one of the four secrets is wrong, or the API was enabled in a different project.
   - **An error about the version number** → the credentials work. That is the result you want here.

   The first genuine end-to-end upload therefore happens on the first real release.

### What if the refresh token gets revoked?

If the OAuth app's access is revoked (account password change, security policy, manual revoke), the workflow starts failing with a 401 from Google. Recovery: re-run step 4 to get a fresh refresh token, update the `CWS_REFRESH_TOKEN` secret. The other three secrets stay valid.

## Known limitations

- **Few-minute lag.** `release-please` runs on each push to `main`; there's a typical 30s–2min delay between a `feat:`/`fix:` merge landing and the Release PR being updated.
- **CWS go-live is queued by Google.** `publish: true` returns success once the upload + publish-request lands; the actual transition to live can take minutes to hours, and very rarely is rejected (e.g. new permissions trigger a review). The workflow can't detect rejection — watch your email and the dev console.
- **`package.json` "date" field is not maintained by the CI path.** It's a cosmetic field updated by `updateManifest.js` in the local-script path; the CI path leaves it stale. If this ever matters, we can add a workflow step that runs `node updateManifest.js` after the version bump.
- **`Build.ps1` swallows errors.** A `Compress-Archive` failure inside its `try/catch` produces a misleading "FAILED" line but lets the script return success; the next CI step (the CWS upload) will surface the real failure because the zip won't exist or will be malformed. Known issue from the test-harness work; not addressed here.

## Quick reference: commands

```bash
# Trigger an automatic release
# (no command — merge feature PRs to main, then merge the auto-opened Release PR.)

# Run the manual release flow locally
npm run createRelease

# Manually re-trigger the publish workflow for a specific tag
gh workflow run publish-chrome-web-store.yml \
  -f tag=1.4.0 \
  -f publish=true

# Credentials check (upload-only; expected to fail on the version number, see "Smoke test" above)
gh workflow run publish-chrome-web-store.yml \
  -f tag=1.3.5 \
  -f publish=false
```

## Related files

- `.github/workflows/release-please.yml` — orchestrator
- `.github/workflows/publish-chrome-web-store.yml` — CWS uploader
- `release-please-config.json` — release-please packages + extra-files config
- `.release-please-manifest.json` — release-please's per-package version tracker
- `RELEASE.md` — day-to-day cheat sheet for both paths
- `createRelease.ps1`, `Build.ps1`, `updateManifest.js` — the local-script path
- `docs/architecture/build-and-release.md` — the build pipeline behind both paths, plus the manual release sequence in detail
- `docs/architecture/publishing-setup.de.md` — the one-time setup as a German checklist
- Spec: `docs/superpowers/specs/2026-05-13-cws-publishing-automation-design.md`
- Tracking issue: [#32](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/32)
