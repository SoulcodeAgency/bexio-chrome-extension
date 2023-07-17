import { load, remove, save } from "./chromeStorage";
import { ImportData } from "../types";
const importDataKey = "importData";

export async function loadImportData(): Promise<ImportData[]> {
    return load<ImportData>(importDataKey);
}

export async function deleteImportData(id: string): Promise<any> {
    return remove<ImportData>(id, importDataKey);
}

export async function saveImportData(entries: ImportData[]): Promise<any> {
    return save<ImportData>(entries, importDataKey);
}