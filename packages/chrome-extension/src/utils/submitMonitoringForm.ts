import { durationFieldId } from "../selectors/durationField";

export const monitoringFormId = "MonitoringForm";
export const saveButtonSelector = "button[type='submit'].save";

/**
 * Submits bexio's time-entry form the way the user would: by clicking the "Speichern" button.
 *
 * A programmatic `click()` runs the button's activation behaviour even from the content script's
 * isolated world — the browser fires a real `submit` event with `submitter = save`, TinyMCE's
 * submit hook copies the description into its textarea, and the POST carries the `save` control.
 * A synthetic Enter `KeyboardEvent` on the focused button does **not** do that (browsers run no
 * default action for untrusted key events), which is why the earlier "focus the save button"
 * approach only ever worked for a real keypress. Verified against live bexio on 2026-09-14.
 *
 * The elements are looked up at call time, not at module load: the page may have been re-rendered
 * since the content script was injected.
 *
 * @throws when the form or its save button is missing, or when the duration is empty — bexio
 *         would either reject the entry or, worse, book an empty one.
 */
export function submitMonitoringForm(): void {
  const form = document.getElementById(monitoringFormId);
  const saveButton = form?.querySelector<HTMLButtonElement>(saveButtonSelector) ?? null;
  if (!form || !saveButton) {
    throw new Error("Save button not found - is the bexio time-tracking form still open?");
  }

  const duration = form.querySelector<HTMLInputElement>(durationFieldId)?.value.trim() ?? "";
  if (duration === "") {
    throw new Error("The duration is empty - nothing to save. Apply an entry first.");
  }

  saveButton.focus();
  saveButton.click();
}

export default submitMonitoringForm;
