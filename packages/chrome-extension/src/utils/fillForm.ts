import { chromeStorageTemplateEntries } from "@bexio-chrome-extension/shared";
import { billableCheckbox } from "../selectors/billableCheckbox";
import { contactField } from "../selectors/contactField";
import { workFieldID, statusFieldID, contactPersonID, projectFieldID, packageFieldID } from "../selectors/selectors";
import triggerCheckbox from "./triggerCheckbox";
import triggerContactField from "./triggerContactField";
import triggerField from "./triggerField";
import { toggleDisplayLoader } from "./loader";

// Fill form
async function fillForm(id: string, timeEntryBillable?: boolean) {
  toggleDisplayLoader();
  const templateEntries = await chromeStorageTemplateEntries.loadTemplates();
  const entry = templateEntries.find((entry) => entry.id === id);
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
  // If the time entry has a billable flag (timeEntryBillable), we prefer that one over the templates billable flag
  await triggerCheckbox(billableCheckbox, timeEntryBillable ?? billable);

  toggleDisplayLoader(false);

  // Focus the submit button, so the user can submit the form with the enter key directly if wanted
  const form = document.getElementById("MonitoringForm");
  const submitButton = form.getElementsByClassName("save")[0] as HTMLButtonElement;
  submitButton.focus();
}

export default fillForm;
