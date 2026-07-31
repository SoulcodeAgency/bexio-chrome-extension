import { chromeStorageTemplateEntries } from "@bexio-chrome-extension/shared";
import { billableCheckbox } from "../selectors/billableCheckbox";
import { contactField } from "../selectors/contactField";
import { workFieldID, statusFieldID, contactPersonID, projectFieldID, packageFieldID } from "../selectors/selectors";
import triggerCheckbox from "./triggerCheckbox";
import triggerContactField from "./triggerContactField";
import triggerField from "./triggerField";
import { toggleDisplayLoader } from "./loader";

/**
 * Fills the bexio monitoring-edit form with the template identified by `id`.
 *
 * Orchestration order (see `docs/architecture/form-layer.md` for details):
 * 1. `toggleDisplayLoader()` — show the loader overlay.
 * 2. Load templates from `chrome.storage.local`; find the entry by `id`.
 * 3. `triggerField(workFieldID, "work")` — always the literal string `"work"`.
 * 4. `triggerField(statusFieldID, status)` — `null` if absent from template.
 * 5. `triggerContactField(contactField, contact)`.
 * 6. `triggerField(contactPersonID, contactPerson)` — `null` if absent.
 * 7. `triggerField(projectFieldID, project)` — `null` if absent.
 * 8. `triggerField(packageFieldID, packageValue)` — `null` if absent.
 * 9. `triggerCheckbox(billableCheckbox, timeEntryBillable ?? billable)`:
 *    - `timeEntryBillable` (from a sidePanel import entry) overrides the
 *      template's `billable` flag when provided.
 *    - `billable` defaults to `true` when absent from the template.
 * 10. `toggleDisplayLoader(false)` — hide the loader.
 * 11. Focus `#MonitoringForm .save` so the user can submit with Enter.
 *
 * @param id               The template entry's `id` field.
 * @param timeEntryBillable  When provided, overrides the template's `billable`
 *                           flag via `timeEntryBillable ?? billable`.
 */
// Fill form
async function fillForm(id: string, timeEntryBillable?: boolean) {
  toggleDisplayLoader();
  const templateEntries = await chromeStorageTemplateEntries.loadTemplates();
  // KNOWN ISSUE (#73): `find` returns undefined when no template matches `id`, and the
  // destructuring below then throws, leaving the loader spinning. The `!` pins that
  // existing behaviour rather than picking a recovery strategy here.
  const entry = templateEntries.find((entry) => entry.id === id)!;
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
  const form = document.getElementById("MonitoringForm")!;
  const submitButton = form.getElementsByClassName("save")[0] as HTMLButtonElement;
  submitButton.focus();
}

export default fillForm;
