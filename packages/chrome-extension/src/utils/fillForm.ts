import { chromeStorageTemplateEntries } from "@bexio-chrome-extension/shared";
import { billableCheckbox } from "../selectors/billableCheckbox";
import { contactField } from "../selectors/contactField";
import { workFieldID, statusFieldID, contactPersonID, projectFieldID, packageFieldID } from "../selectors/selectors";
import triggerCheckbox from "./triggerCheckbox";
import triggerContactField from "./triggerContactField";
import triggerField from "./triggerField";
import { toggleDisplayLoader } from "./loader";
import { initializeExtension } from "../apps/bexioTimetrackingTemplates/index";
import { WaitForTimeoutError } from "./pollUntil";
import { TemplateEntry } from "@bexio-chrome-extension/shared/types";

/**
 * Fills the bexio monitoring-edit form with the template identified by `id`.
 *
 * Orchestration order (see `docs/architecture/form-layer.md` for details):
 * 1. `toggleDisplayLoader()` — show the loader overlay.
 * 2. Load templates from `chrome.storage.local`; find the entry by `id`.
 * 3. `triggerField(workFieldID, work)` — `null` if absent (legacy templates saved
 *    before the field existed); `triggerField` then leaves the field untouched.
 * 4. `triggerField(statusFieldID, status)` — `null` if absent from template.
 * 5. `triggerContactField(contactField, contact)` — `null` if absent; an empty or
 *    missing contact is skipped instead of hanging the autocomplete (#82).
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
 * A `WaitForTimeoutError` — one of the `waitFor*` helpers gave up because bexio
 * never produced the DOM it was waiting for (#83) — is the one error that is
 * caught here instead of propagating: neither caller awaits `fillForm`, so
 * rethrowing would only produce an unhandled rejection, and this failure mode is
 * common enough (AJAX error, offline, no matching option) to deserve real user
 * feedback. It is reported like the stale-id case: console + `alert()`, after the
 * loader is gone. Every other error still propagates untouched.
 *
 * @param id               The template entry's `id` field.
 * @param timeEntryBillable  When provided, overrides the template's `billable`
 *                           flag via `timeEntryBillable ?? billable`.
 */
// Fill form
async function fillForm(id: string, timeEntryBillable?: boolean) {
  toggleDisplayLoader();
  let entry: TemplateEntry | undefined;
  let timeout: WaitForTimeoutError | undefined;

  try {
    const templateEntries = await chromeStorageTemplateEntries.loadTemplates();
    entry = templateEntries.find((entry) => entry.id === id);

    // A missing entry is handled after the loader is gone (see below), so that the
    // alert() does not pop up over a still-visible overlay.
    if (entry) {
      const { contact = null, work = null, contactPerson = null, project = null, status = null, billable = true } = entry;
      // Workaround because "package" is actually a reserved word
      const packageValue = entry.package ?? null;

      await triggerField(workFieldID, work);
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
  } catch (error) {
    // A waitFor* gave up: bexio never rendered what the next step needs. Handled
    // below (after the loader is gone) instead of rethrown, because no caller awaits
    // fillForm and an unhandled rejection would tell the user nothing (#83).
    if (!(error instanceof WaitForTimeoutError)) throw error;
    timeout = error;
  } finally {
    // The single place that hides the loader again. Anything in the body can throw -
    // changed bexio markup, a missing save button, a select2 widget that is gone - and
    // without this the overlay would stay on screen forever (#73). Errors other than a
    // WaitForTimeoutError are not swallowed: they keep propagating to the caller.
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

  // The form is left half-filled in this case; say so, so nobody submits a partial
  // time entry believing the template was applied.
  if (timeout) {
    console.error("Applying the template timed out.", timeout);
    alert(
      `The template could not be applied completely: ${timeout.message}\n\n` +
        "bexio may be slow or offline right now. Please check the form and try again.",
    );
  }
}

export default fillForm;
