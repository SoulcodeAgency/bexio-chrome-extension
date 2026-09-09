# Design — repo-wide Prettier format sweep

**Date:** 2026-08-05
**Status:** approved for implementation

## Problem

A `.prettierrc` (`tabWidth: 2`, `useTabs: false`, `printWidth: 120`) has been checked in for a
long time, but Prettier itself was never installed — not at the repo root, not in any workspace.
The config was therefore only ever honoured by whatever editor happened to have the Prettier
extension enabled, which is why formatting drifted file by file and why `.vscode/settings.json`
(4-space) and `.prettierrc` (2-space) disagree with each other.

The goal is to make the checked-in config real: pin Prettier, give it an ignore list, make line
endings deterministic, format the repo once, and then keep it formatted in CI.

## Scope

Measured on `origin/main` at `eebd7db` with the `.prettierignore` below in place and an LF working
tree, `npm run format:check` reports **108 files**:

| Type                  | Count |
| --------------------- | ----- |
| `.ts`                 | 65    |
| `.md`                 | 17    |
| `.json`               | 9     |
| `.tsx`                | 7     |
| `.css`                | 4     |
| `.js`                 | 2     |
| `.yml`                | 1     |
| `.html`               | 1     |
| `.prettierrc`         | 1     |
| `.markdownlint.jsonc` | 1     |
| **Total**             | 108   |

The exact number will move as feature work lands; it is a snapshot, not a contract. What matters
is that the set is "every checked-in file Prettier understands, minus the exclusions below".

### Provenance of the earlier "180 / 173 files" figures

An earlier pass quoted 180 unformatted files before the ignore list and 173 after it. Both numbers
are reproducible, but not on this branch point:

- They were measured at commit `e06f6c2` (tip of `claude/prepare-format-120-files-f8497b`), two
  commits behind `origin/main`.
- More importantly, they were measured on a **CRLF working tree**. Git for Windows ships
  `core.autocrlf=true` in its system config, so a fresh Windows checkout gets CRLF working files
  while the index stays LF. Prettier's `endOfLine` default is `"lf"`, so on such a checkout it
  flags _every_ file it can parse, whether or not anything else about it is wrong. That is why the
  old breakdown listed all 101 `.ts` files of that commit rather than a subset.

At `e06f6c2` there are exactly 182 files Prettier can match; two of them fail to parse, leaving
180 warnings and exit code 2 — the reported baseline, to the file. The `.gitattributes` added in
Phase A is what removes this whole class of confusion: with `* text=auto eol=lf` a Windows checkout
gets LF working files, and local `format:check` finally agrees with CI.

### Excluded

