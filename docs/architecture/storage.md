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
| `"importHeader"` | `string[]` | `[]` | — (raw `chromeStorage`) |
| `"importFooter"` | `string[]` | `[]` | — (raw `chromeStorage`) |
| `"importTemplates"` | `string[]` (template id per import row) | `[]` | — (raw `chromeStorage`) |
| `"entryStatus"` | `{ [colIndex-rowIndex: string]: boolean }` | `{}` | — (raw `chromeStorage`) |

The last four keys ("the import-buffer keys" below) have no wrapper module:
`packages/sidePanel-import/src/components/ImportEntries/ImportEntries.tsx` calls
`chromeStorage.load` / `chromeStorage.save` with the key string inline (via its
`persistImport()` helper, which writes all five keys together — see issue #87). It
writes `"importData"` the same way rather than through `chromeStorageImportData.ts`.

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

**No app code imports this module.** It is re-exported from `packages/shared/index.ts` and covered by `packages/shared/test/chromeStorageImportData.test.ts`, but the side panel reads and writes `"importData"` through raw `chromeStorage` calls instead. Changing the module therefore changes nothing at runtime today.

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

2. **`update()` with an unknown `id` sets `arr[-1]` (non-index property) on the array — the update is silently lost.**
   When `findIndex` returns `-1` (no match), the code does `entries[key][-1] = {...mergedEntry}`. In JavaScript, `arr[-1] = x` sets a named property (not an integer index) on the array object. The array's `length` is unchanged and numeric iteration skips the property.
   `chrome.storage.local` serializes via JSON, so the property is dropped on the way in: the caller gets no error, and nothing is stored. The test fake serializes the same way (see `docs/architecture/testing.md`), so this is pinned as it actually behaves in production.
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
| **Side panel app** (`packages/sidePanel-import`) | `loadTemplates` (`TemplateProvider.tsx`), `loadApplyNotesSetting`, `loadActiveTabId`, plus raw `chromeStorage.load` for the import-buffer keys | `saveApplyNotesSetting`, `saveActiveTabId`, `deleteTemplate` (`TemplateEntries.tsx`), `updateTemplate` (`TemplateModal.tsx`), plus raw `chromeStorage.save` for the import-buffer keys |
| **Content script** (`packages/chrome-extension`) | `loadTemplates` (`apps/bexioTimetrackingTemplates/index.ts`, `utils/fillForm.ts`), `loadApplyNotesSetting` (`eventListeners/onMessage.ts`), `loadRemovePopoversSetting` (`apps/bexioProjectList/renderHtml.ts`, `utils/convertPopover.ts`) | `saveTemplates` (`utils/readFormData.ts`), `deleteTemplate` (`utils/confirmTemplateDeletion.ts`), `saveRemovePopoversSetting` (`apps/bexioProjectList/renderHtml.ts`) |
| **Service worker** (`public/service_worker.js`) | — | — |

**There is no canonical writer.** Both UI contexts write `chrome.storage.local`
directly, and both write the `"entries"` key. The content script does *not*
delegate template mutations to the side panel — the "Add" button in the injected
Templates block writes the template itself (`readFormData.ts`), and the "Delete"
button calls `deleteTemplate` itself (`confirmTemplateDeletion.ts`). The service
worker never touches storage at all; it only opens the bexio tab on toolbar-icon
click and enables the side panel per tab.

### Two-writer race on the `"entries"` key

Every template mutation is a **read-modify-write of the whole array** with no
compare-and-swap, and nothing anywhere listens to `chrome.storage.onChanged`. An
open side panel and an open `monitoring/edit` tab therefore hold independent
in-memory snapshots that never learn about each other's writes.

`chromeStorage.remove` / `chromeStorage.update` (behind `deleteTemplate` /
`updateTemplate`) at least re-read immediately before writing, so their window is
narrow. The lossy path is `readFormData.ts:41-111`, which saves an array it
snapshotted earlier:

1. Read the form fields and derive a suggested `templateName`.
2. `prompt("Name of the template:", …)` — a **blocking, unbounded** dialog. Cancel → `alert` + return.
3. `generateHash(JSON.stringify(formEntry))` → `formEntry.id`.
4. `loadTemplates()` — takes a snapshot of the *entire* array.
5. If the hash already exists: `confirm("… Try again?")` — another unbounded dialog. Yes → back to step 2 (which re-runs step 4, so the stale snapshot is discarded). No → return.
6. `allEntries.push(formEntry)` — mutates the snapshot.
7. `saveTemplates(allEntries)` — writes the snapshot back over the whole key, then `initializeExtension()` re-renders.

The window between the snapshot (step 4) and the write (step 7) is short on the
happy path — there is no dialog inside it — but it is real, and step 7 is an
unconditional overwrite. **Anything the side panel writes to `"entries"` between
steps 4 and 7 is silently lost**: a template renamed in the `TemplateModal`, or
one deleted from the side panel's template list, reappears/reverts as soon as the
bexio tab saves. The reverse also holds — a side-panel `deleteTemplate` that
lands just after step 4 is undone by step 7.

The side panel's own template list is loaded once per `reload` flip
(`TemplateProvider.tsx`), so after a content-script write it keeps showing the
pre-write list until something calls `reloadData`. This is not pinned by a test;
it is a latent hazard to keep in mind when adding new write paths.
