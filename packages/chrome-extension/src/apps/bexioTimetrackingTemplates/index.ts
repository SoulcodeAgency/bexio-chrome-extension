import { chromeStorageTemplateEntries, sortTemplates } from "@bexio-chrome-extension/shared";
import renderHtml from "./renderHtml";
import "../../eventListeners/onMessage";
import { watchMonitoringFormSubmit } from "../../eventListeners/onFormSubmit";

export async function initializeExtension() {
  // Get all templateEntries in storage and initialize the page
  const templateEntries = await chromeStorageTemplateEntries.loadTemplates();
  renderHtml(sortTemplates(templateEntries));
  // Let the side panel know when this form gets saved (idempotent across re-inits).
  watchMonitoringFormSubmit();
}

initializeExtension();
