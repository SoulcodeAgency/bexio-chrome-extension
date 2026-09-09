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
 * Re-inserts a previously deleted entry (undo). If an entry with the same id is
 * already present — it was re-added through the side panel meanwhile — nothing is
 * written and `false` is returned.
 *
 * That id check is the only concurrency guarantee here. Like every writer of the
 * `entries` key this is a read-modify-write over the whole array, not a
 * compare-and-swap: a side-panel write landing between the load and the save is
 * still overwritten. See `docs/architecture/storage.md`.
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
