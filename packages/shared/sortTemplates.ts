import { TemplateEntry } from './types';
import getTemplateName from './getTemplateName';

function sortTemplates(templateEntries: TemplateEntry[]): TemplateEntry[] {
    return templateEntries.sort((a, b) => getTemplateName(a).localeCompare(getTemplateName(b)));
}

export default sortTemplates;