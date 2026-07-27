# Storage Architecture — `packages/shared/` storage layer

## Overview

The extension stores all persistent data in `chrome.storage.local`. There is no remote backend; everything lives in the browser's local extension storage. All values are serialized as JSON by the Chrome API.

All storage access goes through the primitives in `packages/shared/chromeStorage.ts` (`load`, `save`, `remove`, `update`, `clear`), with higher-level wrappers in the three module files described below.

---

## Storage keys

| Key | Type | Default (when absent) | Owner module |
|-----|------|-----------------------|--------------|
| `"entries"` | `TemplateEntry[]` | `[]` (via `loadTemplates`) | `chromeStorageTemplateEntries.ts` |
| `"applyNotesSetting"` | `boolean` | `true` | `chromeStorageSettings.ts` |
| `"removePopoversSetting"` | `boolean` | `false` | `chromeStorageSettings.ts` |
| `"activeTabId"` | `string \| undefined` | `undefined` | `chromeStorageSettings.ts` |
| `"importData"` | `ImportData[]` (i.e. `string[][]`) | `[]` | `chromeStorageImportData.ts` |

---

## The `"entries"` key — template storage

Template entries are stored as a flat array under the single key `"entries"`. Every write replaces the entire array.

`chromeStorageTemplateEntries.ts` exports:

- `loadTemplates()` — returns the array or `[]` when absent.
- `saveTemplates(entries)` — replaces the whole array.
- `deleteTemplate(id)` — delegates to `chromeStorage.remove(id)`, which filters the array by `entry.id !== id`.
- `updateTemplate(entry)` — delegates to `chromeStorage.update(entry)`, which replaces the matching element by `id` (shallow merge).

---

## The `"importData"` key

`ImportData` is defined in `types.ts` as `string[]` (a single row of column values). The module stores an array of these rows: `string[][]` under the key `"importData"`.

`chromeStorageImportData.ts` exports `loadImportData`, `saveImportData`, and `deleteImportData`. The module is marked TODO in source — the delete and update paths are not fully implemented (the commented-out `updateImportData` is disabled).

---

## The `TemplateEntry` shape

```ts
type TemplateEntry = {
  templateName: string;
  keywords: string;
  billable: boolean;
  contact: string;
  contactPerson: string;
  id: string;
  package: string;
  project: string;
  status: "Offen" | "In Arbeit" | "Erledigt" | "Fakturiert" | "Geschlossen";
  work: string;
  [key: string]: any;   // escape hatch for future fields
};
```

The `status` values are the German bexio work-status labels. The `[key: string]: any` index signature allows extra fields to survive round-trips without TypeScript errors, which was necessary when new fields were added to templates already stored in users' browsers.

### Historical note — `id` was the template name before v0.4.x

In version 0.4.x and earlier there was no `templateName` field; the `id` field served as the human-readable name. `getTemplateName.ts` handles this: it returns `entry.templateName ?? entry.id ?? "No template name found"`. Any code that displays a template's name **must** go through `getTemplateName`.

---

## Array-only assumption in `chromeStorage.remove` and `chromeStorage.update`

Both `remove` and `update` assume the stored value is a `TemplateEntry[]`. Specifically:

- **`remove(id, key)`** — reads the stored value; if it is an array it filters by `entry.id !== id` and saves the result. If the stored value is **not** an array it saves `[]` (silently drops whatever was stored).
- **`update(updatedEntry, key, idKey)`** — reads the stored value; if it is an array it finds the index with `findIndex` and does a shallow merge via spread. If the stored value is not an array the update block is skipped and `save` is called with `undefined` (the raw result of `chrome.storage.local.get(key)` when the key is absent), which writes `undefined` to storage.

---

## Known issues (surfaced by tests)

1. **`remove()` silently replaces a non-array value with `[]`.**
   If the key happens to hold a non-array value (e.g. a settings object stored under the wrong key), `remove()` will overwrite it with an empty array without warning.
   Flagged in: `test/chromeStorage.test.ts` — `// KNOWN ISSUE: remove() silently replaces a non-array value with []`.

2. **`update()` with an unknown `id` sets `arr[-1]` (non-index property) on the array.**
   When `findIndex` returns `-1` (no match), the code does `entries[key][-1] = {...mergedEntry}`. In JavaScript, `arr[-1] = x` sets a named property (not an integer index) on the array object. The array's `length` is unchanged and numeric iteration skips the property, but the property is present on the object.
   In real `chrome.storage.local` (which serializes via JSON) this property would be silently dropped. In the in-memory test fake it survives the round-trip, making the stored value structurally corrupt until the next `saveTemplates` call replaces the whole array.
   Flagged in: `test/chromeStorage.test.ts` — `// KNOWN ISSUE: update() with an unknown id uses arr[-1] = {...}`.

3. **`deleteImportData(id)` is effectively a no-op.**
   `ImportData` is `string[]`, not an object with an `id` field. `chromeStorage.remove` filters by `entry.id !== id`, but `entry.id` is always `undefined` for `string[]` entries, so no entry is ever removed.
   Flagged in: `test/chromeStorageImportData.test.ts` — `// KNOWN ISSUE: deleteImportData(id) is effectively a no-op`.

4. **`sortTemplates` mutates its input array.**
   `Array.prototype.sort` sorts in place; `sortTemplates` returns the same reference it was given. Callers that need the original order must copy the array first.
   Flagged in: `test/sortTemplates.test.ts` — `// KNOWN ISSUE: sortTemplates mutates its argument`.

---

## Who reads / writes what

| Actor | Reads | Writes |
|-------|-------|--------|
| **Side panel app** (`packages/sidePanel-import`) | `loadTemplates`, `loadApplyNotesSetting`, `loadRemovePopoversSetting`, `loadActiveTabId`, `loadImportData` | `saveTemplates`, `saveApplyNotesSetting`, `saveRemovePopoversSetting`, `saveActiveTabId`, `saveImportData`, `deleteTemplate`, `updateTemplate` |
| **Content script** (`packages/chrome-extension`) | `loadTemplates`, `loadApplyNotesSetting`, `loadRemovePopoversSetting`, `loadActiveTabId` | Sends `chrome.runtime.sendMessage` to request side panel actions; does **not** write storage directly |
| **Service worker** (`service_worker.js`) | — | Routes messages between content script and side panel; does not access storage directly |

The side panel is the canonical writer for all keys. The content script reads settings and the template list to render the injection UI, but delegates mutations (create / update / delete template) to the side panel via `chrome.runtime.sendMessage`.
