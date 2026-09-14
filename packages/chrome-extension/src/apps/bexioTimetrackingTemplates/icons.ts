/**
 * Inline SVG icons for the panel's header controls.
 *
 * Inline rather than bexio's Glyphicons font, so the panel does not depend on which
 * glyphs bexio happens to ship. Every icon is decorative (`aria-hidden`): the button
 * or field that hosts it carries the accessible name. The markup is static — no
 * template data ever passes through here — which is what makes inserting it as HTML
 * safe (see the "static markup only" rule in `renderHtml.ts`).
 */
export type IconName = "plus" | "search" | "pencil" | "check";

const PATHS: Record<IconName, string> = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  pencil: '<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  check: '<path d="m20 6-11 11-5-5"/>',
};

export function iconSvg(name: IconName): string {
  return (
    `<svg class="template-icon" data-icon="${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    `${PATHS[name]}</svg>`
  );
}
