# Frozen leading columns in the import table

Design for [issue #12](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/12).

## Problem

The ManicTime import table in the side panel (`packages/sidePanel-import`, rendered by
`ImportEntries.tsx`) grows one column per tracked day. With a month of data the table is far wider
than the panel, so booking an entry near the end of the month means scrolling the identifying
columns — `#`, `Template`, the `Tag n` columns and `Billable` — off screen. The user then clicks a
▶️ button without seeing which row it belongs to.

The header row already stays put when scrolling vertically. That comes from
`table thead { position: sticky; top: 0 }` in `TemplateEntries.css`, which uses an unscoped `table`
selector and therefore also styles the import table. The same treatment is missing on the
horizontal axis.

## Scope

Only `packages/sidePanel-import`. The content scripts and the `shared` package are untouched, and
no new setting is stored — the behaviour is always on.

## Behaviour

Every column left of the first date column stays fixed at the left edge while the date columns
scroll underneath it. Concretely that is `#`, `Template`, every `Tag n`, `Notes` if present, and
`Billable`.

A date column is one whose header matches `/^\d{2}[./]\d{2}[./]\d{4}$/` — the same regex
`ImportEntriesTableCell` already uses to decide whether a cell renders a ▶️ button.

Two edge cases follow from that rule:

- **No date column in the header.** Nothing is frozen. Freezing every column would make the whole
  table stick and scroll nothing.
- **The first header column is already a date.** Only `#` and `Template` are frozen — they are
  produced by the extension, not by the import, so they always come first.

The trailing `Total` column is not frozen: it sits after the date columns, and the rule only looks
at the leading block.

## Column model

Frozen columns get fixed widths so the `left` offsets can be summed from constants at render time.
No DOM measurement, no `ResizeObserver`.

| Column           | Width  |
| ---------------- | ------ |
| `#`              | 32 px  |
| `Template`       | 110 px |
| `Notes`          | 170 px |
| `Billable`       | 44 px  |
| anything else    | 90 px  |

`Notes` is wider than the other import columns because its header carries the "Apply notes" switch.
`Billable` is narrower because its cells only render ✅ or ◻️.

These values are a starting point. They are validated in the manual browser pass and may be tuned
during implementation; see "Testing" for how the tests are split so that tuning one constant does
not cascade.

Offsets are the running sum of the widths to the left. For the header from the existing test
fixtures, `["Tag 1", "Notes", "Billable", "01.07.2026", "02.07.2026", "Total"]`:

| Column   | Width | `left` |
| -------- | ----- | ------ |
| `#`      | 32    | 0      |
| Template | 110   | 32     |
| Tag 1    | 90    | 142    |
| Notes    | 170   | 232    |
| Billable | 44    | 402    |

The frozen block is 446 px wide; the date columns and `Total` scroll freely.

Cell content is clipped: `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`, with the
full value in a `title` attribute so nothing becomes unreadable. The native `<select>` in the
`Template` column gets `width: 100%` so it fits its fixed column instead of sizing itself to the
longest template name.

The existing `minWidth: 120px` that `ImportEntries.tsx` sets on the `Notes` header is superseded by
the frozen width whenever `Notes` is frozen.

## The unit that does the work

New module `packages/sidePanel-import/src/components/ImportEntries/frozenColumns.ts`.

```ts
export const DATE_COLUMN_REGEX = /^\d{2}[./]\d{2}[./]\d{4}$/;

export const FROZEN_COLUMN_WIDTHS = {
  index: 32,
  template: 110,
  notes: 170,
  billable: 44,
  default: 90,
} as const;

export type FrozenColumn = { left: number; width: number; isLast: boolean };

export type FrozenColumns = {
  index?: FrozenColumn;
  template?: FrozenColumn;
  /** one slot per importHeader column; undefined means the column scrolls */
  data: (FrozenColumn | undefined)[];
};

export function getFrozenColumns(importHeader: string[]): FrozenColumns;
```

It is a pure function of the header. `isLast` marks the rightmost frozen column, which carries the
separating shadow. `data` is index-aligned with `importHeader`, so the render code can look a
column up by the same index it already uses for the cell value.

`DATE_COLUMN_REGEX` moves here from `ImportEntriesTableCell.tsx`, which imports it instead of
declaring its own copy. Both places must agree on what a date column is.

## CSS

New rules go into `ImportEntries.css`, scoped to `.importDataTable`:

- `.importDataTable .frozenColumn { position: sticky; background-color: inherit; z-index: 1 }`
  plus the clipping declarations. `left` and `width` come from inline styles, since they depend on
  the header.
- `.importDataTable thead .frozenColumn { z-index: 3 }` — above both the body cells and the
  `thead`'s own `z-index: 2`.
- `.importDataTable .frozenColumn--last` adds `box-shadow: 2px 0 4px rgba(0, 0, 0, 0.25)` so the
  edge of the frozen block is visible.

**No new scroll container.** The document keeps scrolling horizontally and the sticky cells resolve
against the viewport. Wrapping the table in an `overflow-x: auto` div would turn that div into the
scrollport on *both* axes — its height is unbounded, so the vertically sticky `thead` would stop
sticking when the page scrolls. That is a regression of behaviour the user relies on today.

### Opaque backgrounds

A sticky cell paints over the cells scrolling beneath it, so its background must be opaque.
`ImportEntries.css` currently stripes rows with `tr:nth-child(even) { background-color: #3276b44a }`
— 29 % alpha, which would let the scrolling content bleed through. It is replaced by the opaque
result of that blend: `#a9c6df` on light and `#2e4358` on dark, matching the two base row colours
from `TemplateEntries.css`. The rendered colour is unchanged.

The other two backgrounds are already opaque and stay as they are: `table th` (`#33b7a2` /
`#1e6f62`) and the footer row `.importDataTable tr:last-child td` (`#33b7a2`).

Frozen cells use `background-color: inherit` so they pick up whichever of those applies to their
row.

## Component changes

- **`ImportEntries.tsx`** — calls `getFrozenColumns(importHeader)` and applies the result to the
  `#` and `Template` cells of the header, of every data row and of the footer row, and passes the
  per-column entry down for the import columns.
- **`ImportEntriesTableCell.tsx`** — takes a new optional `frozenColumn?: FrozenColumn` prop,
  applies it to the plain `<td>` branch and forwards it to `TableCellBillable`.
- **`TableCellBillable.tsx`** — takes the same optional prop and applies it to its `<td>`.
- **`TableCellTrackingDay.tsx`** — unchanged. Date columns are never frozen.

## Testing

Split so that tuning a width constant does not ripple through the suite:

- **`test/frozenColumns.test.ts`** (new) pins the arithmetic with hardcoded numbers, the way the
  rest of the suite pins behaviour. Cases: the fixture header above; the four-tag header from the
  screenshot in the issue, which has no `Notes` column; a header without any date column (nothing
  frozen); an empty header (nothing frozen); a header starting with a date column (only `#` and
  `Template` frozen).
- **`test/importEntries.test.tsx`** (extended) checks the wiring, deriving its expectations from
  the exported `FROZEN_COLUMN_WIDTHS`: the rendered `th`/`td` for frozen columns carry the class and
  a `left` inline style, date cells carry neither, and the footer row is frozen like the data rows.

`position: sticky` and background painting do not work in jsdom, so the visual result is verified
in the manual walkthrough. `docs/architecture/testing.md` gets a step: scroll the import table
horizontally and confirm the leading block stays in place, stays opaque, and keeps its shadow edge.

## Known limitation

The frozen block is as wide as the columns it contains. A four-tag import is 32 + 110 + 4 × 90 +
44 = 546 px, which is wider than a narrow side panel — the date columns would then be unreachable
until the panel is dragged wider. This is accepted rather than worked around: capping the widths
against the viewport would shrink the text to unreadable, and dropping columns from the frozen
block based on the measured panel width adds runtime measurement that jsdom cannot cover.

It is documented in two places for the user: the "How to use this" alert below the table, and the
ManicTime import section of `CLAUDE.md`.

## Deliberately out of scope

The unscoped `table` selectors in `TemplateEntries.css` stay global. Only the striping colour
changes, and it renders identically in both tables. Re-scoping those rules to their own table is a
larger change with its own blast radius and belongs in a separate commit.
