import { loadTemplates } from "../../shared/chromeStorageTemplateEntries";
import renderHtml from "./renderHtml";
import getTemplateName from "./utils/getTemplateName";

async function initializeExtension() {
    // Get all templateEntries in storage and initialize the page
    const templateEntries = await loadTemplates();
    // Sort the templateEntries according to the template name
    templateEntries.sort((a, b) => getTemplateName(a).localeCompare(getTemplateName(b)));
    renderHtml(templateEntries);
}

export default initializeExtension;