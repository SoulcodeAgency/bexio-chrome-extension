import { loadTemplates } from "../../../shared/chromeStorageTemplateEntries";
import { billableCheckbox } from "../selectors/billableCheckbox";
import { contactField } from "../selectors/contactField";
import { workFieldID, statusFieldID, contactPersonID, projectFieldID, packageFieldID } from "../selectors/selectors";
import triggerCheckbox from "./triggerCheckbox";
import triggerContactField from "./triggerContactField";
import triggerField from "./triggerField";

// Fill form
async function fillForm(id) {
    const templateEntries = await loadTemplates();
    const entry = templateEntries.find(entry => entry.id === id);
    const { contact, contactPerson = null, project = null, status = null, billable = true } = entry;
    // Workaround because "package" is actually a reserved word
    const packageValue = entry.package ?? null;

    await triggerField(workFieldID, "work");
    await triggerField(statusFieldID, status);

    // Project connections
    await triggerContactField(contactField, contact);
    await triggerField(contactPersonID, contactPerson);
    await triggerField(projectFieldID, project);

    await triggerField(packageFieldID, packageValue);
    await triggerCheckbox(billableCheckbox, billable);

    // TODO: Loading indicator - to know when the process is done.
}

export default fillForm;