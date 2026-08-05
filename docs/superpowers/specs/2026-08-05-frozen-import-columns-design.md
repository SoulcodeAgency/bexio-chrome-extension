# Frozen leading columns in the import table

Design for [issue #12](https://github.com/SoulcodeAgency/bexio-chrome-extension/issues/12).

## Problem

The ManicTime import table in the side panel (`packages/sidePanel-import`, rendered by
`ImportEntries.tsx`) grows one column per tracked day. With a month of data the table is far wider
than the panel, so booking an entry near the end of the month means scrolling the identifying
columns — `#`, `Template`, the `Tag n` columns and `Billable` — off screen. The user then clicks a
▶️ button without seeing which row it belongs to.

The header row already stays put when scrolling vertically. That came from
`table thead { position: sticky; top: 0 }` in `TemplateEntries.css`, which uses an unscoped `table`
selector and therefore also styles the import table. The same treatment was missing on the
horizontal axis.

## Scope

Only `packages/sidePanel-import`. The content scripts and the `shared` package are untouched, and
no new setting is stored — the behaviour is always on.

## Behaviour

Every column left of the first date column stays pinned to the left edge of the table while the
date columns scroll underneath it. Concretely that is `#`, `Template`, every `Tag n`, `Notes` if
present, and `Billable`.

A date column is one whose header matches `/^\d{2}[./]\d{2}[./]\d{4}$/` — the same regex
`ImportEntriesTableCell` already uses to decide whether a cell renders a ▶️ button.

Two edge cases follow from that rule:

- **No date column in the header.** Nothing is pinned. Pinning every column would make the whole
  table stick and scroll nothing.
- **The first header column is already a date.** Only `#` and `Template` are pinned — they are
  produced by the extension, not by the import, so they always come first.

The trailing `Total` column is not pinned: it sits after the date columns, and the rule only looks
at the leading block.

## Column widths — content, not constants

Columns keep their natural, content-driven widths. Nothing sets a width, a `max-width` or
`overflow: hidden` on a cell, so **no value is ever clipped**. A column is at least as wide as the
longest unbreakable run in it — which is what the auto table layout algorithm does by default, and
what "at least fit a single word" means in practice.

Values longer than that wrap onto more lines instead of being cut. Wrapping happens at the
browser's default break opportunities: spaces, and also hyphens. Chrome offers no way to keep a
hyphenated token on one line while still wrapping at spaces — `word-break: keep-all` and
`hyphens: none` were both measured and have no effect on it, and `white-space: nowrap` would
disable space-wrapping too. So `LAGWEB-3421-unbreakable-token` wraps at its hyphens rather than
widening its column to ~223 px. Nothing is lost either way.

The one exception is the `<select>` in the `Template` column, capped at `max-width: 140px`. It
would otherwise size itself to the longest template name. A select truncates its own label — that
is the control's own behaviour, no row content is lost.

Because the widths are not known ahead of time, the pixel offsets cannot be computed. They are
measured; see below.

## The units

### `frozenColumns.ts` — which columns are pinned

Pure function of the header. It says nothing about pixels.

```ts
export const DATE_COLUMN_REGEX = /^\d{2}[./]\d{2}[./]\d{4}$/;

export type FrozenColumn = {
  /** Index within the frozen block, 0 being the leftmost. Names the CSS custom property. */
  position: number;
  /** The rightmost pinned column, which carries the separating shadow. */
  isLast: boolean;
};

export type FrozenColumns = {
  index?: FrozenColumn;
  template?: FrozenColumn;
  /** One slot per importHeader column; undefined means the column scrolls. */
  data: (FrozenColumn | undefined)[];
  /** How many columns are pinned in total — how many offsets have to be measured. */
  count: number;
};

export function frozenLeftVariable(position: number): string;
export function getFrozenColumns(importHeader: string[]): FrozenColumns;
export function frozenCellProps(column?: FrozenColumn): { className?: string; style?: object };
```

`data` is index-aligned with `importHeader`, so the render code looks a column up by the same index
it already uses for the cell value. `frozenCellProps` returns the `className` and the
`style={{ left: "var(--frozen-left-N)" }}` to spread into a cell; for an undefined column it
returns `{}`, so the cell renders exactly as before.

`DATE_COLUMN_REGEX` moves here from `ImportEntriesTableCell.tsx`, which imports it instead of
declaring its own copy. Both places must agree on where the frozen block ends.

### `useFrozenColumnOffsets.ts` — where each pinned column sits

Measures the rendered header cells and publishes the running sum of their widths as
`--frozen-left-<position>` custom properties on the `<table>`. All rows of a table share their
column widths, so the header row is the only thing that has to be measured, and one write per
column beats touching every cell.

It runs after every render (a handful of `getBoundingClientRect` calls) and on every resize of the
table via a `ResizeObserver`, which covers the side panel being dragged wider as well as content
reflowing. Writing a custom property does not change the table's size, so the observer cannot feed
itself.

Before the first measurement the custom property is unset, `left` resolves to `auto`, and the cell
behaves like an ordinary one. `useLayoutEffect` runs before paint, so that state is never visible.

## Layout

### The table scrolls, the panel does not

`.importDataTableWrapper` wraps the table with `overflow: auto` and `max-height: 70vh`. Sideways
scrolling happens inside that box, so the side panel itself never grows a horizontal scrollbar, and
the pinned columns stick to the box's left edge rather than the viewport's.

The height cap is what keeps the header row sticky. A sticky element sticks inside its scroll
container, and from here on that container is this box rather than the page — without a bounded
height the box would never scroll vertically and the header would simply scroll away with the page.

### `body` is no longer a flex container

`index.scss` had `body { display: flex; flex-direction: column; justify-content: space-between }`,
left over from the Vite template. As a flex item `#root` was sized by its content, so the wide table
propagated its width all the way up and the panel grew a horizontal scrollbar anyway — measured at a
700 px panel: `body` 700 px, `#root` 1099 px. As a plain block `#root` is the width of the panel and
the wrapper's `overflow: auto` does the scrolling. The dropped `justify-content: space-between` had
no effect: `body` has a single child.

`#root`'s padding drops from `2rem` to `0.75rem` and `.content` loses its horizontal padding, so the
narrow panel spends its width on the table rather than on margins.

### CSS

- `.importDataTable .frozenColumn { position: sticky; z-index: 1 }` — `left` comes from the inline
  `var(--frozen-left-N)`.
- `.importDataTable thead .frozenColumn { z-index: 3 }` — above both the body cells and the
  `thead`'s own `z-index: 2`.
- `.importDataTable .frozenColumn--last` adds `box-shadow: 2px 0 4px rgb(0 0 0 / 25%)` so the edge
  of the pinned block is visible.

### Opaque backgrounds

A sticky cell paints over the cells scrolling beneath it, so its background must be opaque.
`ImportEntries.css` used to stripe rows with `tr:nth-child(even) { background-color: #3276b44a }` —
29 % alpha, which would let the scrolling content bleed through. It is replaced by the opaque result
of that blend: `#a9c6df` on light and `#2e4358` on dark, matching the two base row colours from
`TemplateEntries.css`. The rendered colour is unchanged.

The other two backgrounds are already opaque and stay as they are: `table th` (`#33b7a2` /
`#1e6f62`) and the footer row `.importDataTable tr:last-child td` (`#33b7a2`).

Pinned data cells use `background-color: inherit` so they pick up whichever of those applies to
their row. The header row and the totals row are excluded from that rule — they bring their own
opaque colour and have to keep it.

## Component changes

- **`ImportEntries.tsx`** — calls `getFrozenColumns(importHeader)` and `useFrozenColumnOffsets`,
  wraps the table in `.importDataTableWrapper`, and applies the per-column props to the `#` and
  `Template` cells of the header, of every data row and of the footer row.
- **`ImportEntriesTableCell.tsx`** — takes a new optional `frozenColumn?: FrozenColumn` prop,
  applies it to the plain `<td>` branch and forwards it to `TableCellBillable`.
- **`TableCellBillable.tsx`** — takes the same optional prop and applies it to its `<td>`.
- **`TableCellTrackingDay.tsx`** — unchanged. Date columns are never pinned.

## Testing

- **`test/frozenColumns.test.ts`** pins which columns are frozen and their positions. Cases: the
  header from the existing fixtures; the four-tag header from the screenshot in the issue; a header
  without any date column (nothing pinned); an empty header; a header starting with a date column
  (only `#` and `Template`); slash-separated dates.
- **`test/importEntries.test.tsx`** checks the wiring: every cell of the leading block — header,
  data rows and footer row — carries the class and `left: var(--frozen-left-N)`, no cell carries a
  width, and the date columns carry neither.

Pixel values cannot be asserted: jsdom has no layout, so `getBoundingClientRect` returns zeros. The
measured behaviour is verified in a real browser instead, and
`docs/architecture/testing.md` carries the manual step.

## Known limitation

The pinned block is as wide as the columns it contains, and nothing caps it. Measured with a
four-tag import: 559 px. In a 700 px panel that leaves 83 px for the date columns; in a 400 px panel
the block is wider than the visible area, so the date columns cannot be reached at all until the
panel is dragged wider.

This is accepted rather than worked around. Capping the widths would re-introduce the clipping this
design exists to remove, and dropping columns out of the pinned block below a measured width
threshold is behaviour the user explicitly declined.

It is documented for the user in the "How to use this" alert below the table, and in the ManicTime
import section of `CLAUDE.md`.

## Deliberately out of scope

The unscoped `table` selectors in `TemplateEntries.css` stay global. Only the striping colour
changes, and it renders identically in both tables. Re-scoping those rules to their own table is a
larger change with its own blast radius and belongs in a separate commit.
