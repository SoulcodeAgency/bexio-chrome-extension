# Fixture: pr_project-listMonitoring

- **Source URL:** https://office.bexio.com/index.php/pr_project/listMonitoring/projectId/<projectId>
- **Captured:** 2026-09-17
- **Captured via:** the in-page capture script in `README.md` (live DOM, full body, extension changes undone); `<html class="use-new-nav">` restored from the live page (its other, Modernizr-generated classes are dropped); built with `npm run fixtures:build`
- **Trimmed:** `<script>`, `<style>`, `<link>`, `<noscript>` and `<iframe>` removed; inline event-handler attributes (`onclick`, …) removed; the Angular shell roots (`bexio-application-header-root`, `bexio-application-navigation-root`, `bexio-application-footer-root`, `application-wrapper-root`, `.cdk-overlay-container`) emptied; chat/analytics widgets and unused modal placeholders removed (incl. `#jqDialog`); every `<tbody>` cut to 12 data rows; selects with more than 5 options cut to their first 3; whitespace between tags collapsed.
- **Anonymised:** yes — names → Doe/Roe/Smith/Klein/Weber/… placeholders; clients/projects → Acme/Globex/Initech/Umbrella/Hooli placeholders; every popover `data-content` replaced with "Sample time entry N" (#1 contains `&amp;`, #2 contains `<br />`); e-mail addresses → example.com; CSRF tokens → `TEST_CSRF_TOKEN`; the access token in bexio's hidden support form → `TEST_ACCESS_TOKEN`; UUIDs zeroed; record ids → 99999 / `item9000N`.
- **Notable elements for tests:** Full body: page title bar with `a.js-first-btn` ('Neues Projekt'); `.listBlock` with `table#dataTable` (12 time-entry rows with `<i rel='popover'>` icons); the project sidebar's team cards also carry `data-content` (mailto markup, `rel='sticky'`, not popovers).
- **Size:** 48871 bytes; 12 `i[rel='popover']` icons
