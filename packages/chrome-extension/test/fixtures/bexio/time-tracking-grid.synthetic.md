# time-tracking-grid.synthetic.html

**Not a capture.** Hand-built from the read-only probe of bexio's new time tracking list recorded
in issue #168 (2026-09-30): `bexio-time-tracking-grid`, ag-grid's `.ag-row` / `.ag-cell[col-id]`,
the `date` / `activity` / `text` column ids, the "Spalten" button, and the remarks cell renderer
`bexio-time-entry-remarks-cell-renderer fa-icon[aria-label]` whose `aria-label` holds the full
remark as plain text with `\n` line breaks. bexio's toolbar markup around the "Spalten" button was
not recorded.

- Page: `/index.php/time-tracking?sortBy=date:desc&filter=all&filterBy=`, three rows.
- Row 1: a one-line remark with an `&`. Row 2: three lines, one of them containing markup-like
  text that must stay text. Row 3: no remark (no icon).
- ag-grid's API (`__agComponent` on `.ag-root-wrapper`) is a page-JS expando and cannot be part of
  static HTML; the tests of `apps/bexioGridColumns` attach a fake one.
- Names are placeholders; nothing was anonymised because nothing was captured.

**Replace it with a capture** of the grid (see `README.md`) — the capture script as it is keeps
the body, which is where the grid lives.
