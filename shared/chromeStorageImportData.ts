import { load, remove, save, update } from "./chromeStorage";
import { ImportData } from "../types";
const importDataKey = "importData";

// TODO: They are still unused, and need to get header and footer handlers as well.
export async function loadImportData(): Promise<ImportData[]> {
    return load<ImportData>(importDataKey);
}
export async function deleteImportData(id: string): Promise<any> {
    return remove<ImportData>(id, importDataKey);
}
export async function saveImportData(entries: ImportData[]): Promise<any> {
    return save<ImportData>(entries, importDataKey);
}

// // Updating selected template
// export async function updateTemplate(updatedEntry: ImportData): Promise<any> {
//     return update<ImportData>(updatedEntry, importDataKey);
// }