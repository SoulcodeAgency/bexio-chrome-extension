# Bexio-chrome-extension

Improves handling of time tracking on bexio  
Enabling the user to save the form as templates, and re-use it later.  
Importing entries from ManicTime

## Feature Overview

### bexio

Within the **bexio time tracking page**:

Time clicking the extension icon will bring you to the bexio time tracking page

* On the time tracking page you can now save and re-use form data as templates
* Once the filled form is saved as a template you can simply let further forms fill out automatically using the template buttons
* If you don't need a template anymore, you can also delete it (*first select the according template button, then the delete button*)

### Chrome side panel

Clicking the extension icon on the bexio time tracking page again will open the extensions side panel. You can also open it over the browsers sidepanel options.  
In the sidepanel you can find the following features:

* **TEMPLATE TAB**
  * You will see the saved templates and their content
  * You can execute the templates also from here
  * During applying a template, it will show a loader screen, which blocks interactivity while auto-filling your template information (to mitigate bugs)
  * You can edit or delete the templates
  * You can also add keywords to templates (which is used for the import feature)
* **IMPORT FEATURES**
  * You can import `ManicTime` data and select which template to use, further features are:
  * Clicking a time entry (via ▶️ button) will automatically fill the time tracking page will apply the selected template if one is selected.
  * Further it will also apply the time and date as well as the billable checkbox if the according value exists on the entry
  * You can use the auto-mapper Feature which tries to find the right template for your entries
  * Automapper also checks the keywords as well as other fields on the templates. You can add keywords in the template section

## How to use ManicTime feature

* Export ManicTime exports via (Timesheet -> Generate Report -> Copy `Copy to clipboard`)
* Make sure you selected "Time format", not "Decimal format"
* Include the tags as columns, at least `Tag 1` is required.
* Check `Include Notes` if you want to use the `Notes` as `Descriptions`
* Include `Billable` as a column - to have Billable flag support per Time Entry

## NPM

This repository uses npm's new [workspaces feature](https://docs.npmjs.com/cli/v9/using-npm/workspaces) which is a bit special!

The separate sub-projects are all located in the `packages` folder.

`package.json` scripts are all ready for using `workspaces` feature:

* Install all npm packages using roots `installProject` npm script
* To build a developer release use `build:devRelease` npm script

### Create new release

This repo has a script which will handle and prepare a new release, further details can be found in the [RELEASE.md](./RELEASE.md)

## Chrome webstore address

Extension can be installed over the chrome webstore:
[Bexio Timetracking Templates](https://chromewebstore.google.com/detail/bexio-timetracking-templa/nbmjdligmcfaeebdihmgbdpahdfddlhm)

## FAQ

See [FAQ.md](./FAQ.md)

## Privacy

See [PRIVACY.md](PRIVACY.md)
