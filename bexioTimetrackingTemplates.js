// Delay
const delay = ms => new Promise(res => setTimeout(res, ms));
// Enter event
const pressEnter = new KeyboardEvent('keydown', {
    bubbles: true, cancelable: true, keyCode: 13
});

// Selectors
const workFieldID = "#s2id_monitoring_client_service_id";
const statusFieldID = "#s2id_monitoring_monitoring_status_id";
const contactFieldID = "#autocomplete_monitoring_contact_id";
const projectFieldID = "#s2id_monitoring_pr_project_id";
const packageFieldID = "#s2id_monitoring_pr_package_id";
const billableCheckboxID = "#monitoring_allowable_bill";
const contactPersonID = "#s2id_monitoring_sub_contact_id";

const contactField = document.querySelector(contactFieldID);
const billableCheckbox = document.querySelector(billableCheckboxID);

// Fill form
async function fillForm(id) {

    const entry = entries.find(entry => entry.id === id);
    const { contact, contactPerson = null, project = null, package = null, status = null, billable = true } = entry

    await triggerField(workFieldID, "work");
    await triggerField(statusFieldID, status);

    // Project connections
    await triggerContactField(contact);
    await triggerField(contactPersonID, contactPerson);
    await triggerField(projectFieldID, project);
    await triggerField(packageFieldID, package);
    await triggerCheckbox(billableCheckbox, billable);
}

//
// Functions
//

// Check that the select has any values
async function waitForSelectOptions(selector) {
    return new Promise((resolve) => {
        const waitForSelectBox = () => {
            const selectSelector = document.querySelector(`${selector}+select`);
            if (selectSelector !== null && selectSelector.options.length > 1) {
                resolve();
            } else {
                setTimeout(waitForSelectBox, timeToWait);
            }
        };
        waitForSelectBox();
    });
}

const timeToWait = 1000;
// Get search box field
async function waitForSearchBoxField() {
    return new Promise((resolve) => {
        const waitForSearchBox = () => {
            const searchBox = document.querySelector("#select2-drop input");
            if (searchBox !== null) {
                resolve(searchBox);
            } else {
                setTimeout(waitForSearchBox, timeToWait);
            }
        };
        waitForSearchBox();
    });
}

// Waits until Search box is gone
async function waitForSearchBoxFieldToBeRemoved() {
    return new Promise((resolve) => {
        const waitForRemoval = () => {
            const searchBox = document.querySelector("#select2-drop input");
            if (searchBox === null) {
                resolve();
            } else {
                setTimeout(waitForRemoval, timeToWait);
            }
        };
        waitForRemoval();
    });
}


// Waits until contacts items show up
async function waitForContacts() {
    return new Promise((resolve) => {
        const waitForContacts = () => {
            const contacts = document.querySelector(".ac_results");
            if (contacts === null) {
                setTimeout(waitForContacts, timeToWait);
            } else {
                // Check if its displaying
                const style = window.getComputedStyle(contacts);
                if (style.display === 'none') {
                    // The element is hidden
                    setTimeout(waitForContacts, timeToWait);
                } else {
                    // The element is visible
                    resolve();
                }

            }
        };
        waitForContacts();
    });
}

// Trigger Contact field
async function triggerContactField(value) {
    contactField.value = value;
    contactField.click();
    contactField.click();
    contactField.click();
    await waitForContacts();
    contactField.dispatchEvent(pressEnter);
    // TODO: Improve the following delay to really check if contacts are gone
    await delay(500);
}

// Trigger general fields with search box
async function triggerField(selector, value) {
    if (value === null || value.trim() === "") return;
    const inputSelector = document.querySelector(`${selector} input`);
    await waitForSelectOptions(selector);
    inputSelector.value = value;
    inputSelector.dispatchEvent(pressEnter);
    const searchBoxField = await waitForSearchBoxField();
    searchBoxField.value = value;
    searchBoxField.dispatchEvent(pressEnter);
    await waitForSearchBoxFieldToBeRemoved();
}

// Trigger checkbox
async function triggerCheckbox(selector, checked = true) {
    selector.checked = checked;
}

// Read value from select2
async function readTextFromSelect2(selector) {
    return selector.closest(".input").querySelector(".select2-chosen").textContent.trim();
}

function trimAll(str) {
    return str.replace(/\s+/g, "");
}

