import { TemplateEntry } from "../types";

export default async function loadLocalTemplateEntries(): Promise<TemplateEntry[]> {
    return await chrome.storage.local.get(["entries"]).then((result) => {
        if (result.entries && Array.isArray(result.entries)) {
            return result.entries as TemplateEntry[];
        }
        return [];
    });
}