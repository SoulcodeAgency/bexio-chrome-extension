// handle template name
function getTemplateName(entry) {
    return entry.templateName ?? entry.id ?? "unknown template name"; // Note: id was the template name in version 0.4.x - where no templateName did exist
}

export default getTemplateName;