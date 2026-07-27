# Changelog

All notable changes to this project will be documented in this file.

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
