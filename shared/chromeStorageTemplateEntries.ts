import { TemplateEntry } from "../types";

export async function loadTemplateEntries(): Promise<TemplateEntry[]> {
    // @ts-ignore
    return await chrome.storage.local.get(["entries"]).then((result) => {
        if (result.entries && Array.isArray(result.entries)) {
            return result.entries as TemplateEntry[];
        }
        return [];
    });
}