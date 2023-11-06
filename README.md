# Soulcode's bexio-chrome-extension

Improves handling of time tracking on bexio  
Enabling the user to save the form as templates, and re-use it later.  
Importing entries from ManicTime

Feature Overview:

* Time clicking the extension icon will bring you to the bexio time tracking page
* On the time tracking page you can now save and re-use templates
* Clicking the icon on the bexio time tracking page will open a side panel
* You will see the saved templates as well and you can also execute them from there
* During applying a template, it will show a loader screen, which blocks interactivity while auto-filling your template information (to mitigate bugs)
* In the sidepanel you can further:
  * Delete Templates
  * Edit Templates
  * Add keywords to templates (used for the import feature)

IMPORT FEATURES (within the sidepanel)

You can import ManicTime data and select which template to use, further features are:

* Clicking a time entry (via ▶️ button) will automatically fill the time tracking page, with the time, date and if selected use the selected template.
* You can use the auto-mapper Feature which tries to find the right template for your entry
* Automapper also checks the keywords as well as other fields on the templates

## How to use ManicTime feature

* Export ManicTime exports via (Timesheet -> Generate Report -> Copy "Copy to clipboard")
* Make sure you selected "Time format", not "Decimal format"
* Include the tags as columns
* Check "Include Notes" if you want to use the Notes as Descriptions
* Include "Billable" as a column - to have Billable flag support per Time Entry

## Chrome webstore address

Extension can be installed over the chrome webstore:
[Soulcode's Bexio Timetracking Templates](https://chrome.google.com/webstore/detail/soulcodes-bexio-timetrack/nbmjdligmcfaeebdihmgbdpahdfddlhm)

## NPM

This repository uses npm's new [workspaces feature](https://docs.npmjs.com/cli/v9/using-npm/workspaces) which is a bit special!

The separate sub-projects are all located in the `packages` folder.

Package.json scripts are all ready for using `workspaces`:

* Install all npm packages using `installProject`
* To build a developer release use `build:devRelease`
* For creating a new extension release use `build:newExtensionRelease`, but first make sure you update the version number, using the available `version:...` tasks. (major, minor or patch)

## Privacy

[see Privacy document](PRIVACY.md)
