import { ImportData } from "../types";
import { load, remove, save } from "./chromeStorage";
const importDataKey = "importData";

export async function loadTemplates(): Promise<ImportData[]> {
    return load<ImportData>(importDataKey);
}

export async function deleteTemplate(id) {
    return remove(id, importDataKey);
}

export async function saveTemplates(entries) {
    return save(entries, importDataKey);
}