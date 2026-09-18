# How to make a new release

**Two ways to release.** The automatic CI path is the default; the manual local-script path is preserved as a fallback. Pick one per release — don't interleave. See `docs/architecture/publishing.md` for the full picture; this file is the day-to-day cheat sheet.

## Automatic — via `release-please` (preferred)

The short version:

1. **Never change a version by hand** — not in `package.json`, not in `manifest.json`. `release-please` does that.
2. **A release is one action:** merging the Release PR.
3. Everything after that runs on its own: tag, GitHub Release, build, upload to the Chrome Web Store.
4. The Release PR **stays open** until you actually want to ship. It collects every change in the meantime.

### How `release-please` behaves

It runs on **every push to `main`** and reads the commit messages since the last release.

| Commit starts with                                                          | What happens                        |
| --------------------------------------------------------------------------- | ----------------------------------- |
| `feat:` or `fix:` (scoped too, e.g. `fix(side-panel):`)                     | the Release PR is opened or updated |
| `chore:`, `docs:`, `test:`, `refactor:`, `style:`, `ci:`, `build:`, `perf:` | nothing — no release                |
| anything else                                                               | nothing — and nothing warns you     |

- There is only ever **one** Release PR, titled `chore(main): release <version>`. New changes on `main` land in that same PR.
- Its diff: the new version in `package.json`, `manifest.json` and `.release-please-manifest.json`, plus the new section in `CHANGELOG.md`.
- **Every release is a minor bump** — `1.9.0` → `1.10.0` → `1.11.0`. For a major, put `Release-As: 2.0.0` in a commit body. Test builds are told apart by a fourth version part that `npm run build:test` writes into the build output only, so no tracked version ever changes for them.
- **No Release PR open** means there has been no `feat:` and no `fix:` since the last release. That is the normal state right after a release.
- `feat:` and `fix:` are reserved for changes that **reach the user**. A fix to CI, tests or docs is `ci:`, `test:` or `docs:` — otherwise a build without any change goes to the store (that is how 1.4.0 and 1.5.0 came about).

### Step 1 — Land a change on `main`

Repeat as often as you like before shipping.

- [ ] The PR title and the commits follow the table above.
- [ ] Make a test build and check it in the browser:

  ```bash
  npm run build:test
  ```

  Click reload on chrome://extensions. It must show the four-part version the command printed (e.g. `1.9.0.6`).

- [ ] The PR's checks are green.
- [ ] Merge — **always with this command**, not with the button on GitHub:

  ```bash
  gh pr merge <N> --merge --subject "Merge pull request #<N> from SoulcodeAgency/<branch>" --body ""
  ```

  Without the empty `--body` the change is listed **twice** in the changelog.

- [ ] Wait a minute or two, then look at the Release PR: the change is in the changelog exactly **once**.

### Step 2 — Ship

- [ ] Open the Release PR (`chore(main): release <version>`) and read the changelog. Is the list right? Any duplicate lines?
  - Duplicates can only be removed by hand, by editing `CHANGELOG.md` on the Release PR's branch. That has to be the **last** thing before merging — every further push to `main` rewrites the file.
- [ ] The Release PR's checks are green.
- [ ] Make a test build from the current `main` (`npm run build:test`) and do the manual walkthrough: `docs/architecture/testing.md` → "8. Manual real-bexio walkthrough checklist".
- [ ] Merge the Release PR:

  ```bash
  gh pr merge <N> --merge --subject "Merge pull request #<N> from SoulcodeAgency/release-please--branches--main--components--main" --body ""
  ```

The `release-please` workflow then runs on `main` and does the rest: pushes the tag, creates the GitHub Release, and in the same run builds the extension and uploads it to the store.

### Step 3 — Check

- [ ] The run is green, including its `publish` job:

  ```bash
  gh run list --workflow release-please.yml --limit 1
  ```

- [ ] The GitHub Release exists and has the zip attached:

  ```bash
  gh release view <version>
  ```

- [ ] The store serves the new version. This can take minutes to hours, because Google queues the publication:

  ```bash
  curl -s "https://clients2.google.com/service/update2/crx?response=updatecheck&prodversion=140.0&acceptformat=crx3&x=id%3Dnbmjdligmcfaeebdihmgbdpahdfddlhm%26uc" | grep -oE 'version="[0-9.]+"'
  ```

  The second version printed is the extension's (the first one, `1.0`, belongs to the protocol).

- [ ] Watch for e-mails from Google. The workflow cannot detect a rejection (e.g. because of new permissions).

### When something goes wrong

| Symptom                                                  | Cause and fix                                                                                                                                                                |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No Release PR appears after merging a change             | The commit was not a `feat:`/`fix:`. To release anyway, land an empty `fix:` or `feat:` commit on `main`.                                                                    |
| The GitHub Release exists, the store has the old version | The `publish` job failed. Read its log, fix the cause, then catch up: `gh workflow run publish-chrome-web-store.yml -f tag=<version> -f publish=true`                        |
| `Input required and not supplied: <name>`                | The upload action had a major bump and requires a new input. Read the action's `action.yml`, add the input to the workflow (as a `ci:` commit), then catch up on the upload. |
| `401`, `403` or `invalid_grant` from Google              | A secret is wrong or the refresh token was revoked. See `docs/architecture/publishing.md` → "One-time setup".                                                                |
| `PKG_INVALID_VERSION_NUMBER`                             | The store already has this version (or a higher one). Usually `.release-please-manifest.json` holds a stale version — e.g. after a release by hand without the script.       |
| The Release PR suddenly proposes a wrong version         | A hand-edited version reached `main`. Compare `package.json` and `manifest.json` with the latest tag and reset them.                                                         |

**First-time setup required:** the five `CWS_*` GitHub Actions secrets must be configured before the first release; see `docs/architecture/publishing.md` → "One-time setup", or `docs/architecture/publishing-setup.de.md` for the same steps as a German checklist.

## Manual — via `createRelease.ps1` (fallback)

Use this when you need to bypass the automated flow: emergency releases, debugging the CI workflow, or releasing without conventional-commit hygiene. **This path requires manually uploading the produced zip via the Chrome Web Store dev console at the end** — it does not trigger the publish workflow.

Simply run the script `npm run createRelease`.
It will handle the version update, tagging, committing and pushing automatically.

### Manual step-by-step (if you can't run the script)

- Test current version
- Run npm script `version:minor` (or what you need) to increase version number
- Run npm script `version:updateManifest` to update all version references (`manifest.json` **and** `.release-please-manifest.json` — the latter keeps `release-please` from proposing the version you just released)
- Run npm script `build:newExtensionRelease`
- Tag the version this is needed to have the changelog created correctly
- Run npm script `changelog` to create the changelog — it writes with `git-cliff -o`; never use a `>` redirect in PowerShell, that produces a UTF-16 `CHANGELOG.md`
- Commit Everything as new release
- Merge `tagged commit` into `main`, fast forward only (`git merge --ff-only <version>`) to keep the tag on the commit
- Push all branches and make sure all is on same level, then push the tag as well: `git push origin refs/tags/<version>` (`git push --all` does not include tags)
