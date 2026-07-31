import { chromeStorageTemplateEntries } from "@bexio-chrome-extension/shared";
import { billableCheckbox } from "../selectors/billableCheckbox";
import { contactField } from "../selectors/contactField";
import { workFieldID, statusFieldID, contactPersonID, projectFieldID, packageFieldID } from "../selectors/selectors";
import triggerCheckbox from "./triggerCheckbox";
import triggerContactField from "./triggerContactField";
import triggerField from "./triggerField";
import { toggleDisplayLoader } from "./loader";
import { initializeExtension } from "../apps/bexioTimetrackingTemplates/index";
import { TemplateEntry } from "@bexio-chrome-extension/shared/types";

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
 * 10. Focus `#MonitoringForm .save` so the user can submit with Enter.
 * 11. `toggleDisplayLoader(false)` — hide the loader, in a `finally` so that a
 *     failure anywhere in steps 2–10 cannot leave the overlay on screen (#73).
 *     The error itself is not swallowed and still reaches the caller.
 *
 * Steps 3–10 are skipped when no template matches `id` (a stale id — the template
 * was deleted meanwhile). The form stays untouched; once the loader is gone, the
 * template list is re-rendered and the user gets an `alert()`.
 *
 * @param id               The template entry's `id` field.
 * @param timeEntryBillable  When provided, overrides the template's `billable`
 *                           flag via `timeEntryBillable ?? billable`.
 */
// Fill form
async function fillForm(id: string, timeEntryBillable?: boolean) {
  toggleDisplayLoader();
  let entry: TemplateEntry | undefined;

  try {
    const templateEntries = await chromeStorageTemplateEntries.loadTemplates();
    entry = templateEntries.find((entry) => entry.id === id);

    // A missing entry is handled after the loader is gone (see below), so that the
    // alert() does not pop up over a still-visible overlay.
    if (entry) {
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

      // Focus the submit button, so the user can submit the form with the enter key directly if wanted
      const form = document.getElementById("MonitoringForm")!;
      const submitButton = form.getElementsByClassName("save")[0] as HTMLButtonElement;
      submitButton.focus();
    }
  } finally {
    // The single place that hides the loader again. Anything in the body can throw -
    // changed bexio markup, a missing save button, a select2 widget that is gone - and
    // without this the overlay would stay on screen forever (#73). The error is not
    // swallowed: it keeps propagating to the caller. Note this only covers throws; a
    // waitFor* that never settles never gets here (see docs/architecture/form-layer.md).
    toggleDisplayLoader(false);
  }

  // The caller's id can be stale: the side panel (or this page's button list) may still
  // show a template that was deleted in another tab or window. Tell the user why nothing
  // happened and re-render the list so the stale button is gone.
  if (!entry) {
    console.warn(`No template found for id "${id}" - it was probably deleted in another tab or window.`);
    await initializeExtension();
    alert("This template does not exist anymore. It was probably deleted in another tab or window.");
  }
}

export default fillForm;
