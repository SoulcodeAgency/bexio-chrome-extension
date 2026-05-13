# Fixture: monitoring-list

- **Source URL:** https://office.bexio.com/index.php/monitoring/list
- **Captured:** 2026-05-13
- **Captured via:** `copy(document.body.outerHTML) — full body so .globalsearch (which the content script's renderHtml() needs) is present`
- **Trimmed:** inline <script> blocks removed; modal-dialog placeholders + chat widgets + iframes pruned; data <tbody> reduced to 12 rows + footer_row; one kept row's data-content was given an '&amp;' so entity-decoding is exercised; raw capture was taken with the extension active in Text mode, so the injected .new-popover-text divs were dropped, the popover <i>s un-hidden, and the extension-set <td> background-colors removed, restoring the pristine pre-conversion bexio state.
- **Anonymised:** yes — personal names → Doe/Roe/Smith/Klein/Weber/… placeholders; client/project/package/template names → Acme/Globex/Initech/Project Falcon/AC… placeholders; CSRF token → `TEST_CSRF_TOKEN`; extension id → `EXTENSION_ID_PLACEHOLDER`.
- **Notable elements for tests:** Full body — incl. the nav (.globalsearch — required by bexioProjectList/renderHtml.ts) and #monitoring_content with table#dataTable; ~12 <tr.link id='item...'> rows, each with a visible <i rel='popover' data-content='...'> tooltip icon (no .new-popover-text present — clean pre-conversion state).
- **Size:** 82558 bytes; 12 `i[rel='popover']` icons
