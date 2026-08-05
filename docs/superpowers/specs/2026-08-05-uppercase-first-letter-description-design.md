# Design — "Capitalize notes" toggle for the applied description

**Date:** 2026-08-05
**Status:** approved for implementation

## Problem

ManicTime tags and notes are usually written in lower case (`leister weekly`, `operations`).
When such a value is applied to bexio's time-entry description it lands verbatim, so the
booked entry starts with a lower-case letter. Users who want a consistently capitalized
description currently have to fix every entry by hand.

## Feature

A second switch next to the existing **"Apply notes"** switch in the side panel's
*Apply imported data* section. When it is on, the first letter of the description is
uppercased as the entry is applied to bexio. It is **on by default**; switching it off
restores today's verbatim behaviour.

## Scope

In scope: the description that the side panel sends with a `time+duration` message —
the only description the extension ever writes (`triggerDescription` has exactly one
caller, `onMessage.ts`). Templates carry no description field, so nothing else is affected.

Out of scope: title-casing every word, sentence-casing after `.`/`!`/`?`, rewriting the
stored import buffer, and a per-row override. The transform is applied on the way into
bexio only — the ManicTime data shown in the side-panel table stays untouched, so the
user always sees what they actually imported.

## Design

### Setting — `packages/shared/chromeStorageSettings.ts`

A new key next to the existing ones, following the same shape as `applyNotesSetting`:

| Key | Type | Default |
|-----|------|---------|
| `"uppercaseFirstLetterSetting"` | `boolean` | `true` |

Exports `loadUppercaseFirstLetterSetting()` / `saveUppercaseFirstLetterSetting(value)`.
It lives in `shared` because the side panel writes it and the content script reads it,
exactly like `applyNotesSetting`.

Defaulting to `true` means existing users get the new behaviour without touching
anything, which is what the feature request asked for. Nothing is migrated: an absent
key reads as `true`.

### Transform — `packages/chrome-extension/src/utils/capitalizeFirstLetter.ts`

```ts
value.replace(/\S/u, (character) => character.toUpperCase());
```

One regex replacement, first match only:

- **Leading whitespace is skipped**, so `" leister weekly"` becomes `" Leister weekly"`.
  ManicTime cells are not trimmed by `handleCsvData` (it only trims whole lines), so a
  padded cell is a realistic input and `charAt(0)` would silently do nothing there.
- **The `u` flag makes `\S` match a whole code point**, so an emoji or astral character
  is not split into broken surrogate halves.
- An empty or whitespace-only string has no match and is returned unchanged.
- A first character without an uppercase form (a digit, `#`, `"`) maps to itself, so the
  string is returned unchanged rather than mangled.

The helper lives in the chrome-extension package, not in `shared`, because the content
script is its only consumer.

### Wiring — `packages/chrome-extension/src/eventListeners/onMessage.ts`

The transform happens in the content script, inside the branch that already gates on
`applyNotesSetting`:

```ts
const applyNotesSetting = await loadApplyNotesSetting();
if (applyNotesSetting && request.notes !== undefined) {
  const uppercaseFirstLetter = await loadUppercaseFirstLetterSetting();
  triggerDescription(uppercaseFirstLetter ? capitalizeFirstLetter(request.notes) : request.notes);
}
```

Doing it here rather than in the side panel keeps both description settings read at the
same point, from the same storage, immediately before the single write — so a toggle
flipped in the panel takes effect on the next applied entry with no message-shape change.
`ExchangeRequestData` stays as it is.

### UI — `packages/sidePanel-import/src/components/ImportEntries/ImportEntries.tsx`

A second antd `Switch` immediately after the "Apply notes" switch above the table,
wrapped in a `Tooltip` like its neighbour:

- `checkedChildren="Capitalize notes"`, `unCheckedChildren="Don't capitalize"`
- Tooltip: explains that only the first letter is changed and that it applies when the
  entry is booked into bexio.

State mirrors `applyNotesSetting` exactly: a `useState(true)`, loaded in the existing
mount `useEffect`, saved and set together in a `switchUppercaseFirstLetterSetting()`
handler.

The switch is added only above the table, not to the duplicate that "Apply notes" has in
the `Notes` column header — the column header is about the notes column itself, and a
second copy of the new switch there would only add noise.

The switch stays enabled when "Apply notes" is off. It then has no effect, which the
tooltip states; wiring a `disabled` prop would couple the two controls for no real gain.

## Testing

| Test | File |
|------|------|
| default `true`, round-trip, correct storage key | `packages/shared/test/chromeStorageSettings.test.ts` |
| lower-case, leading whitespace, empty, non-letter start, already-uppercase, astral char | `packages/chrome-extension/test/utils/capitalizeFirstLetter.test.ts` |
| default on → description capitalized; setting off → verbatim; notes off → no description at all | `packages/chrome-extension/test/eventListeners/onMessage.test.ts` |
| switch renders, is on by default, persists when toggled | `packages/sidePanel-import/test/importEntries.test.tsx` |

## Docs to update

- `docs/architecture/storage.md` — the storage-key table and the "Who reads / writes what" table.
- `docs/architecture/form-layer.md` — the `time+duration` bullet in the messaging contract.
