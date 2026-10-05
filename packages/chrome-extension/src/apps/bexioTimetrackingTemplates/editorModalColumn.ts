import { getOpenEditorModal } from "../../selectors/timeEntryModal";
import { isExtensionContextValid } from "../../utils/extensionContext";

/**
 * The Templates block in bexio's new time entry dialog (#168).
 *
 * The block becomes a column to the right of bexio's form, as on the old page: the dialog pane is
 * widened past its inline `max-width: 720px` and the dialog surface is laid out as a row, bexio's
 * form keeping its 720px. All of it is done with classes (`public/bexioTimetrackingTemplates.css`),
 * so nothing of bexio's own markup or inline styles is rewritten.
 */

export const MODAL_COLUMN_ID = "SoulcodeExtensionModalColumn";

/** Returns the column next to `modal`, creating it (and the layout classes) on first use. */
export function prepareEditorModalColumn(modal: HTMLElement): HTMLElement {
  const surface = modal.parentElement!;
  let column = Array.from(surface.children).find((child) => child.id === MODAL_COLUMN_ID) as HTMLElement | undefined;
  if (!column) {
    column = document.createElement("div");
    column.id = MODAL_COLUMN_ID;
    // Keys typed into the Templates column are not bexio's business: Escape in the filter would
    // otherwise close the dialog through the overlay's document-level keydown listener.
    column.addEventListener("keydown", (event) => event.stopPropagation());
    modal.insertAdjacentElement("afterend", column);
  }
  surface.classList.add("soulcode-modal-with-templates");
  modal.classList.add("soulcode-modal-form");
  modal.closest(".cdk-overlay-pane")?.classList.add("soulcode-modal-pane");
  return column;
}

let observer: MutationObserver | undefined;
let lastModal: HTMLElement | null = null;

/**
 * Calls `onOpen` once for every time entry dialog that opens — "Neue Zeiterfassung" and
 * "Zeiterfassung bearbeiten" alike. The page is a single-page app, so there is no page load between
 * the list and the dialog: a `MutationObserver` on `document.body` notices it (the dialog lives in
 * the `.cdk-overlay-container` Angular appends to the body). The callback is one `querySelectorAll`
 * per mutation batch. Idempotent: a second call does not add a second observer.
 */
export function watchEditorModal(onOpen: (modal: HTMLElement) => void): void {
  if (observer) return;
  const check = () => {
    if (!isExtensionContextValid()) {
      observer?.disconnect();
      return;
    }
    const modal = getOpenEditorModal();
    if (modal === lastModal) return;
    lastModal = modal;
    if (modal) onOpen(modal);
  };
  observer = new MutationObserver(check);
  observer.observe(document.body, { childList: true, subtree: true });
  check();
}

/** Test hook: forgets the observer and the last dialog seen. */
export function resetEditorModalWatcher(): void {
  observer?.disconnect();
  observer = undefined;
  lastModal = null;
}
