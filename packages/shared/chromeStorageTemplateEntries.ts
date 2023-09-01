import { TemplateEntry } from "./types";
import { load, remove, save } from "./chromeStorage";
const templateEntriesKey = "entries";

export async function loadTemplates(): Promise<TemplateEntry[]> {
    return load<TemplateEntry>(templateEntriesKey);
}

export async function deleteTemplate(id: string): Promise<any> {
    return remove<TemplateEntry>(id, templateEntriesKey);
}

export async function saveTemplates(entries: TemplateEntry[]): Promise<any> {
    return save<TemplateEntry>(entries, templateEntriesKey);
}