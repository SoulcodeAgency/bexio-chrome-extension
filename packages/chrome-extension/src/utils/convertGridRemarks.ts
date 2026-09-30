import { chromeStorageSettings } from "@bexio-chrome-extension/shared";
import { getGridRemarkIcons, REMARKS_MODE_ATTRIBUTE, REMARKS_RENDERER_SELECTOR } from "../selectors/timeTrackingGrid";

export const REMARKS_TEXT_CLASS = "soulcode-grid-remarks";
export const REMARKS_CLIPPED_CLASS = "soulcode-grid-remarks--clipped";
export const REMARKS_HOST_CLASS = "soulcode-grid-remarks-host";

/**
 * The "Text" mode of the tooltip feature for bexio's new time tracking grids (#168): every remark
 * icon is hidden and its `aria-label` — the full remark — printed in the cell instead, clamped to
 * three lines (`public/bexioProjectList.css`); a clipped one expands on hover. In "Tooltip" mode
 * the cells are restored.
 *
 * ag-grid recycles row elements when it scrolls, pages and filters, and updates a recycled row's
 * `aria-label` in place. So this is a sync, not a one-off conversion: it runs after every grid
 * mutation (see `apps/bexioProjectList/index.ts`) and rewrites a printed text whose icon now says
 * something else. Text only — `textContent`, never HTML.
 *
 * Also publishes the mode on `<html>` for the MAIN-world script that widens the remarks column.
 */
export async function convertGridRemarks(): Promise<void> {
  const isTextMode = await chromeStorageSettings.loadRemovePopoversSetting();
  document.documentElement.setAttribute(REMARKS_MODE_ATTRIBUTE, isTextMode ? "text" : "tooltip");

  const changed: HTMLElement[] = [];
  for (const icon of getGridRemarkIcons()) {
    const host = icon.closest<HTMLElement>(REMARKS_RENDERER_SELECTOR)!;
    let text = Array.from(host.children).find((child) => child.classList.contains(REMARKS_TEXT_CLASS)) as
      HTMLElement | undefined;

    if (!isTextMode) {
      text?.remove();
      icon.style.display = "";
      host.classList.remove(REMARKS_HOST_CLASS);
      continue;
    }

    const remark = icon.getAttribute("aria-label") ?? "";
    if (!text) {
      text = document.createElement("div");
      text.className = REMARKS_TEXT_CLASS;
      host.appendChild(text);
    }
    if (text.textContent !== remark) {
      text.textContent = remark;
      changed.push(text);
    }
    icon.style.display = "none";
    host.classList.add(REMARKS_HOST_CLASS);
  }

  if (changed.length > 0) markClippedRemarks(changed);
}

/** Marks the texts the three-line clamp cuts off — measured after layout. */
function markClippedRemarks(texts: HTMLElement[]) {
  requestAnimationFrame(() => {
    for (const text of texts) {
      text.classList.toggle(REMARKS_CLIPPED_CLASS, text.scrollHeight > text.clientHeight + 1);
    }
  });
}

export default convertGridRemarks;
