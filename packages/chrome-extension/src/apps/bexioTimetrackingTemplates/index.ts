import {
  chromeStorageTemplateEntries,
  sortTemplates,
} from "@bexio-chrome-extension/shared";
import renderHtml from "./renderHtml";
import "../../eventListeners/onMessage";

export async function initializeExtension() {
  // Get all templateEntries in storage and initialize the page
  const templateEntries = await chromeStorageTemplateEntries.loadTemplates();
  renderHtml(sortTemplates(templateEntries));
}

initializeExtension();