// Read form data
async function readFormData() {
    const workField = document.querySelector(`${workFieldID} input`);
    const statusField = document.querySelector(`${statusFieldID} input`);
    const projectField = document.querySelector(`${projectFieldID} input`);
    const packageField = document.querySelector(`${packageFieldID} input`);
    const contactPersonField = document.querySelector(`${contactPersonID} input`);

    const work = await readTextFromSelect2(workField);
    const status = await readTextFromSelect2(statusField);

    // Contact is a bit special, it will show a string which is not directly searchable, thats why we limit it
    let contact = contactField.value;
    let words = contact.split(' ');
    contact = words.slice(0, 2).join(' ');

    const contactPerson = await readTextFromSelect2(contactPersonField);
    const project = await readTextFromSelect2(projectField);
    const package = await readTextFromSelect2(packageField);
    const billable = billableCheckbox.checked;
    const templateName = trimAll(package) || trimAll(project) || trimAll(contact) || null;

    const formEntry = { work, status, contact, project, package, billable, contactPerson, templateName };

    // Ask user for a template Name, prefilled with the suggested one
    let userInput = prompt("Name of the template:", templateName);
    if (userInput !== null) {
        formEntry.templateName = userInput;
    } else {
        alert("Please enter a name for the template");
        return;
    }

    // Create the entry and a hash for saving it
    const jsonString = JSON.stringify(formEntry);
    const hash = await generateHash(jsonString);
    formEntry.id = hash;

    // Save formEntries into our existing entries
    const allEntries = await chrome.storage.local.get(["entries"]).then((result) => {
        if (result.entries && Array.isArray(result.entries)) {
            return result.entries;
        }
        return [];
    });

    allEntries.push(formEntry);
    chrome.storage.local.set({ entries: allEntries }).then(async () => {
        console.log("Entry is saved", formEntry);
        await initializeExtension();
    });
}

// DeleteTemplate
async function deleteTemplate(id) {
    // chrome.storage.local.clear();
    // Iterate over the chrome storage and remove the entry with the given id
    const filteredEntries = await chrome.storage.local.get(["entries"]).then((result) => {
        if (result.entries && Array.isArray(result.entries)) {
            return result.entries.filter(entry => entry.id !== id);
        }
        return [];
    });
    chrome.storage.local.set({ entries: filteredEntries }).then(async () => {
        console.log("Only the right entry is hopefully removed", id);
        await initializeExtension();
    });

}

async function confirmDeletion() {
    const activeButton = document.querySelector(".template-button--active") ?? undefined;
    const activeTemplateName = activeButton?.textContent ?? undefined;
    const activeTemplateId = activeButton?.id ?? undefined;
    if (activeTemplateId !== undefined) {
        if (confirm(`Are you sure you want to delete the active template "${activeTemplateName}"?`)) {
            deleteTemplate(activeTemplateId);
            initializeExtension();
        }
    } else {
        alert("Sorry - There is no active template to delete or something went wrong! Please select first the template you want to delete. Thanks.");
    }
}

async function renderHtml() {
    // Add some buttons into the page
    let buttons = '';
    if (entries) {
        entries.map(entry => buttons += `<button id="${entry.id}" class="entry btn btn-info template-button" style="margin-right: 2px">${entry.templateName ?? entry.id}</button>`);
    }

    // Remove the templates HTML, if it already exists
    const templates = document.getElementById("SoulcodeExtensionTemplates");
    if (templates) {
        templates.remove();
    }

    const templatePlacement = document.getElementById("pr_package").parentNode.parentNode.parentNode;
    const htmlTemplateButtons = `<div id="bexioTimetrackingTemplates-entries" style="display: flex; flex-wrap: wrap; gap: 4px;">
        ${buttons}
    </div>`;
    const htmlActions = `<div id="SoulcodeExtensionActions" style="margin-left: 4px;">
            <button id="AddNewTemplate" class="btn btn-info">+ Add as Template</button>
            <button id="DeleteTemplate" class="btn btn-danger">Delete Template</button>
        </div>`;

    // Place the html into the DOM
    templatePlacement.insertAdjacentHTML("beforeend", `<div id="SoulcodeExtensionTemplates" class="row-fluid">
        <hr>
        <div class="bx-formular-header" style="display: flex; justify-content: space-between">
            <h2>Templates</h2>
            ${htmlActions}
        </div>
        <hr>
        ${htmlTemplateButtons}
    </div>`);

    // Attach functionality to the buttons
    const domButtons = document.getElementById('bexioTimetrackingTemplates-entries').querySelectorAll("button.entry");
    domButtons.forEach(button => button.addEventListener('click', function (e) {
        e.preventDefault();
        fillForm(button.id)

        // Handle active template button
        const parent = e.target.parentNode;
        const siblings = parent.querySelectorAll(".template-button");

        siblings.forEach((sibling) => {
            sibling.classList.remove("template-button--active");
        });

        e.target.classList.add("template-button--active");
    }));

    // Special action buttons
    document.getElementById('AddNewTemplate').addEventListener('click', function (e) { e.preventDefault(); readFormData() });
    document.getElementById('DeleteTemplate').addEventListener('click', function (e) { e.preventDefault(); confirmDeletion() });
}

async function initializeExtension() {
    // Get all entries in storage and initialize the page
    chrome.storage.local.get(["entries"]).then((result) => {
        entries = result.entries;
        console.log("🚀 ~ file: bexioTimetrackingTemplates.js:280 ~ chrome.storage.local.get ~ entries:", entries)
        renderHtml();
    })
}

// Hash generation
async function generateHash(string) {
    const utf8 = new TextEncoder().encode(string);
    const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
        .map((bytes) => bytes.toString(16).padStart(2, '0'))
        .join('');
    return hashHex;
}

let entries = [];
initializeExtension();