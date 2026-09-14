/**
 * Inline SVG icons for the panel's header controls.
 *
 * Inline rather than bexio's Glyphicons font, so the panel does not depend on which
 * glyphs bexio happens to ship. Every icon is decorative (`aria-hidden`): the button
 * or field that hosts it carries the accessible name. The markup is static — no
 * template data ever passes through here — which is what makes inserting it as HTML
 * safe (see the "static markup only" rule in `renderHtml.ts`).
 */
export type IconName = "plus" | "search" | "trash" | "check" | "sidebar";

const PATHS: Record<IconName, string> = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  trash:
    '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/>' +
    '<path d="m19 6-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/><path d="M10 11v6M14 11v6"/>',
  check: '<path d="m20 6-11 11-5-5"/>',
  sidebar: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M15 4v16"/>',
};

export function iconSvg(name: IconName): string {
  return (
    `<svg class="template-icon" data-icon="${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    `${PATHS[name]}</svg>`
  );
}
