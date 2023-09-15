import { TemplateEntry } from "./types";

// handle template name
function getTemplateName(entry: TemplateEntry): string {
    // Note: id was the template name in version 0.4.x - where no templateName did exist
    return entry.templateName ?? entry.id ?? "unknown template name";
}

export default getTemplateName;