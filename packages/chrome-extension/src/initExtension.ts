import { chromeStorageTemplateEntries, sortTemplates } from "@bexio-chrome-extension/shared";
import renderHtml from "./renderHtml";

async function initializeExtension() {
    // Get all templateEntries in storage and initialize the page
    const templateEntries = await chromeStorageTemplateEntries.loadTemplates();
    renderHtml(sortTemplates(templateEntries));
}

export default initializeExtension;