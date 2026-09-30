# time-tracking-modal.synthetic.html

**Not a capture.** Hand-built from the read-only probe of bexio's new time tracking UI recorded
in issue #168 (2026-09-30): the `data-for-test` names, the widget element names, the dialog title,
the button texts and the disabled states are the ones listed there. The surrounding Angular
Material markup (`mat-dialog-container`, `.mat-mdc-dialog-surface`, `.mat-mdc-select-trigger`,
`.mat-mdc-select-value(-text)`) follows Angular Material's MDC components; bexio's exact nesting
was not recorded.

- Page: `/index.php/time-tracking` → "Zeit erfassen" → "Neue Zeiterfassung" (dialog open, empty).
- The `.cdk-overlay-container` holds no option panels: `mat-select` panels only exist while a
  select is open. `test/support/fakeMatSelect.ts` emulates them — opening, the search input,
  the stale panels with duplicate ids, the Projekt → Kontakt / Arbeitspaket → Projekt dependencies.
- "Ansprechpartner" is pre-set to the current user ("Muster Max", `Lastname Firstname`), as bexio
  does.
- Names are placeholders; nothing was anonymised because nothing was captured.

**Replace it with a capture** (see `README.md`) once the dialog can be recaptured: the capture
script clears `.cdk-overlay-container`, so the dialog needs a `keepDialog`-style option for the
overlay first.
