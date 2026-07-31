# How to make a new release

**Two ways to release.** The automatic CI path is the default; the manual local-script path is preserved as a fallback. Pick one per release — don't interleave. See `docs/architecture/publishing.md` for the full picture; this file is the day-to-day cheat sheet.

## Automatic — via `release-please` (preferred)

1. Merge your feature/fix PRs to `main` with conventional-commit messages (`feat: …` or `fix: …` trigger a release; `chore:` / `docs:` / `test:` / `refactor:` don't).
   - **Every release is a minor bump** — `1.3.5` → `1.4.0` → `1.5.0`. Patch numbers are for local dev builds only. For a major, put `Release-As: 2.0.0` in a commit body.
2. `release-please` opens (or amends) a Pull Request titled `chore(main): release <version>` containing the version bump, manifest sync, and changelog entry.
3. When you're ready to ship, review and **merge that Release PR**.
4. Merging triggers the tag + GitHub Release + `publish-chrome-web-store` workflow, which builds the extension and publishes it to the Chrome Web Store. Hands-off.

If the publish workflow fails after a Release PR merge, re-run it from the Actions tab — `publish-chrome-web-store` → "Run workflow" → enter the tag, leaving `publish: true`. The re-run rebuilds, re-publishes, and re-attaches the zip to the existing GitHub Release.

**First-time setup required:** the four `CWS_*` GitHub Actions secrets must be configured before the first release; see `docs/architecture/publishing.md` → "One-time setup", or `docs/architecture/publishing-setup.de.md` for the same steps as a German checklist.

## Manual — via `createRelease.ps1` (fallback)

Use this when you need to bypass the automated flow: emergency releases, debugging the CI workflow, or releasing without conventional-commit hygiene. **This path requires manually uploading the produced zip via the Chrome Web Store dev console at the end** — it does not trigger the publish workflow.

Simply run the script `npm run createRelease`.
It will handle the version update, tagging, committing and pushing automatically.

### Manual step-by-step (if you can't run the script)

- Test current version
- Run npm script `version:minor` (or what you need) to increase version number
- Run npm script `version:updateManifest` to update all version references
- Run npm script `build:newExtensionRelease`
- Tag the version this is needed to have the changelog created correctly
- Run npm script `changelog` to create the changelog
- Commit Everything as new release
- Merge `tagged commit` into `main`, fast forward to keep the tag on the commit
- Push all branches and make sure all is on same level
