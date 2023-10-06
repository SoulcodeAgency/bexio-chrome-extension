import { deleteTemplate, loadTemplates } from "@bexio-chrome-extension/shared/chromeStorageTemplateEntries";

async function confirmTemplateDeletion(templateId: string, templateName: string) {
    if (templateId !== undefined) {
        if (confirm(`Are you sure you want to delete the template "${templateName}"?`)) {
            deleteTemplate(templateId).then(() => loadTemplates());
        }
    } else {
        alert("Sorry - Something went wrong!");
    }
}

export default confirmTemplateDeletion;