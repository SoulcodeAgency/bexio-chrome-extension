/**
 * Frozen leading columns of the import table (issue #12).
 *
 * `getFrozenColumns` decides which columns stay pinned to the left while the date
 * columns scroll underneath, and at which `left` offset each of them sits. The
 * offsets are a running sum of fixed widths, so they are pinned here as literal
 * numbers — a changed width constant is a visible behaviour change, not a silent one.
 *
 * See docs/superpowers/specs/2026-08-05-frozen-import-columns-design.md.
 */
import { describe, expect, it } from "vitest";
import { getFrozenColumns } from "~/components/ImportEntries/frozenColumns";

describe("getFrozenColumns", () => {
  it("freezes '#', 'Template' and every import column before the first date column", () => {
    const frozen = getFrozenColumns(["Tag 1", "Notes", "Billable", "01.07.2026", "02.07.2026", "Total"]);

    expect(frozen.index).toEqual({ left: 0, width: 32, isLast: false });
    expect(frozen.template).toEqual({ left: 32, width: 110, isLast: false });
    expect(frozen.data).toEqual([
      { left: 142, width: 90, isLast: false }, // Tag 1
      { left: 232, width: 170, isLast: false }, // Notes — wider, its header hosts the apply-notes switch
      { left: 402, width: 44, isLast: true }, // Billable — narrow, renders only ✅ / ◻️
      undefined, // 01.07.2026
      undefined, // 02.07.2026
      undefined, // Total — trailing, but after the date columns, so it scrolls
    ]);
  });

  it("freezes every tag column of a multi-tag export", () => {
    const frozen = getFrozenColumns(["Tag 1", "Tag 2", "Tag 3", "Tag 4", "Billable", "01.06.2025", "02.06.2025"]);

    expect(frozen.data).toEqual([
      { left: 142, width: 90, isLast: false },
      { left: 232, width: 90, isLast: false },
      { left: 322, width: 90, isLast: false },
      { left: 412, width: 90, isLast: false },
      { left: 502, width: 44, isLast: true },
      undefined,
      undefined,
    ]);
  });

  it("accepts date columns written with slashes", () => {
    const frozen = getFrozenColumns(["Tag 1", "01/07/2026"]);

    expect(frozen.data).toEqual([{ left: 142, width: 90, isLast: true }, undefined]);
  });

  it("freezes nothing when the header has no date column", () => {
    const frozen = getFrozenColumns(["Tag 1", "Billable", "Total"]);

    expect(frozen.index).toBeUndefined();
    expect(frozen.template).toBeUndefined();
    expect(frozen.data).toEqual([undefined, undefined, undefined]);
  });

  it("freezes nothing for an empty header", () => {
    const frozen = getFrozenColumns([]);

    expect(frozen.index).toBeUndefined();
    expect(frozen.template).toBeUndefined();
    expect(frozen.data).toEqual([]);
  });

  it("freezes only '#' and 'Template' when the import starts with a date column", () => {
    const frozen = getFrozenColumns(["01.07.2026", "02.07.2026", "Total"]);

    expect(frozen.index).toEqual({ left: 0, width: 32, isLast: false });
    expect(frozen.template).toEqual({ left: 32, width: 110, isLast: true });
    expect(frozen.data).toEqual([undefined, undefined, undefined]);
  });
});
