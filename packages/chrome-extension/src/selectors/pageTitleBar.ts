/**
 * Returns the flex block that holds the page's primary action button (e.g. "Neue Zeiterfassung",
 * "Neues Projekt", "Neue Rechnung") in bexio's page title bar, or `null` when the page has none.
 *
 * The title bar is server-rendered on every page the bexioProjectList content script runs on,
 * so it exists when the script starts. It survived bexio's switch to the sidebar layout
 * (2026-09), which hid the legacy top navigation the toggle used to sit in.
 */
export const getPrimaryActionBlock = () =>
  document
    .querySelector(".bx-breadcrumb-container .bx-card-title .js-first-btn")
    ?.closest<HTMLElement>(".bx-flex-block") ?? null;
