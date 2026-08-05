/**
 * Which columns of the import table stay pinned to the left while the date columns
 * scroll underneath them.
 *
 * This module only decides *which* columns are pinned and in what order. It says nothing
 * about widths: the columns size themselves to their content, so a value is never clipped.
 * The pixel offset each pinned column needs is therefore not knowable here — it is measured
 * from the rendered header by `useFrozenColumnOffsets` and handed to the cells through the
 * `--frozen-left-<position>` custom properties.
 *
 * See docs/superpowers/specs/2026-08-05-frozen-import-columns-design.md.
 */

/**
 * A column whose header looks like `dd.mm.yyyy` or `dd/mm/yyyy` is a tracking day.
 * `ImportEntriesTableCell` imports this to decide whether a cell renders a ▶️ button, so
 * both places agree on where the frozen block ends.
 */
export const DATE_COLUMN_REGEX = /^\d{2}[./]\d{2}[./]\d{4}$/;

export type FrozenColumn = {
  /** Index within the frozen block, 0 being the leftmost. Names the CSS custom property. */
  position: number;
  /** The rightmost frozen column, which carries the separating shadow. */
  isLast: boolean;
};

export type FrozenColumns = {
  index?: FrozenColumn;
  template?: FrozenColumn;
  /** One slot per `importHeader` column; `undefined` means the column scrolls. */
  data: (FrozenColumn | undefined)[];
  /** How many columns are pinned in total — how many offsets have to be measured. */
  count: number;
};

/** The custom property a pinned cell reads its offset from. */
export function frozenLeftVariable(position: number): string {
  return `--frozen-left-${position}`;
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
    return { data: importHeader.map(() => undefined), count: 0 };
  }

  let position = 0;
  const take = (): FrozenColumn => ({ position: position++, isLast: false });

  const index = take();
  const template = take();
  const data = importHeader.map((_, columnIndex) => (columnIndex < firstDateColumn ? take() : undefined));

  const last = data[firstDateColumn - 1] ?? template;
  last.isLast = true;

  return { index, template, data, count: position };
}

/**
 * The `<th>` / `<td>` attributes that pin a cell. Spread into the cell; an undefined column
 * yields an empty object, so the cell renders exactly as it did before.
 *
 * Deliberately no width: the column sizes itself to its content. Before the offsets have been
 * measured the custom property is unset, `left` resolves to `auto` and the cell simply behaves
 * like an ordinary one.
 */
export function frozenCellProps(column?: FrozenColumn) {
  if (!column) {
    return {};
  }
  return {
    className: column.isLast ? "frozenColumn frozenColumn--last" : "frozenColumn",
    style: { left: `var(${frozenLeftVariable(column.position)})` },
  };
}
