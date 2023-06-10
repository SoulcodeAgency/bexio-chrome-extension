// Enter event
const delay = ms => new Promise(res => setTimeout(res, ms));
const pressEnter = new KeyboardEvent('keydown', {
    bubbles: true, cancelable: true, keyCode: 13
});


// Selectors
const workField = document.querySelector("#s2id_monitoring_client_service_id input");
const statusField = document.querySelector("#s2id_monitoring_monitoring_status_id input");
const contactField = document.querySelector("#autocomplete_monitoring_contact_id");
const projectField = document.querySelector("#s2id_monitoring_pr_project_id input");
const packageField = document.querySelector("#s2id_monitoring_pr_package_id input");
const billableCheckbox = document.querySelector("#monitoring_allowable_bill");

// Contacts (Companies)
const contact_Soulcode = "Soulcode AG";
const contact_Leister = "Leister";

// Projects
const project_Knowhow = "Know-how";
const project_Innovation = "Innovation";
const project_BackOffice = "Back Office";
const project_Usability = "Usability";

// Packages
const package_Momo = "Momo";
const package_MiscTeam = "Misc / Team";

// States
const status_Done = "Erledigt";

// Get search box field
async function getSearchBoxField() {
    await delay(1000);
    return document.querySelector("#select2-drop input");
}

//
// Functions
//

// Fill form
async function fillForm(contact, project = null, package = null) {
    await triggerWorkField();
    await triggerField(statusField, status_Done);

    // Project connections
    await triggerContactField(contact);
    await triggerCheckbox(billableCheckbox, false);
    await delay(500);
    await triggerField(projectField, project);
    await delay(500);
    await triggerField(packageField, package);
}

// Trigger Contact field
async function triggerContactField(value) {
    contactField.value = value;
    contactField.click();
    contactField.click();
    contactField.click();
    await delay(1000);
    contactField.dispatchEvent(pressEnter);
}

// Trigger work field
async function triggerWorkField(value = "work") {
    workField.value = value;
    workField.dispatchEvent(pressEnter);
    const searchBoxField = await getSearchBoxField();
    searchBoxField.value = value;
    searchBoxField.dispatchEvent(pressEnter);
}

// Trigger general fields with search box
async function triggerField(fieldSelector, value) {
    if (value === null) return;
    fieldSelector.value = value;
    fieldSelector.dispatchEvent(pressEnter);
    const searchBoxField = await getSearchBoxField();
    searchBoxField.value = value;
    searchBoxField.dispatchEvent(pressEnter);
}

// Trigger checkbox
async function triggerCheckbox(selector, checked = true) {
    selector.checked = checked;
}

// Lets go!
// fillForm(contact_Soulcode, project_Innovation, package_Momo);
// fillForm(contact_Soulcode, project_BackOffice, package_MiscTeam);
fillForm(contact_Leister, project_Usability);