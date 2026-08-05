/**
 * Which columns of the import table stay pinned to the left while the date columns
 * scroll underneath them, and where each of them sits.
 *
 * Widths are fixed constants so the `left` offsets are a plain running sum — no DOM
 * measurement, which also keeps the behaviour testable in jsdom. Cells are clipped to
 * their width (see ImportEntries.css), the full value stays reachable via `title`.
 *
 * See docs/superpowers/specs/2026-08-05-frozen-import-columns-design.md.
 */

/**
 * A column whose header looks like `dd.mm.yyyy` or `dd/mm/yyyy` is a tracking day.
 * `ImportEntriesTableCell` imports this to decide whether a cell renders a ▶️ button, so
 * both places agree on where the frozen block ends.
 */
export const DATE_COLUMN_REGEX = /^\d{2}[./]\d{2}[./]\d{4}$/;

export const FROZEN_COLUMN_WIDTHS = {
  index: 32,
  template: 110,
  /** Wider than the rest: the header of this column also hosts the apply-notes switch. */
  notes: 170,
  /** Narrower than the rest: the cells only render ✅ or ◻️. */
  billable: 44,
  default: 90,
} as const;

export type FrozenColumn = {
  /** Offset from the left edge of the frozen block, in px. */
  left: number;
  width: number;
  /** The rightmost frozen column, which carries the separating shadow. */
  isLast: boolean;
};

export type FrozenColumns = {
  index?: FrozenColumn;
  template?: FrozenColumn;
  /** One slot per `importHeader` column; `undefined` means the column scrolls. */
  data: (FrozenColumn | undefined)[];
};

function columnWidth(header: string): number {
  if (header === "Notes") return FROZEN_COLUMN_WIDTHS.notes;
  if (header === "Billable") return FROZEN_COLUMN_WIDTHS.billable;
  return FROZEN_COLUMN_WIDTHS.default;
}

/**
 * Freezes `#`, `Template` and every import column left of the first date column.
 *
 * Without a date column nothing is frozen at all — freezing every column would pin the
 * whole table and leave nothing to scroll.
 */
export function getFrozenColumns(importHeader: string[]): FrozenColumns {
  const firstDateColumn = importHeader.findIndex((header) => DATE_COLUMN_REGEX.test(header));
  if (firstDateColumn < 0) {
    return { data: importHeader.map(() => undefined) };
  }

  let left = 0;
  const take = (width: number): FrozenColumn => {
    const column = { left, width, isLast: false };
    left += width;
    return column;
  };

  const index = take(FROZEN_COLUMN_WIDTHS.index);
  const template = take(FROZEN_COLUMN_WIDTHS.template);
  const data = importHeader.map((header, columnIndex) =>
    columnIndex < firstDateColumn ? take(columnWidth(header)) : undefined,
  );

  const last = data[firstDateColumn - 1] ?? template;
  last.isLast = true;

  return { index, template, data };
}

/**
 * The `<th>` / `<td>` attributes that pin a cell. Spread into the cell; an undefined column
 * yields an empty object, so the cell renders exactly as it did before.
 *
 * The offsets are written as inline styles rather than CSS because they depend on the header
 * of the current import. The width is fixed in all three dimensions so the browser cannot
 * widen the column to fit its content, which would desynchronise it from the offsets.
 */
export function frozenCellProps(column?: FrozenColumn) {
  if (!column) {
    return {};
  }
  const width = `${column.width}px`;
  return {
    className: column.isLast ? "frozenColumn frozenColumn--last" : "frozenColumn",
    style: { left: `${column.left}px`, width, minWidth: width, maxWidth: width },
  };
}
