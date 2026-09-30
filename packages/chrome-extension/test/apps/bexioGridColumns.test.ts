/**
 * The MAIN-world half of remarks-as-text in bexio's new grids (#168): column widths through
 * ag-grid's pre-v31 API. The API is faked — the real one is only reachable in the page's MAIN world
 * (`__agComponent` on `.ag-root-wrapper`), and bexio's column definitions were not captured, only
 * the widths recorded in the issue. Whether ag-grid lays the columns out as intended is a manual
 * check (docs/architecture/testing.md).
 */
import { describe, expect, it, vi } from "vitest";
import {
  applyTextModeWidths,
  ColDef,
  getGridApi,
  GridApi,
  hasWidths,
  isTimeEntryGrid,
  recordOriginalWidths,
  restoreWidths,
  syncGrid,
} from "../../src/apps/bexioGridColumns/gridColumns";

/** bexio's definitions as recorded in #168: remarks locked at 88px, the others at their widths. */
const BEXIO_DEFS = (): ColDef[] => [
  { colId: "date", field: "date", width: 200, minWidth: 200 },
  { colId: "activity", field: "activity", width: 150 },
  { colId: "status", field: "status", width: 120, minWidth: 120, maxWidth: 120 },
  { colId: "invoiceable", field: "invoiceable", width: 110 },
  { colId: "project", field: "project", width: 260 },
  { colId: "contact_partner", field: "contact_partner", width: 180 },
  { colId: "text", field: "text", width: 88, minWidth: 88, maxWidth: 88 },
  { colId: "actions", field: "actions", width: 60, hide: false },
];

const byId = (defs: ColDef[], id: string) => defs.find((def) => def.colId === id)!;

function fakeApi(initial: ColDef[] = BEXIO_DEFS()) {
  let defs = initial;
  const listeners: Record<string, (() => void)[]> = {};
  const api: GridApi & { setColumnDefs: ReturnType<typeof vi.fn>; sizeColumnsToFit: ReturnType<typeof vi.fn> } = {
    getColumnDefs: () => defs.map((def) => ({ ...def })),
    setColumnDefs: vi.fn((next: ColDef[]) => {
      defs = next;
      // ag-grid fires its column events synchronously from setColumnDefs.
      (listeners.displayedColumnsChanged ?? []).forEach((listener) => listener());
    }),
    sizeColumnsToFit: vi.fn(),
    addEventListener: (type, listener) => (listeners[type] ??= []).push(listener),
  };
  return api;
}

describe("gridColumns", () => {
  it("recognises a grid of time entries by its remarks column", () => {
    expect(isTimeEntryGrid(BEXIO_DEFS())).toBe(true);
    expect(isTimeEntryGrid([{ colId: "name" }])).toBe(false);
    expect(isTimeEntryGrid([{ headerName: "group", children: [{ colId: "text" }] }])).toBe(true);
  });

  it("gives the remarks column the rest of the width and narrows the others", () => {
    const defs = applyTextModeWidths(BEXIO_DEFS());

    expect(byId(defs, "text")).toEqual({ colId: "text", field: "text", flex: 1, minWidth: 200 });
    expect(byId(defs, "date")).toMatchObject({ width: 165, minWidth: 165, maxWidth: 165 });
    expect(byId(defs, "activity")).toMatchObject({ minWidth: 80, maxWidth: 100 });
    expect(byId(defs, "status")).toMatchObject({ width: 110, minWidth: 110, maxWidth: 110 });
    expect(byId(defs, "invoiceable")).toMatchObject({ width: 110 });
    expect(byId(defs, "project")).toMatchObject({ maxWidth: 190 });
    expect(byId(defs, "contact_partner")).toMatchObject({ maxWidth: 140 });
    // Columns it does not know, and the column state bexio keeps in the definitions, stay as they are.
    expect(byId(defs, "actions")).toEqual({ colId: "actions", field: "actions", width: 60, hide: false });
  });

  it("restores exactly what bexio had", () => {
    const original = BEXIO_DEFS();
    const restored = restoreWidths(applyTextModeWidths(original), recordOriginalWidths(original));
    expect(restored).toEqual(original);
  });

  it("sees definitions that already carry the target widths, ignoring ag-grid's actual widths", () => {
    const target = applyTextModeWidths(BEXIO_DEFS());
    const reported = target.map((def) => ({ ...def, width: 123, flex: def.flex ?? null }));
    expect(hasWidths(reported, target)).toBe(true);
    expect(hasWidths(BEXIO_DEFS(), target)).toBe(false);
  });

  describe("syncGrid", () => {
    it("widens in text mode once, then does nothing on its own column events", () => {
      const api = fakeApi();
      const grid = { api, originals: undefined, applying: false };
      api.addEventListener("displayedColumnsChanged", () => syncGrid(grid, "text"));

      syncGrid(grid, "text");
      syncGrid(grid, "text");

      expect(api.setColumnDefs).toHaveBeenCalledTimes(1);
      expect(api.sizeColumnsToFit).toHaveBeenCalledTimes(1);
      expect(byId(api.getColumnDefs()!, "text").flex).toBe(1);
    });

    it("restores bexio's widths when the mode switches back", () => {
      const api = fakeApi();
      const grid = { api, originals: undefined, applying: false };

      syncGrid(grid, "text");
      syncGrid(grid, "tooltip");

      expect(api.getColumnDefs()).toEqual(BEXIO_DEFS());
      expect(grid.originals).toBeUndefined();
    });

    it("leaves a grid alone that was never widened, and grids that are not time entries", () => {
      const api = fakeApi();
      syncGrid({ api, originals: undefined, applying: false }, "tooltip");
      syncGrid({ api, originals: undefined, applying: false }, null);
      const other = fakeApi([{ colId: "name", width: 100 }]);
      syncGrid({ api: other, originals: undefined, applying: false }, "text");

      expect(api.setColumnDefs).not.toHaveBeenCalled();
      expect(other.setColumnDefs).not.toHaveBeenCalled();
    });

    it("re-applies when bexio rewrites its definitions (the 'Spalten' menu)", () => {
      const api = fakeApi();
      const grid = { api, originals: undefined, applying: false };
      syncGrid(grid, "text");

      api.setColumnDefs(BEXIO_DEFS()); // bexio, not us
      syncGrid(grid, "text");

      expect(byId(api.getColumnDefs()!, "text").flex).toBe(1);
    });
  });

  it("finds ag-grid's API behind the root element's __agComponent, and nothing on other versions", () => {
    const api = fakeApi();
    const root = document.createElement("div");
    Object.assign(root, { __agComponent: { gridOptionsService: { api } } });
    expect(getGridApi(root)).toBe(api);

    expect(getGridApi(document.createElement("div"))).toBeUndefined();
    const v31 = document.createElement("div");
    Object.assign(v31, { __agComponent: { gridOptionsService: {} } });
    expect(getGridApi(v31)).toBeUndefined();
  });
});
