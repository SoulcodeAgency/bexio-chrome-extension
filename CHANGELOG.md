# Changelog

All notable changes to this project will be documented in this file.

## [1.9.0](https://github.com/SoulcodeAgency/bexio-chrome-extension/compare/1.8.0...1.9.0) (2026-08-05)


### Features

* **chrome-extension:** give the waitFor* helpers a deadline ([#106](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/106)) ([adb054f](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/adb054f3fae4fae361e719f23e31d2c23e78aa6b)), closes [#83](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/83)
* **side-panel:** add a "Capitalize notes" toggle for the applied description ([eebd7db](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/eebd7db2ce445a33d34f87ade51911739d2a3584))
* **side-panel:** keep the template list in sync with storage ([e06f6c2](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/e06f6c22369cff6ef384273c4b67866ea8cc597e))
* **side-panel:** keep the template list in sync with storage ([29ad0d6](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/29ad0d6c8b1b2977e44768164cad031ec268b3f4))
* **side-panel:** pin the import table columns up to Billable ([#127](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/127)) ([8061e70](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/8061e706dd1608ad8e89b19e0ff6f00e24ce4d4f)), closes [#12](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/12)


### Bug Fixes

* **build:** warn when a build leaves unpacked/ without a side panel ([134f8de](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/134f8dee3ac9c1a290fd9d65aa83c08c0dccdb28))
* **chrome-extension:** apply the template's stored work value ([#104](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/104)) ([33ae6c3](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/33ae6c372b5d78f5b252f0fdf7a3385b424ea4db)), closes [#81](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/81)
* **chrome-extension:** build template buttons as DOM nodes instead of HTML ([#108](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/108)) ([0e6d844](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/0e6d8446d6ce1cdacf8a6dea77ec298775a36b81)), closes [#85](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/85)
* **chrome-extension:** do not search a dependent select's stale options ([#107](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/107)) ([16f29b5](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/16f29b50e23b86284e76f3493d28bb36a7e45437)), closes [#84](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/84)
* **chrome-extension:** scope the manifest to office.bexio.com ([#119](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/119)) ([4d1a9b2](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/4d1a9b2ef0aac616976ab6a5b5e29734254caadf)), closes [#99](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/99)
* **chrome-extension:** skip the contact field when the template has no contact ([#105](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/105)) ([f8e0419](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/f8e04195e5e08b073e3a5b047bc4c354d06907d5)), closes [#82](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/82)
* **shared:** write remove/update back to the key they read from ([#109](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/109)) ([35401d8](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/35401d87fa69866bd8859c26a83e46b24522ee59)), closes [#89](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/89)
* **side-panel:** auto-map legacy templates without crashing ([#114](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/114)) ([52bcb39](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/52bcb39422b3d71ec59ec5411f03c8b1297c1694)), closes [#91](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/91)
* **side-panel:** keep the import buffer's five storage keys consistent ([#111](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/111)) ([0eaa049](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/0eaa04927ababca5a486db531f2e81ec93abf193)), closes [#87](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/87)
* **side-panel:** make openBexioTimeTrackingPage settle and stop leaking listeners ([#112](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/112)) ([b9e7b69](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/b9e7b69731091d52f086fef2b30ec1c79cf2489b)), closes [#88](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/88)
* **side-panel:** normalize the pasted TSV block and guard short rows ([#113](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/113)) ([49fba88](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/49fba88cce166be40c1bc962e6ab41302f936d26)), closes [#90](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/90)
* **side-panel:** report messaging failures instead of failing silently ([#110](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/110)) ([d1d2390](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/d1d239026785bb6dc43598fbec038352457f563a)), closes [#86](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/86)


### Build System

* add prettier tooling and formatting config ([0e3129c](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/0e3129c8b14114a10e637ca6eee92461e754fafd))


### Miscellaneous Chores

* **deps-dev:** bump @playwright/test in the npm-minor-patch group ([#123](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/123)) ([64de1ec](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/64de1ec15c3425a4ef4f0c9ee675ed97391152d2))
* repo hygiene cleanups ([#121](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/121)) ([a7ab47d](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/a7ab47d8f3024e26ca2a916fc91b1b976ffff069)), closes [#101](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/101)

## [1.8.0](https://github.com/SoulcodeAgency/bexio-chrome-extension/compare/1.7.0...1.8.0) (2026-07-31)


### Bug Fixes

* **chrome-extension:** handle unknown template id in fillForm ([c5907b4](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/c5907b44b16cc7ddfa2aebcf8df82a8f99da50b4)), closes [#73](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/73)
* **chrome-extension:** hide fillForm's loader in a finally ([7079e27](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/7079e275f794bd879f2be6688fac6ac8cc43aca9)), closes [#73](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/73)
* **chrome-extension:** stop fillForm from leaving the loader on screen ([711306e](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/711306e9e68f3a95a638f1d6a0ccff68430aab20))
* **chrome-extension:** suggest the work type as a template name ([7a3dfd0](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/7a3dfd0d9809d4d3ef97955610739401ac3122fa))
* **chrome-extension:** suggest the work type as a template name ([b5498a0](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/b5498a06e8e0f592a2393e08efae320d2ce4080c)), closes [#72](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/72)


### Code Refactoring

* **chrome-extension:** enable TypeScript strict mode ([#71](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/71)) ([44a8151](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/44a815103a4ceccf3a3be2f06dfd64036efe36ed))


### Miscellaneous Chores

* **deps:** consolidate open dependency updates ([35781ce](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/35781ce519a9ffbce5b8d736bf33adfe27d32ecd))
* **deps:** consolidate open dependency updates ([d71d40d](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/d71d40d8e3c183c2ecfde2c6d83cc335414f80e4))
* pin Claude Code attribution settings in the repo ([79300f6](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/79300f65da63cc05ec6a59fd01b62441dbfb15da))
* pin Claude Code attribution settings in the repo ([af5966c](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/af5966c017df416ff82d772b469713c71fde9a04))

## [1.7.0](https://github.com/SoulcodeAgency/bexio-chrome-extension/compare/1.6.0...1.7.0) (2026-07-31)


### Build System

* **deps:** migrate packages to TypeScript 7 ([33c2fd7](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/33c2fd7adb01f12cd80965631a4c6356c2e2ebb8))
* **deps:** migrate packages to TypeScript 7 ([91f1780](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/91f1780b666d83629d938d433575cfaba284bf7e))

## [1.6.0](https://github.com/SoulcodeAgency/bexio-chrome-extension/compare/1.5.0...1.6.0) (2026-07-29)


Build-system release. No functional change for users — the extension behaves
exactly as 1.5.0 did. It is released on its own so that, should anything turn
out to be broken, the cause is unambiguous.

### Build System

* upgrade Vite 5 → 8 in both packages, moving the bundler to Rolldown ([20cc475](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/20cc475))
* delete the `overrides` block that force-pinned `esbuild` and `rollup` past what Vite 5 supported; Vite 8 depends on neither ([20cc475](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/20cc475))
* drop `@swc/core`, `undici`, `boolbase`, `iconv-lite` and `immutable` from the packages' runtime dependencies — nothing imported them ([4e42410](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/4e42410))

Side effect worth noting: the side-panel bundle shrank from 2504 kB to 713 kB
(gzip 460 → 231 kB), and the content scripts are now emitted as
`bexioTimetrackingTemplates.js` / `bexioProjectList.js` instead of
`index.ts.js` / `index.ts2.js`.

Verified before release: 124 unit and integration tests, a production build via
`Build.ps1`, all three Playwright extension tests in a real Chromium, and a
manual walkthrough against live bexio.

### Miscellaneous Chores

* release 1.6.0 ([b10b6d1](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/b10b6d1e3ab300f1a1b9fa5b94d303f8071e16a0))

## [1.5.0](https://github.com/SoulcodeAgency/bexio-chrome-extension/compare/1.4.0...1.5.0) (2026-07-27)


### Bug Fixes

* **ci:** call the publish workflow from release-please instead of relying on the release event ([b7ac68d](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/b7ac68df3f7a87c7380c69043f405cb94ee6b84f))

## [1.4.0](https://github.com/SoulcodeAgency/bexio-chrome-extension/compare/1.3.5...1.4.0) (2026-07-27)


### Bug Fixes

* **changelog:** store CHANGELOG.md as UTF-8 instead of UTF-16 ([44e4a05](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/44e4a057e3f037a25610995f01e1c4a69437696e))
* **ci:** pin the CWS upload action to v6.0.0, which actually exists ([c514bb5](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/c514bb5b7ee0f73a1bb8412bdd0e8ce8332f100c))
* **test:** invoke Build.ps1 with the detected PowerShell binary in the build smoke test ([6d1ea63](https://github.com/SoulcodeAgency/bexio-chrome-extension/commit/6d1ea63e8989f2b8d24e86a24c4fa4d88511c952))

## [1.3.5] - 2026-01-05

### Bug Fixes

- Fix(build) Adding dedupe to vite config
- Fix(build) re installing packages
- Fix(build) Removing external from vite.config
- Fix(build) Back at working versions
- Fix(build) Upgrade at working versions
- Fix(build) Upgrading rollup
- Fix(build) Possible build fix
- Fix(build) Remove npm cache
- Fix(build) Getting rid of swc
- Fix(build) Fix esbuild manually

### Miscellaneous Tasks

- Chore(Release) Release info update

### Release

- 1.3.4
- 1.3.5

## [1.3.4] - 2026-01-05

### Miscellaneous Tasks

- Chore(Maintenance) Adding .npmrc
- Chore(Maintenance) Locking package version numbers
- Chore(Maintenance) Adding dependencies until build works
- Chore(Maintenance) Locking package version numbers
- Chore(Maintenance) Further updates

### Release

- 1.3.4

## [1.3.3] - 2025-08-25

### Bug Fixes

- Fix(build) Fixed deprecated / unsupported json file read
- Fix(build) Version number

### Miscellaneous Tasks

- Bump vite from 5.4.10 to 5.4.12
- Chore(updates) simple install updates
- Chore(updates) npm audit fixes

### Release

- 1.3.3

## [1.3.2] - 2024-10-25

### Bug Fixes

- Fix(package) Updating @crxjs/vite-plugin to lateset beta

### Features

- Feat(CreateRelease) Extended release cli with choosing a version bump (patch, minor, major)

### Miscellaneous Tasks

- Chore(build) Adding default build alias
- Chore(package) Updated package-lock and adding new scripts
- Chore(cleanup) Removing not used import

### Release

- 1.3.2

## [1.3.1] - 2024-10-14

### Miscellaneous Tasks

- Chore(package) Package updates

Fix security issue
- Chore(changelog) Fixed changelog creation issues
- Chore(README) Updated

### Release

- 1.3.1

## [1.3.0] - 2024-10-12

### Features

- Feat(LoadingOverlay) Added close button

For situations where the the loader can get stuck
Extracted some loader functionality
- Feat(TemplateButtons) Added filter functionality
- Feat(TemplateButtons) Improved delete functionality and handling

### Miscellaneous Tasks

- Chore(Release) Release script update
- Chore(package) Package updates
- Chore(package) Package updates

### Release

- 1.3.0

## [1.2.0] - 2024-03-28

### Features

- Feat(Popover) Improvements
- Feat(Popover) Improvements
- Feat(Popover) ProjectList improvements
- Feat(Popover) Supporting also Project Time list
- Feat(Popover) Added billing page
- Feat(Popover) Popover improvements / cleanup
- Feat(Popover) Update button
- Feat(Popover) Convert HTML text correctly
- Feat(Popover) Popover improvements / cleanup
- Feat(Popover) Added billing page
- Feat(Popover) Content update
- Feat(Automapper) Removing v1 & v2 mapper

### Miscellaneous Tasks

- Chore(build) Fixed build issues
- Chore(config) Config updates
- Chore(package) package.json update

### Release

- 1.2.0

## [1.1.1] - 2024-01-16

### Miscellaneous Tasks

- Chore(Name) bexio Time Tracking Templates rename
- Chore(img) Cleanup logo
- Chore(assets) Updating and adding updated assets for the project
- Chore(Description) Updated description

### Release

- 1.1.1

## [1.1.0] - 2024-01-16

### Features

- Feat (Template) Refactor template app and enabling it also on edit pages
- Feat(PopverToText) Convert popover icon to text

### Miscellaneous Tasks

- Chore(Package) Description update

## [1.0.0] - 2024-01-04

### Bug Fixes

- Fix(AutoMapTemplatesV3) No matches should not break the script
- Fix(LINT) Fixed linting issues
- Fix(timeEntries) Improved handling of zero times in different formats (00:00) for checking for zero values
- Fix(vite) Fixed handling of json files

### Features

- Feat(ExtensionReload) Template modifications will now reload extension within bexio webpage

Example: Template buttons will get re-rendered with the new template name
- Feat(Tabs) Keep last active tab state and enable it on load
- Feat(Status) Run-button states are now persisted

### Miscellaneous Tasks

- Chore(Assets) Cleanup react icon
- Chore(Tabs) Template should be the first tab for default users
- Chore(Release) Extended release script
- Chore(RELEASE.md) Updated release readme
- Chore(README) Updating documentation
- Chore(temp) Temporary minor->major change
- Chore(npm) updates
- Chore(npm) updates
- Chore(PRIVACY) Updating privacy details
- Chore(README) Updated readme
- Chore(Style) Cleanup
- Chore(rename) build script rename
- Chore(README) Update
- Chore(Release) Prepare for 1.0.0

### Release

- 1.0.0

## [0.20.0] - 2023-12-22

### Bug Fixes

- Fix(Billable) Render the billable field also when no template is selected

### Features

- Feat(Footer) Updated copyright line
- Feat(Name) Name and layout updates
- Feat(Footer) Updated footer styling
- Feat(AutoMapper) Ignore single characters
- Feat(AutoMapper) Improve points system. Double points for matching exact words
- Feat(AutoMapper) Refactoring point mapping
- Feat(AutoMapper) Extracting mapper function
- Feat(AutoMapper) Extracting csvHandling into functional function
- Feat(AutoMapper) Extracting mapper function v1
- Feat(AutoMapper) Extracting mapper function v2 (and bringing it back in)
- Feat(AutoMapper) Updating weighting on v3
- Feat(DarkMode) Supporting Dark Mode
- Feat(Parser) Extracting parser and adding further validation errors
- Feat(Logo) Introduce extension logo
- Feat(Logo) Loading icon update and zoomed logo32 to improve visibility
- Feat(Footer) Updated footer content

### Miscellaneous Tasks

- Chore(Name) Updated name
- Chore(Text) Content updates

### Release

- 0.20.0

## [0.19.0] - 2023-11-20

### Bug Fixes

- Fix(markdown) Markdown configuration to match git-cliff
- Fix(Release) Version increase should be before creating the package :D

### Miscellaneous Tasks

- Chore(package) Adding git-cliff to dev dependencies
- Chore(RELEASE) Moving release instructions to root directory

### Release

- 0.19.0

## [0.18.0] - 2023-11-13

### Bug Fixes

- Fix(descriptionField) Fixed possible issues with finding the iframe

### Features

- Feat(CreateRelease) New release script for convenient releases

### Miscellaneous Tasks

- Chore(README) Updated README file
- Chore(RELEASE) Adding release notes

### Release

- 0.18.0

## [0.17.0] - 2023-11-06

### Features

- Feat(Billable) Recognizes now also the Billable/Not Billable fields from the import, if "Billable" column exists.

Will overwrite the value of the template
- Feat(Billable) Displays Billable column as checkboxes
- Feat(Billable) Warns about differences between template and time entry billable flags

Also re factored and improved cell rendering components

### Miscellaneous Tasks

- Chore(templateId) Check for missing templateId fix before applying Template

## [0.16.0] - 2023-10-30

### Features

- Feat(Notes) Adding description notes from notes, or a tag column in descending order
- Feat(env) Adding helpers for executing things on dev or prod env
- Feat(Notes) Added option to apply notes or not

Notes will be taken from the notes column or the last tag column with content
- Feat(Notes) Added notes button also to the notes header column
- Feat(AutoMapper) New auto mapper version released

### Miscellaneous Tasks

- Chore(chromeStorage) Improvements
- Chore(AutoMapper) Cleanup and logging improvements
- Chore(AutoMapper) Cleanup and logging improvements

## [0.15.0] - 2023-10-22

### Bug Fixes

- Fix(Templates) Fixed useContext of TemplateContext
- Fix(Templates) Fixed missing template id and wrong matching for update templates

### Features

- Feat(Templates, sidePanel) Implemented "Delete Template" & Improved TemplateContext
- Feat(Buttons) Changing to antd buttons, removing initial styling
- Feat(Templates) Fixing update template logic, and adding modal form for editing templates

Also adding a field keywords, which can later be used for auto mapper values
- Feat(Automapper) Adding keywords field to automapper

### Miscellaneous Tasks

- Chore(Templates) Extracting devTemplates for development
- Chore (Template) Renaming confirmDeletion function
- Chore(Vite) Improving config to not minify on dev builds
- Chore(Comments) Adding Comments and todos
- Chore(vscode) Adding settings which always appears

## [0.14.0] - 2023-09-22

### Bug Fixes

- Fix(iframe) Fixed accessing iframe information too early

Migrated to a getter function

### Features

- Feat(CHANGELOG) Adding git-cliff
- Feat(build) Improved development build

## [0.13.0] - 2023-09-15

### Features

- Feat(autoMap) Do not auto map a template, if there was no clear winner
- Feat(DataTable) Improved detection of dates - Allows dates with slashes
- Feat(DataTable) Improved detection of zero time (decimal + time format)
- Feat(Templates) Sorting templates alphabetically
- Feat(autoMap) Search for alphanumeric words and check for matches

This improves the auto mapping, as it will now separate words by any none alphanumeric characters and not only spaces.

### Miscellaneous Tasks

- Chore(Templates) Adding 1 more dev example
- Chore(Templates) Improved description field type
- Chore(Templates) Adding 1 more dev example

## [0.12.0] - 2023-09-01

## [0.11.0] - 2023-08-07

### Bug Fixes

- Fixed #8 minification issue with document api

## [0.10.0] - 2023-08-07

### Miscellaneous Tasks

- Introducing AntDesign, adding some tabs and styling

## [0.9.3] - 2023-07-18

## [0.9.2] - 2023-07-17

## [0.5.0] - 2023-06-22

### Miscellaneous Tasks

- Placing Templates at the bottom right corner area

## [0.4.0] - 2023-06-18

<!-- generated by git-cliff -->
