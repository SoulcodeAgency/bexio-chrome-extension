import { TemplateEntry } from "../types";

// TODO: Update importData type
export async function loadImportData(): Promise<TemplateEntry[]> {
    // @ts-ignore
    return await chrome.storage.local.get(["importData"]).then((result) => {
        if (result.entries && Array.isArray(result.entries)) {
            return result.entries as TemplateEntry[];
        }
        return [];
    });
}