# Fixture: pr_project-listMonitoring

- **Source URL:** https://office.bexio.com/index.php/pr_project/listMonitoring/<projectId>
- **Captured:** 2026-05-13
- **Captured via:** `copy(document.getElementsByClassName('listBlock')[0].outerHTML)`
- **Trimmed:** inline <script> blocks removed; data <tbody> reduced to the first 12 rows + the footer_row.
- **Anonymised:** yes — personal names → Doe/Roe/Smith/Klein/Weber/… placeholders; client/project/package/template names → Acme/Globex/Initech/Project Falcon/AC… placeholders; CSRF token → `TEST_CSRF_TOKEN`; extension id → `EXTENSION_ID_PLACEHOLDER`.
- **Notable elements for tests:** .listBlock wrapper; table#dataTable; ~12 rows with <i rel='popover' data-content='...'> tooltip icons.
- **Size:** 102751 bytes; 12 `i[rel='popover']` icons
