/**
 * Column widths for bexio's new time tracking grids (#168), so the remarks printed by the "Text"
 * mode (`utils/convertGridRemarks.ts`) get room: bexio locks the remarks column at
 * `minWidth = maxWidth = 88px`.
 *
 * Runs in the page's **MAIN world** (see `index.iife.ts`): ag-grid's API is reachable only through
 * a page-JS expando on the grid element, which the content script's isolated world cannot see. No
 * `chrome.*` API exists there, and nothing is shared with the isolated world but the DOM — the mode
 * arrives as an attribute on `<html>` (`REMARKS_MODE_ATTRIBUTE`).
 *
 * bexio uses ag-grid's pre-v31 API (`getColumnDefs` / `setColumnDefs` / `sizeColumnsToFit`).
 * `getColumnDefs()` returns the definitions *with* the current column state (hidden columns, sort),
 * so writing them back keeps what the user chose in bexio's "Spalten" menu.
 */

/** The subset of an ag-grid `ColDef` this script reads and writes. */
export type ColDef = {
  colId?: string;
  field?: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  flex?: number | null;
  children?: ColDef[];
  [key: string]: unknown;
};

/** The subset of ag-grid's pre-v31 `GridApi` this script uses. */
export type GridApi = {
  getColumnDefs(): ColDef[] | undefined;
  setColumnDefs(defs: ColDef[]): void;
  sizeColumnsToFit(): void;
  addEventListener(type: string, listener: () => void): void;
};

export const REMARKS_COLUMN_ID = "text";

/**
 * The widths of the "Text" mode, per `colId` — measured on live bexio (2026-09-30, issue #168):
 * "Datum" keeps "Von: 09:00 Bis: 15:00" readable at 165px, "verrechenbar" needs 110px for its
 * header, and the remarks column takes whatever is left (at least 200px).
 */
const TEXT_MODE_COLUMNS: Record<string, Partial<ColDef>> = {
  date: { width: 165, minWidth: 165, maxWidth: 165 },
  activity: { minWidth: 80, maxWidth: 100 },
  status: { width: 110, minWidth: 110, maxWidth: 110 },
  invoiceable: { width: 110, minWidth: 110, maxWidth: 110 },
  project: { maxWidth: 190 },
  contact_partner: { maxWidth: 140 },
  [REMARKS_COLUMN_ID]: { flex: 1, minWidth: 200, maxWidth: undefined },
};

const PATCHED_KEYS = ["width", "minWidth", "maxWidth", "flex"] as const;

const columnId = (def: ColDef) => def.colId ?? def.field;

function flatten(defs: ColDef[]): ColDef[] {
  return defs.flatMap((def) => (def.children ? flatten(def.children) : [def]));
}

/** `true` for a grid of bexio's time entries: it has the remarks column. */
export function isTimeEntryGrid(defs: ColDef[]): boolean {
  return flatten(defs).some((def) => columnId(def) === REMARKS_COLUMN_ID);
}

/** What bexio had set for the keys this script changes, per column — to restore "Tooltip" mode. */
export type OriginalWidths = Map<string, Partial<ColDef>>;

export function recordOriginalWidths(defs: ColDef[]): OriginalWidths {
  const originals: OriginalWidths = new Map();
  for (const def of flatten(defs)) {
    const id = columnId(def);
    if (!id || !(id in TEXT_MODE_COLUMNS)) continue;
    originals.set(id, Object.fromEntries(PATCHED_KEYS.map((key) => [key, def[key]])));
  }
  return originals;
}

function withWidths(defs: ColDef[], widthsFor: (id: string) => Partial<ColDef> | undefined): ColDef[] {
  return defs.map((def) => {
    if (def.children) return { ...def, children: withWidths(def.children, widthsFor) };
    const id = columnId(def);
    const widths = id ? widthsFor(id) : undefined;
    if (!widths) return def;
    const next: ColDef = { ...def };
    for (const key of PATCHED_KEYS) {
      if (!(key in widths)) continue;
      if (widths[key] === undefined) delete next[key];
      else (next as Record<string, unknown>)[key] = widths[key];
    }
    // A flex column ignores `width`; ag-grid warns when both are set.
    if (next.flex) delete next.width;
    return next;
  });
}

/** The definitions with the "Text" mode widths applied. */
export function applyTextModeWidths(defs: ColDef[]): ColDef[] {
  return withWidths(defs, (id) => TEXT_MODE_COLUMNS[id]);
}

/** The definitions with bexio's widths restored. */
export function restoreWidths(defs: ColDef[], originals: OriginalWidths): ColDef[] {
  return withWidths(defs, (id) => originals.get(id));
}

/** `true` when `defs` already carry every width of `target` — nothing to write. */
export function hasWidths(defs: ColDef[], target: ColDef[]): boolean {
  const current = new Map(flatten(defs).map((def) => [columnId(def), def]));
  return flatten(target).every((def) => {
    const now = current.get(columnId(def));
    // `width` is left out: ag-grid reports the actual width, which sizeColumnsToFit and the flex
    // column change. `null` and a missing key mean the same to ag-grid.
    return (
      now !== undefined && PATCHED_KEYS.every((key) => key === "width" || (now[key] ?? null) === (def[key] ?? null))
    );
  });
}

type GridState = { api: GridApi; originals: OriginalWidths | undefined; applying: boolean };

/**
 * Keeps one grid's widths in line with the mode. Re-applied on ag-grid's column events, because
 * bexio rewrites its column definitions itself (the "Spalten" menu); the `hasWidths` check stops the
 * events our own `setColumnDefs` fires from looping.
 */
export function syncGrid(state: GridState, mode: string | null): void {
  if (state.applying) return;
  const defs = state.api.getColumnDefs();
  if (!defs || !isTimeEntryGrid(defs)) return;

  let target: ColDef[] | undefined;
  if (mode === "text") {
    state.originals ??= recordOriginalWidths(defs);
    target = applyTextModeWidths(defs);
  } else if (state.originals) {
    target = restoreWidths(defs, state.originals);
  }
  if (!target || hasWidths(defs, target)) return;

  state.applying = true;
  try {
    state.api.setColumnDefs(target);
    state.api.sizeColumnsToFit();
  } finally {
    state.applying = false;
  }
  if (mode !== "text") state.originals = undefined;
}

/** ag-grid's API behind a grid's root element, or `undefined` (a different ag-grid version). */
export function getGridApi(root: Element): GridApi | undefined {
  const component = (root as unknown as { __agComponent?: { gridOptionsService?: { api?: GridApi } } }).__agComponent;
  const api = component?.gridOptionsService?.api;
  return api && typeof api.getColumnDefs === "function" && typeof api.setColumnDefs === "function" ? api : undefined;
}
