// Check if the script already added some buttons

console.log($("body"))
if (document.getElementById('SoulcodeMomo')) {
    console.log("Already initialized");
} else {
    // Initialize

    // Delay
    const delay = ms => new Promise(res => setTimeout(res, ms));
    // Enter event
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

    //
    // Functions
    //

    // Get search box field
    async function getSearchBoxField() {
        // TODO: Instead of waiting 1 second, we could check with timeinterval until we find it.
        await delay(1000);
        return document.querySelector("#select2-drop input");
    }

    // Fill form
    async function fillForm(id) {
        const entry = entries.find(entry => entry.id === id);
        const { contact, project = null, package = null, status = null, billable = true } = entry

        await triggerWorkField();
        await triggerField(statusField, status);

        // Project connections
        await triggerContactField(contact);
        await delay(500);
        await triggerField(projectField, project);
        await delay(500);
        await triggerField(packageField, package);
        await triggerCheckbox(billableCheckbox, billable);
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

    // Read value from select2
    async function readTextFromSelect2(selector) {
        return selector.closest(".input").querySelector(".select2-chosen").textContent.trim();
    }

    function trimAll(str) {
        return str.replace(/\s+/g, "");
    }

    // Read form data
    async function readFormData() {
        const work = await readTextFromSelect2(workField);
        const status = await readTextFromSelect2(statusField);

        // Contact is a bit special, it will show a string which is not directly searchable, thats why we limit it
        let contact = contactField.value;
        let words = contact.split(' ');
        contact = words.slice(0, 2).join(' ');

        const project = await readTextFromSelect2(projectField);
        const package = await readTextFromSelect2(packageField);
        const billable = billableCheckbox.checked;

        const id = trimAll(package) || trimAll(project) || trimAll(contact) || null;
        if (id === null) return;
        const formEntry = { id, work, status, contact, project, package, billable };

        // Save formEntries into our existing entries
        const allEntries = await chrome.storage.local.get(["entries"]).then((result) => {
            if (result.entries && Array.isArray(result.entries)) {
                return result.entries;
            }
            return [];
        });

        allEntries.push(formEntry);
        chrome.storage.local.set({ entries: allEntries }).then(() => {
            console.log("Entry is saved", formEntry);
            alert("Entry is saved, after a reload you will see a new button");
        });
    }

    // Clear the entries
    async function clearEntries() {
        chrome.storage.local.clear();
    }

    async function init() {
        // console.log(await chrome.storage.local.get());
        console.log(entries);

        // Add some buttons into the page
        let buttons = '';
        if (entries) {
            entries.map(entry => buttons += `<button id="${entry.id}" class="entry btn btn-info" style="margin-right: 2px">${entry.id}</button>`);
        }

        document.querySelector(".bx-flex-block.bx-halftop-margin.bx-flex-align-middle-left").insertAdjacentHTML("beforeend", `<div>
            <div id="bexioAddTime-entries" style="display: inline-block">
                ${buttons}
            </div>
            <button id="AddNew" class="btn btn-success">+ Add</button>
            <button id="Clear" class="btn btn-danger">Clear</button>
        </div>`);

        // Attach functionality to the buttons
        const domButtons = document.getElementById('bexioAddTime-entries').querySelectorAll("button.entry");
        domButtons.forEach(button => button.addEventListener('click', function () { fillForm(button.id) }));

        // Special action buttons
        document.getElementById('AddNew').addEventListener('click', function () { readFormData() });
        document.getElementById('Clear').addEventListener('click', function () { clearEntries() });

    }

    // Get all entries in storage and initialize the page
    let entries = [];
    chrome.storage.local.get(["entries"]).then((result) => {
        entries = result.entries;
        console.log(entries);
        init();
    });

}
