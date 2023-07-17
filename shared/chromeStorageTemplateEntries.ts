import { TemplateEntry } from "../types";
import { load, remove, save } from "./chromeStorage";
const templateEntriesKey = "entries";

export async function loadTemplates(): Promise<TemplateEntry[]> {
    return load<TemplateEntry>(templateEntriesKey);
}

export async function deleteTemplate(id) {
    return remove(id, templateEntriesKey);
}

export async function saveTemplates(entries) {
    return save(entries, templateEntriesKey);
}