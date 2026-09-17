import { FormSubmittedMessage } from "@bexio-chrome-extension/shared/types";
import { monitoringFormId } from "../utils/submitMonitoringForm";

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

  form.addEventListener("submit", () => {
    const message: FormSubmittedMessage = { mode: "form-submitted" };
    Promise.resolve(chrome.runtime.sendMessage(message)).catch((error: unknown) => {
      // Normal when the side panel is closed: "Receiving end does not exist."
      console.warn("No extension page received form-submitted:", error);
    });
  });
}

export default watchMonitoringFormSubmit;
