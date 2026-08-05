import { RefObject, useLayoutEffect } from "react";
import { frozenLeftVariable } from "./frozenColumns";

/**
 * Measures how far each pinned column sits from the left edge of the frozen block and publishes
 * the result as `--frozen-left-<position>` custom properties on the table.
 *
 * Measuring is what lets the columns keep their natural, content-driven widths — a fixed width
 * would clip long tag names, which is exactly what this table must not do. All rows of a table
 * share their column widths, so the header cells are the only thing that has to be measured.
 *
 * Runs on every render (a handful of `getBoundingClientRect` calls) and on every resize of the
 * table, which covers the side panel being dragged wider as well as content reflowing. Writing a
 * custom property does not change the table's size, so the observer cannot feed itself.
 */
export function useFrozenColumnOffsets(tableRef: RefObject<HTMLTableElement | null>, frozenColumnCount: number) {
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table || frozenColumnCount === 0) {
      return;
    }

    const measure = () => {
      const headerCells = table.querySelectorAll("thead th");
      let left = 0;
      for (let position = 0; position < frozenColumnCount; position++) {
        const cell = headerCells[position];
        if (!cell) {
          return;
        }
        table.style.setProperty(frozenLeftVariable(position), `${left}px`);
        left += cell.getBoundingClientRect().width;
      }
    };

    measure();

    // jsdom has no ResizeObserver by default; the side panel's test setup shims one, but guard
    // anyway so this hook stays usable without it.
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(table);
    return () => observer.disconnect();
  });
}
