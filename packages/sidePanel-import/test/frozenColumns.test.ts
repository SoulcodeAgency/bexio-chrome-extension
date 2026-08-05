/**
 * Frozen leading columns of the import table (issue #12).
 *
 * `getFrozenColumns` decides which columns stay pinned to the left while the date
 * columns scroll underneath, and where each of them sits *within the frozen block* —
 * position 0 is the leftmost. It deliberately says nothing about widths: the columns
 * size themselves to their content, and the pixel offsets are measured from the
 * rendered header by `useFrozenColumnOffsets`.
 *
 * See docs/superpowers/specs/2026-08-05-frozen-import-columns-design.md.
 */
import { describe, expect, it } from "vitest";
import { getFrozenColumns } from "~/components/ImportEntries/frozenColumns";

describe("getFrozenColumns", () => {
  it("freezes '#', 'Template' and every import column before the first date column", () => {
    const frozen = getFrozenColumns(["Tag 1", "Notes", "Billable", "01.07.2026", "02.07.2026", "Total"]);

    expect(frozen.count).toBe(5);
    expect(frozen.index).toEqual({ position: 0, isLast: false });
    expect(frozen.template).toEqual({ position: 1, isLast: false });
    expect(frozen.data).toEqual([
      { position: 2, isLast: false }, // Tag 1
      { position: 3, isLast: false }, // Notes
      { position: 4, isLast: true }, // Billable
      undefined, // 01.07.2026
      undefined, // 02.07.2026
      undefined, // Total — trailing, but after the date columns, so it scrolls
    ]);
  });

  it("freezes every tag column of a multi-tag export", () => {
    const frozen = getFrozenColumns(["Tag 1", "Tag 2", "Tag 3", "Tag 4", "Billable", "01.06.2025", "02.06.2025"]);

    expect(frozen.count).toBe(7);
    expect(frozen.data).toEqual([
      { position: 2, isLast: false },
      { position: 3, isLast: false },
      { position: 4, isLast: false },
      { position: 5, isLast: false },
      { position: 6, isLast: true },
      undefined,
      undefined,
    ]);
  });

  it("accepts date columns written with slashes", () => {
    const frozen = getFrozenColumns(["Tag 1", "01/07/2026"]);

    expect(frozen.data).toEqual([{ position: 2, isLast: true }, undefined]);
  });

  it("freezes nothing when the header has no date column", () => {
    const frozen = getFrozenColumns(["Tag 1", "Billable", "Total"]);

    expect(frozen.count).toBe(0);
    expect(frozen.index).toBeUndefined();
    expect(frozen.template).toBeUndefined();
    expect(frozen.data).toEqual([undefined, undefined, undefined]);
  });

  it("freezes nothing for an empty header", () => {
    const frozen = getFrozenColumns([]);

    expect(frozen.count).toBe(0);
    expect(frozen.index).toBeUndefined();
    expect(frozen.template).toBeUndefined();
    expect(frozen.data).toEqual([]);
  });

  it("freezes only '#' and 'Template' when the import starts with a date column", () => {
    const frozen = getFrozenColumns(["01.07.2026", "02.07.2026", "Total"]);

    expect(frozen.count).toBe(2);
    expect(frozen.index).toEqual({ position: 0, isLast: false });
    expect(frozen.template).toEqual({ position: 1, isLast: true });
    expect(frozen.data).toEqual([undefined, undefined, undefined]);
  });
});
