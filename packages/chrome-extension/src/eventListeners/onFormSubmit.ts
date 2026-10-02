import { FormSubmittedMessage } from "@bexio-chrome-extension/shared/types";
import { monitoringFormId } from "../utils/submitMonitoringForm";
import { EDITOR_MODAL_SELECTOR, getModalSaveButton } from "../selectors/timeEntryModal";
import pollUntil from "../utils/pollUntil";

/** Forms that already carry the listener — `initializeExtension` runs again on every "reload". */
const armedForms = new WeakSet<HTMLFormElement>();

/**
 * Tells the extension pages (the side panel) whenever bexio's time-entry form is submitted.
 *
 * Listens for the form's `submit` event, which fires for every way of saving — a click on
 * "Speichern", Enter inside the form, or the side panel's own `submit` request — and forwards it
 * as a `FormSubmittedMessage` via `chrome.runtime.sendMessage`. That is the only message that
 * travels content script → side panel; everything else goes the other way (see `onMessage.ts`).
 *
 * The event fires before the POST leaves, so this also fires when bexio rejects the entry
 * server-side and re-renders the form. The side panel documents that limitation next to its ✅.
 *
 * Idempotent: the form is armed once, however often the page UI is re-initialised. Safe on pages
 * without the form (does nothing) and when no side panel is open (the rejected `sendMessage` is
 * logged, not thrown).
 */
export function watchMonitoringFormSubmit(): void {
  const form = document.getElementById(monitoringFormId) as HTMLFormElement | null;
  if (!form || armedForms.has(form)) return;
  armedForms.add(form);

  form.addEventListener("submit", sendFormSubmitted);
}

function sendFormSubmitted() {
  const message: FormSubmittedMessage = { mode: "form-submitted" };
  Promise.resolve(chrome.runtime.sendMessage(message)).catch((error: unknown) => {
    // Normal when the side panel is closed: "Receiving end does not exist."
    console.warn("No extension page received form-submitted:", error);
  });
}

/**
 * How long a saved dialog may take to close. bexio closes it once the save request has answered;
 * a dialog that is still open after this was not saved (or bexio is very slow — then nothing is
 * reported, and the side panel's 📤 can be used again).
 */
export const EDITOR_MODAL_CLOSE_TIMEOUT_MS = 15_000;

let editorModalSaveListener: ((event: MouseEvent) => void) | undefined;

/**
 * The new time entry dialog's counterpart of {@link watchMonitoringFormSubmit} (#168). The dialog has
 * no `<form>` and fires no `submit` event, so "saved" is a click on "Eintrag speichern" followed by
 * the dialog leaving the DOM. A dialog that stays open — bexio rejected the entry — reports nothing.
 *
 * One capture-phase click listener on the document, armed once: the dialog comes and goes without a
 * page load, so there is no element to arm per dialog. Covers the user's own click and the side
 * panel's 📤, which clicks the same button.
 */
export function watchEditorModalSave(): void {
  if (editorModalSaveListener) return;
  editorModalSaveListener = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const modal = target?.closest("mat-dialog-container")?.querySelector<HTMLElement>(EDITOR_MODAL_SELECTOR);
    if (!target || !modal) return;
    const saveButton = getModalSaveButton(modal);
    if (!saveButton || saveButton.disabled || !saveButton.contains(target)) return;

    pollUntil(
      "the saved time entry dialog to close",
      () => !modal.isConnected,
      250,
      EDITOR_MODAL_CLOSE_TIMEOUT_MS,
    ).then(sendFormSubmitted, () =>
      console.warn("[bexio extension] The time entry dialog stayed open after saving - not reported as saved."),
    );
  };
  document.addEventListener("click", editorModalSaveListener, true);
}

/** Test hook: removes the listener again. */
export function resetEditorModalSaveWatcher(): void {
  if (editorModalSaveListener) document.removeEventListener("click", editorModalSaveListener, true);
  editorModalSaveListener = undefined;
}

export default watchMonitoringFormSubmit;
