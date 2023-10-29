import { TemplateEntry } from "./types";
import { load, remove, save, update } from "./chromeStorage";
const templateEntriesKey = "entries";

export async function loadTemplates(): Promise<TemplateEntry[]> {
    const loadedEntries = await load<TemplateEntry[]>(templateEntriesKey);
    return loadedEntries ?? [];
}

export async function deleteTemplate(id: string): Promise<any> {
    return remove<TemplateEntry>(id, templateEntriesKey);
}

export async function saveTemplates(entries: TemplateEntry[]): Promise<any> {
    return save<TemplateEntry[]>(entries, templateEntriesKey);
}

export async function updateTemplate(updatedEntry: TemplateEntry): Promise<any> {
    return update<TemplateEntry>(updatedEntry, templateEntriesKey);
}