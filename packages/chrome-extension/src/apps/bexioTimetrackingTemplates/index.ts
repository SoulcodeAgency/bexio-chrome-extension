import { chromeStorageTemplateEntries, sortTemplates } from "@bexio-chrome-extension/shared";
import renderHtml from "./renderHtml";
import "../../eventListeners/onMessage";
import { watchEditorModalSave, watchMonitoringFormSubmit } from "../../eventListeners/onFormSubmit";
import { getOpenEditorModal, hasMonitoringForm } from "../../selectors/timeEntryModal";
import { prepareEditorModalColumn, watchEditorModal } from "./editorModalColumn";

async function renderIntoEditorModal(modal: HTMLElement) {
  const templateEntries = await chromeStorageTemplateEntries.loadTemplates();
  // The dialog may have closed while storage answered.
  if (!modal.isConnected) return;
  renderHtml(sortTemplates(templateEntries), prepareEditorModalColumn(modal));
}

/**
 * Renders the Templates block — on the old `monitoring/edit` page into its form, on the pages of
 * bexio's new time tracking (#168) into every time entry dialog that opens. Runs on load and again
 * on the side panel's "reload" and after a template was added.
 */
export async function initializeExtension() {
  if (hasMonitoringForm()) {
    // Get all templateEntries in storage and initialize the page
    const templateEntries = await chromeStorageTemplateEntries.loadTemplates();
    renderHtml(sortTemplates(templateEntries));
    // Let the side panel know when this form gets saved (idempotent across re-inits).
    watchMonitoringFormSubmit();
    return;
  }

  // New UI: both watchers are idempotent.
  watchEditorModalSave();
  watchEditorModal((modal) => void renderIntoEditorModal(modal));
  const modal = getOpenEditorModal();
  if (modal) await renderIntoEditorModal(modal);
}

initializeExtension();
