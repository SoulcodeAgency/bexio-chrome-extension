import { chromeStorageSettings } from "@bexio-chrome-extension/shared";
import convertGridRemarks from "../../utils/convertGridRemarks";
import { getGridColumnsButton } from "../../selectors/timeTrackingGrid";

export const GRID_NOTES_TOGGLE_ID = "GridNotesTextSwitcher";

/**
 * The "Text | Tooltip" toggle for bexio's new time tracking grids (#168), placed left of the grid's
 * "Spalten" menu — the new pages have no old title bar to put it in. Same setting
 * (`removePopoversSetting`) and same behaviour as the old toggle (`renderHtml.ts`); styled by
 * `public/bexioProjectList.css`, without bexio's old `.btn` / halflings classes, which the new
 * pages do not load.
 *
 * Idempotent, and a no-op while the grid (and with it the "Spalten" button) is not rendered yet:
 * the grid observer calls it again after every grid mutation.
 */
async function renderGridNotesToggle() {
  if (document.getElementById(GRID_NOTES_TOGGLE_ID)) return;
  const columnsButton = getGridColumnsButton();
  if (!columnsButton) return;

  const group = document.createElement("div");
  group.id = GRID_NOTES_TOGGLE_ID;
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", "Show remarks as");
  const buttons = (["text", "tooltip"] as const).map((mode) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.mode = mode;
    button.textContent = mode === "text" ? "Text" : "Tooltip";
    button.title = mode === "text" ? "Show remarks as text" : "Show remarks as tooltip icons";
    return button;
  });
  group.append(...buttons);
  // Next to the menu trigger, not inside it: bexio wraps the "Spalten" button in the
  // `div.mat-mdc-menu-trigger` that opens the column menu on any click within it (seen live
  // 2026-10-03), so a toggle placed beside the button itself opened that menu on every click.
  const anchor = columnsButton.closest<HTMLElement>(".mat-mdc-menu-trigger, [aria-haspopup]") ?? columnsButton;
  // Inserted before the first await, so a second call cannot pass the guard above in the meantime.
  anchor.insertAdjacentElement("beforebegin", group);

  const showActiveMode = (isTextMode: boolean) => {
    for (const button of buttons) {
      button.setAttribute("aria-pressed", String((button.dataset.mode === "text") === isTextMode));
    }
  };

  group.addEventListener("click", async (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-mode]");
    if (!button || button.getAttribute("aria-pressed") === "true") return;
    const isTextMode = button.dataset.mode === "text";
    showActiveMode(isTextMode);
    await chromeStorageSettings.saveRemovePopoversSetting(isTextMode);
    await convertGridRemarks();
  });

  showActiveMode(await chromeStorageSettings.loadRemovePopoversSetting());
}

export default renderGridNotesToggle;
