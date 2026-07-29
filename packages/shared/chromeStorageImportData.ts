// `update` is intentionally not imported — the only caller is the commented-out
// `updateTemplate` below, and an unused import trips `noUnusedLocals`.
import { load, remove, save } from "./chromeStorage";
import { ImportData } from "./types";
const importDataKey = "importData";

// TODO: They are still unused, and need to get header and footer handlers as well.
export async function loadImportData(): Promise<ImportData[]> {
    const loadedImportData = await load<ImportData[]>(importDataKey);
    return loadedImportData ?? [];
}
export async function deleteImportData(id: string): Promise<any> {
    return remove<ImportData>(id, importDataKey);
}
export async function saveImportData(entries: ImportData[]): Promise<any> {
    return save<ImportData[]>(entries, importDataKey);
}

// // Updating selected template
// export async function updateTemplate(updatedEntry: ImportData): Promise<any> {
//     return update<ImportData>(updatedEntry, importDataKey);
// }