| File                                                          | Reason                                                                                                                                                                  |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package-lock.json`                                           | npm rewrites it on every install with its own formatting, so a formatted version would make the check permanently red                                                   |
| `CHANGELOG.md`                                                | regenerated wholesale by git-cliff / release-please; a formatted version does not survive a release and conflicts with the Release PR, which stays open by project rule |
| `packages/chrome-extension/test/fixtures/bexio/*.html`        | captured bexio pages; the jsdom and Playwright tests read DOM and text out of them, and `kb_invoice-show.html` + `monitoring-list.html` do not parse as HTML at all     |
| `packages/chrome-extension/test/support/__inline__/tiny.html` | hand-written DOM probe for HTML entities, same reasoning as the fixtures                                                                                                |

The two unparseable fixtures are also what made the un-ignored run exit with code **2** rather than
**1**: Prettier reports a parse error separately from a formatting difference. Ignoring them brings
the exit code back to a plain 1, so a future CI step fails for the one reason it is meant to.

Build output (`unpacked/`, `dist/`) and test output (`coverage/`, `test-results/`,
`playwright-report/`) are ignored as well. Prettier 3 does **not** read `.gitignore`, so on a
machine that has built the project those directories would otherwise be formatted.

### Deliberately not excluded

`packages/chrome-extension/public/manifest.json` and `.release-please-manifest.json` are generated
in part, but `updateManifest.js` edits them (and `package.json`) by regex replacement rather than
by `JSON.parse` → `JSON.stringify`. It therefore preserves surrounding formatting, and a formatted
version of these files survives a release untouched. They stay in the sweep.

## Tooling (Phase A)

1. **Pin Prettier.** `npm install -D prettier@3.9.6` at the repo root. `.npmrc` sets
   `save-exact=true`, so the entry lands as `"prettier": "3.9.6"` with no caret — matching the
   repo's rule that every dependency version is pinned. This is the one intended change to
   `package-lock.json`; CLAUDE.md's "use `npm ci`, not `npm i`" rule is about worktrees not
   perturbing the lockfile, and here the lockfile change is the point.

2. **Scripts.** `format` (`prettier --write .`) and `format:check` (`prettier --check .`) in the
   root `package.json`, immediately after `typecheck`.

3. **`.prettierignore`.** The exclusions above plus the build/test output directories.

4. **`.gitattributes`.** `* text=auto eol=lf`, plus `binary` for the image/font/zip assets. The
   index is already 100% LF (`git ls-files --eol`), so adding it produces zero content diff — it
   only fixes what a _checkout_ writes to disk. There are no `.bat`/`.cmd`/`.sh` files in the repo,
   so nothing needs CRLF; the two PowerShell scripts are fine with LF.

5. **Editor wiring.** `editor.formatOnSave` plus a per-language `editor.defaultFormatter` of
   `esbenp.prettier-vscode` for `typescript`, `typescriptreact`, `javascript`, `json`, `jsonc`,
   `markdown`, `yaml`, `html`, `css` and `scss`, and a `.vscode/extensions.json` recommending the
   extension. The formatter is set **per language on purpose**: a global
   `editor.defaultFormatter` would hijack `.ps1` files, and this repo has `Build.ps1` and
   `CreateRelease.ps1`, which Prettier cannot format.

`eslint-config-prettier` is **not** added. The only ESLint config in the repo
(`packages/sidePanel-import/eslint.config.js`) contains no stylistic rules, so there is nothing for
it to turn off. No pre-commit hook framework is added either — the repo has none today, and CI plus
format-on-save covers the same ground without a new dependency in everyone's commit path.

## Sequencing

The work is split into two phases so that the mechanical 100+-file diff never sits in the same
commit as anything reviewable.

**Phase A — tooling only.** Everything under "Tooling" above, in two commits:

- `docs: design for the repo-wide prettier format sweep`
- `build: add prettier tooling and formatting config`

No file is reformatted and no CI step is added, so Phase A has zero conflict risk and can merge at
any time. `npm run format:check` fails by design after Phase A; that is the point of Phase B.

**Phase B — the sweep, once the tree is quiet.** Two further commits:

- `style: format repo with prettier` — the output of a single `npm run format`, nothing else. A
  formatting-only commit, so it can be reviewed by confirming the diff is whitespace and that the
  test suite still passes.
- `ci: enforce prettier formatting` — adds a `npm run format:check` step to
  `.github/workflows/node.js.yml`, next to `Typecheck`, and records the sweep's SHA in
  `.git-blame-ignore-revs`, so `git blame` skips straight past it.

`.git-blame-ignore-revs` cannot be written before Phase B, because it needs the sweep commit's own
SHA.

### Phase B must be merged with a merge commit

The `.git-blame-ignore-revs` entry only stays valid if the sweep commit reaches `main` with the SHA
it had on the branch. Of GitHub's three merge methods, only **merge commit** preserves that:

| Method       | Sweep SHA on `main`                                   |
| ------------ | ----------------------------------------------------- |
| merge commit | unchanged — the branch commits are the ones that land |
| squash       | collapsed into one new SHA                            |
| rebase       | replayed as new SHAs                                  |

Squash merging is disabled on this repository, and #128 was landed with a rebase merge before this
constraint was understood — its head went in as `35e89df` and came out on `main` as `0e3129c`. That
is harmless for #128, which recorded no SHA anywhere, but doing the same to Phase B would leave
`.git-blame-ignore-revs` naming a commit that does not exist on `main`, and
`git blame --ignore-revs-file` aborts on an unknown revision rather than skipping it — worse than
having no file at all.

More generally: prefer the merge method that leaves commit hashes stable. Rewritten hashes
invalidate anything that references them — `.git-blame-ignore-revs`, `git bisect` notes, links in
issues and PR descriptions, `Fixes: <sha>` trailers.

The file is committed together with the `git config blame.ignoreRevsFile .git-blame-ignore-revs`
line developers need locally: GitHub applies the file automatically in its blame view, but
`git blame` on the command line does not.

`style:` and `ci:` are both configured as `hidden` in `release-please-config.json`, so a
100+-file cosmetic commit and the CI step stay out of the generated release notes.

### Why Phase B waits

A repo-wide reformat conflicts with every open branch that touches a formatted file. At time of
writing the unmerged work is `claude/bexio-extension-issue-12-4ad9db` — three commits on top of
what already landed via #127, all of them inside
`packages/sidePanel-import/src/components/ImportEntries/`, which is squarely in the sweep's path.

Phase B is therefore gated on that work landing on `main`. The resolution for any branch that is
still open when the sweep lands is always the same: rebase onto `main` and re-run `npm run format`,
which turns a whitespace conflict back into a mechanical no-op.

## Verification (Phase B)

Run in order, on a checkout that has had `.gitattributes` applied:

1. `npm run format:check` — must exit 0.
2. `npm run typecheck` — must pass.
3. `npm test` — the Vitest suite, including the slow build smoke test that shells out to
   `Build.ps1`.
4. `npm run test:e2e` — the Playwright extension smoke + behaviour specs.

Steps 3 and 4 are the actual evidence that the sweep was semantically neutral. A formatting diff is
easy to eyeball but tedious to prove correct by reading; the DOM-dependent tests and the real
Chromium run are what confirm that nothing in the fragile `trigger*` / selector layer changed
meaning.
