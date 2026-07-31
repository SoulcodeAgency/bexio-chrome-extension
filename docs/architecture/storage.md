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
| `"importHeader"` | `string[]` | `[]` | `ImportEntries.tsx` |
| `"importFooter"` | `string[]` | `[]` | `ImportEntries.tsx` |
| `"importTemplates"` | `string[]` (template id per row) | `[]` | `ImportEntries.tsx` |
| `"entryStatus"` | `{ [\`${columnIndex}-${entryIndex}\`]: boolean }` | `{}` | `ImportEntries.tsx` |

---

## The `"entries"` key — template storage

Template entries are stored as a flat array under the single key `"entries"`. Every write replaces the entire array.

`chromeStorageTemplateEntries.ts` exports:

- `loadTemplates()` — returns the array or `[]` when absent.
- `saveTemplates(entries)` — replaces the whole array.
- `deleteTemplate(id)` — delegates to `chromeStorage.remove(id)`, which filters the array by `entry.id !== id`.
- `updateTemplate(entry)` — delegates to `chromeStorage.update(entry)`, which replaces the matching element by `id` (shallow merge).

---

## The import buffer — `"importHeader"`, `"importData"`, `"importFooter"`, `"importTemplates"`, `"entryStatus"`

`ImportData` is defined in `types.ts` as `string[]` (a single row of column values). The module stores an array of these rows: `string[][]` under the key `"importData"`.

`chromeStorageImportData.ts` exports `loadImportData`, `saveImportData`, and `deleteImportData`. The module is marked TODO in source — the delete and update paths are not fully implemented (the commented-out `updateImportData` is disabled). The side panel does **not** use it: `ImportEntries.tsx` writes all five import keys directly through `chromeStorage.save`.

The five keys are **one logical record**, not five independent ones:

- `"importTemplates"` is indexed by row (`importTemplates[entryIndex]` = the template id applied with that row),
- `"entryStatus"` is keyed by `` `${columnIndex}-${entryIndex}` `` (which tracking-day cells were already booked into bexio).

Both are therefore only meaningful together with the exact `"importData"` / `"importHeader"` they were produced for. `ImportEntries.tsx` keeps them consistent by writing all five keys together in `persistImport()`:

- **Parsing new clipboard data** (`convertImportData`, i.e. every successful paste) writes the new header/data/footer and resets `"entryStatus"` to `{}` and `"importTemplates"` to `[]`. The reset lives here, not in `saveImport`, because auto-map, the per-row template `<select>` and the ▶️ apply button all persist their key immediately — even for data the user never saved. Writing the parsed data through on paste is what keeps those later single-key writes attached to the right rows.
- **"Save this import"** (`saveImport`) re-writes the same five keys with the *current* status/templates. It must not reset them; that already happened when the data was parsed.
- **"Delete saved data"** (`removeImportData`) clears all five.

A failed parse writes nothing: storage keeps the last successfully parsed dataset with its own status/templates, so the record stays coherent even though the (empty) React state no longer matches it.

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

In version 0.4.x and earlier there was no `templateName` field; the `id` field served as the human-readable name. `getTemplateName.ts` handles this: it returns `entry.templateName ?? entry.id ?? "No template name found"`. Any code that displays **or matches on** a template's name **must** go through `getTemplateName` — there is no migration that backfills `templateName`, so a pre-v0.5 entry survives indefinitely and `entry.templateName` may be `undefined` at any time.

Reading `entry.templateName` directly is what broke the auto-mapper (`AutoMapTemplatesV3.ts`): a single legacy template threw a `TypeError` mid-scoring and the whole "Auto map templates" run aborted silently. It now resolves the name via `getTemplateName` (issue #91). A one-time migration that backfills `templateName` from `id` is still open.

Note also that `id` is not derived from the name — it is a SHA-256 hash of the template's field values (`generateHash.ts`), so **two distinct templates may share the same name**. Anything that groups or indexes templates must key on `id`, never on the name.

---

## Array-only assumption in `chromeStorage.remove` and `chromeStorage.update`

Both `remove` and `update` assume the stored value is a `TemplateEntry[]`. Specifically:

- **`remove(id, key)`** — reads the stored value at `key`; if it is an array it filters by `entry.id !== id` and saves the result back to `key`. If the stored value is **not** an array it saves `[]` (silently drops whatever was stored).
- **`update(updatedEntry, key, idKey)`** — reads the stored value at `key`; if it is an array it finds the index with `findIndex`, does a shallow merge via spread, and saves the array back to `key`. If the stored value is not an array the update block is skipped and `save` is called with `undefined` (the raw result of `chrome.storage.local.get(key)` when the key is absent), which writes `undefined` to that key.

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

   *Fixed (issue #89):* `remove()` and `update()` used to read from `key` but call `save()` **without** it, so the result always landed under the default key `"entries"`. For any non-default key that left the target key stale **and** clobbered the template store — `deleteImportData(id)` would have written the `string[][]` import buffer over the user's templates. Both now pass `key` through to `save()`; covered by `test/chromeStorage.test.ts` (`remove`/`update: custom key`, asserted against raw storage keys) and `test/chromeStorageImportData.test.ts` (`deleteImportData does not touch the 'entries' (template) key`).

4. **`sortTemplates` mutates its input array.**
   `Array.prototype.sort` sorts in place; `sortTemplates` returns the same reference it was given. Callers that need the original order must copy the array first.
   Flagged in: `test/sortTemplates.test.ts` — `// KNOWN ISSUE: sortTemplates mutates its argument`.

5. **The import buffer is spread over five keys and written non-atomically.**
   `persistImport()` issues five separate `chrome.storage.local.set` calls. They are not a transaction: a side panel closed mid-write could in principle leave a new `"importData"` next to an old `"entryStatus"`. Storing the whole import (data + templates + status) under a single key would remove the class of bug entirely, but needs a migration for buffers already in users' browsers — see issue #87.
   Covered in: `packages/sidePanel-import/test/importEntries.test.tsx` — "import state does not survive a new import (issue #87)".

---

## Who reads / writes what

| Actor | Reads | Writes |
|-------|-------|--------|
| **Side panel app** (`packages/sidePanel-import`) | `loadTemplates`, `loadApplyNotesSetting`, `loadRemovePopoversSetting`, `loadActiveTabId`, the five import-buffer keys via `chromeStorage.load` | `saveTemplates`, `saveApplyNotesSetting`, `saveRemovePopoversSetting`, `saveActiveTabId`, `deleteTemplate`, `updateTemplate`, the five import-buffer keys via `chromeStorage.save` |
| **Content script** (`packages/chrome-extension`) | `loadTemplates`, `loadApplyNotesSetting`, `loadRemovePopoversSetting`, `loadActiveTabId` | Sends `chrome.runtime.sendMessage` to request side panel actions; does **not** write storage directly |
| **Service worker** (`service_worker.js`) | — | Routes messages between content script and side panel; does not access storage directly |

The side panel is the canonical writer for all keys. The content script reads settings and the template list to render the injection UI, but delegates mutations (create / update / delete template) to the side panel via `chrome.runtime.sendMessage`.
