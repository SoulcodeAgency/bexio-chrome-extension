import { chromeStorageTemplateEntries } from "shared";
import initializeExtension from "../initExtension";

async function confirmDeletion() {
    const activeButton = document.querySelector(".template-button--active") ?? undefined;
    const activeTemplateName = activeButton?.textContent ?? undefined;
    const activeTemplateId = activeButton?.id ?? undefined;
    if (activeTemplateId !== undefined) {
        if (confirm(`Are you sure you want to delete the active template "${activeTemplateName}"?`)) {
            chromeStorageTemplateEntries.deleteTemplate(activeTemplateId).then(() => initializeExtension());
        }
    } else {
        alert("Sorry - There is no active template to delete or something went wrong! Please select first the template you want to delete. Thanks.");
    }
}

export default confirmDeletion;