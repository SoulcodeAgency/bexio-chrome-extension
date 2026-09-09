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

/**
 * Re-inserts a previously deleted entry (undo). Defensive against concurrent
 * writers (the side panel writes the same `entries` key): if an entry with the
 * same id is already present, nothing is written and `false` is returned.
 */
export async function restoreTemplate(entry: TemplateEntry): Promise<boolean> {
  const entries = await loadTemplates();
  if (entries.some((existing) => existing.id === entry.id)) {
    return false;
  }
  entries.push(entry);
  await saveTemplates(entries);
  return true;
}
