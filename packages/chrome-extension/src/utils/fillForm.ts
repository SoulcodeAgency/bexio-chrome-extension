import { chromeStorageTemplateEntries } from "@bexio-chrome-extension/shared";
import { billableCheckbox } from "../selectors/billableCheckbox";
import { contactField } from "../selectors/contactField";
import { workFieldID, statusFieldID, contactPersonID, projectFieldID, packageFieldID, getLoader } from "../selectors/selectors";
import triggerCheckbox from "./triggerCheckbox";
import triggerContactField from "./triggerContactField";
import triggerField from "./triggerField";

// Fix typescript error, for startViewTransition API
interface CustomDocument extends Document {
    startViewTransition: (callback: () => void) => void;
}

function swapDisplayStyle(show = true) {
    const loader = getLoader();
    loader.style.display = show ? "flex" : "none";
}

function toggleDisplayLoader(show = true) {
    // Fallback for browsers that don't support this API:
    if (!(document as CustomDocument).startViewTransition) {
        swapDisplayStyle(show);
        return;
    }
    // With a transition:
    (document as CustomDocument).startViewTransition(() => swapDisplayStyle(show));
}

// Fill form
async function fillForm(id) {
    toggleDisplayLoader();
    const templateEntries = await chromeStorageTemplateEntries.loadTemplates();
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

    toggleDisplayLoader(false);
}

export default fillForm;