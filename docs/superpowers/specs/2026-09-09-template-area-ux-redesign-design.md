# Template Area UX Redesign — Design Spec

**Date:** 2026-09-09
**Scope:** the injected Templates panel on bexio `monitoring/edit*` — content script `packages/chrome-extension/src/apps/bexioTimetrackingTemplates/`, its stylesheet `packages/chrome-extension/public/bexioTimetrackingTemplates.css`, and the helpers it drives (`readFormData.ts`, `confirmTemplateDeletion.ts`).
**Out of scope:** the side panel, template sorting/favorites, the ManicTime import flow.

Interactive mockup (reviewed, delete model decided): <https://claude.ai/code/artifact/021f0f1a-bebe-430e-8bee-c49f19242586>

## Goals

Remove every native browser dialog (`alert`/`prompt`/`confirm`) from the template area, replace the hidden delete mode with an explicit, safe one, show what a template will fill before it is applied, and add an update action for existing templates.

## Current pain points

1. Add uses `prompt()`; delete uses up to three `alert()`/`confirm()` dialogs.
2. Delete mode is invisible: the only cue is the Delete button turning red, and the mode silently resets after one deletion.
3. A template button shows only its name — none of the six fields it will fill.
4. The filter matches only the name (not `keywords`), has no empty state, and no keyboard behaviour.
5. Changing a template means delete + re-add under a new name.
6. The version number sits prominently in the panel title.

## Design

### Chips (replace the solid blue buttons)

- Two-column layout stays; implementation moves from `column-count: 2` to a two-column CSS grid. Reading order becomes row-first, and per-chip show/hide and removal animations get simpler. `sortTemplates` order is unchanged.
- Resting chip: light blue fill, thin border, dark-blue text — visually quieter than today's solid `--soulcodeBlue` buttons.
- Active chip: filled `--soulcodeGreen`, white bold text, `✓` prefix (continuity with the current active style), plus `aria-pressed="true"`.
- Security rule stands: every template-derived string is rendered via `textContent` / property setters, never interpolated into HTML (see the comment block in `renderHtml.ts`).

### Field-preview tooltip

- Hovering a chip (~350 ms delay) shows a small card with the fields the template will fill: Tätigkeit (`work`), Projekt (`project`), Arbeitspaket (`package`), Kontakt (`contact`), Status (`status`), Abrechenbar (`billable` as Ja/Nein).
- Built with DOM nodes + `textContent` only; positioned inside the panel container and clamped to its width; hidden on click and while manage mode is active.

### Filter

- Matches template name **and** `keywords`, case-insensitive.
- Clear button inside the input (visible only when non-empty); `Esc` clears.
- `Enter` applies the single visible match; no-op when zero or several match.
- Empty state row: `No templates match "<query>"` instead of a silently empty area.

### Add — inline form (replaces `prompt()`)

- "+ Add" opens an inline row under the header: name input pre-filled with the suggested name (existing suggestion logic in `readFormData`), Save/Cancel buttons, `Enter` saves, `Esc` cancels.
- The duplicate-hash case shows an inline error in that row instead of the current `confirm()` retry loop.

### Update (new)

- The active chip shows a small `↻ Update` button. Clicking it overwrites that template's field values with the current form values, keeping `id` and `templateName`; the chip briefly shows "Updated ✓".
- `id` stays stable on update. It is an identifier, not a checksum — the hash is only ever computed at creation time, and the side panel references templates by `id` (`TemplateExchangeData.templateId`).

### Delete — manage mode with undo (decided: Variant B of the mockup)

- The header gets a ghost **Manage** button; clicking it toggles manage mode (button becomes **Done**).
- In manage mode: chips restyle to a "deletable" look (red/dashed with a permanent `×`), clicking a chip does **not** apply it, tooltip and Update are suppressed, Add is disabled, the filter keeps working.
- Clicking `×` deletes the template from storage immediately and shows an in-panel toast `Deleted "<name>" — Undo` for 5 seconds. Undo re-saves the kept entry. Exiting manage mode hides the toast (the undo window ends).
- The old Delete button, the hidden delete mode, and all related `alert()`/`confirm()` calls are removed; `confirmTemplateDeletion.ts` is replaced by this flow.
- Rationale: in the full design, hover is already used by the preview tooltip and the active chip carries the Update button, so a hover-`×` (Variant A) would collide with both. A mode keeps destructive actions fully separated and — unlike today's — unmistakably visible. Undo replaces confirmation dialogs.

### Header cleanup

- The version number and build date move from the `h2` text into its `title` tooltip.

## Error handling

- Storage failures (save/update/delete/undo) surface as a short inline toast in the panel — never a native dialog.
- Undo is defensive against concurrent changes (the side panel writes the same `entries` key): before re-inserting, check the entry's `id` is not already present.

## Not in this iteration (optional polish later)

- Restyling the full-screen blocking loader shown while a template is applied. It stays as-is for now: it exists to block input during the async select2 fill.
- Usage-based ordering / favorites.

## Testing impact

- `packages/chrome-extension/test/apps/bexioTimetrackingTemplates.test.ts` pins the current dialog/delete-mode behaviour and must be rewritten for: manage mode + undo, inline add, keyword-aware filter, Enter-to-apply, empty state, tooltip rendering.
- New behaviours worth pinning: undo restores the entry exactly once; `Enter` applies only with exactly one visible match; tooltip and chip rendering stay `textContent`-only (no HTML injection through template names).
- E2E specs that exercise the template UI need the same updates; the manual walkthrough checklist in `docs/architecture/testing.md` must be revised.

## Implementation constraints

- Plain TypeScript, no framework (chrome-extension package rule).
- Styles go into `public/bexioTimetrackingTemplates.css`, reusing the existing `--soulcodeGreen` / `--soulcodeBlue` tokens.
- Read `docs/architecture/form-layer.md` and `docs/architecture/storage.md` before touching `readFormData` / storage helpers.
