import { chromeStorageTemplateEntries } from "@bexio-chrome-extension/shared";
import getTemplateName from "@bexio-chrome-extension/shared/getTemplateName";
import { TemplateEntry } from "@bexio-chrome-extension/shared/types";
import { PanelElements } from "./panelElements";
import { showPanelToast } from "./panelToast";
import { hideTemplateTooltip } from "./tooltip";
import { initializeExtension } from "./index";

export type ManageModeOptions = {
  elements: PanelElements;
  /** Re-syncs anything derived from the chip list — the filter's empty state. */
  onEntriesChanged: () => void;
};

/**
 * Manage mode: the explicit, visible replacement for the old hidden delete
 * mode. Deleting is instant with a 5-second Undo toast instead of confirm().
 */
export function setupManageMode({ elements, onEntriesChanged }: ManageModeOptions): void {
  const { panel, entriesContainer, manageButton, addButton, addForm } = elements;

  manageButton.addEventListener("click", (e) => {
    e.preventDefault();
    const managing = panel.classList.toggle("manage-mode");
    manageButton.textContent = managing ? "Done" : "Manage";
    hideTemplateTooltip();
    addButton.disabled = managing;
    addForm.hidden = true;
    // A running Undo toast deliberately survives leaving the mode: "Done" is the
    // natural gesture right after deleting, and cancelling the undo window with
    // it made the toast worthless for exactly the mis-click it exists to catch.
  });

  entriesContainer.addEventListener("click", (e) => {
    const deleteButton = (e.target as HTMLElement).closest<HTMLButtonElement>(".template-chip-delete");
    if (!deleteButton || deleteButton.disabled || !panel.classList.contains("manage-mode")) return;
    e.preventDefault();

    const chip = deleteButton.closest<HTMLElement>(".template-chip");
    const applyButton = chip?.querySelector<HTMLButtonElement>("button.template-button");
    if (!chip || !applyButton) return;

    deleteButton.disabled = true;
    void deleteTemplate({ id: applyButton.id, chip, deleteButton, elements, onEntriesChanged });
  });
}

type DeleteContext = {
  id: string;
  chip: HTMLElement;
  deleteButton: HTMLButtonElement;
  elements: PanelElements;
  onEntriesChanged: () => void;
};

async function deleteTemplate({ id, chip, deleteButton, elements, onEntriesChanged }: DeleteContext): Promise<void> {
  const { panel } = elements;

  let entry: TemplateEntry | undefined;
  try {
    // Read the entry from storage rather than from a snapshot taken when the
    // panel was rendered: the ↻ update writes new field values under the same
    // id, and undoing a delete with the render-time copy would silently revert
    // that update.
    const entries = await chromeStorageTemplateEntries.loadTemplates();
    entry = entries.find((candidate) => candidate.id === id);
    await chromeStorageTemplateEntries.deleteTemplate(id);
  } catch {
    deleteButton.disabled = false;
    showPanelToast(panel, { text: "Could not delete the template — storage error." });
    return;
  }

  moveFocusOutOf(chip, elements);
  chip.remove();
  onEntriesChanged();

  const name = entry ? getTemplateName(entry) : (chip.textContent ?? "");
  showPanelToast(panel, {
    text: `Deleted "${name}"`,
    // Nothing to restore if the entry was already gone from storage.
    ...(entry ? { actionLabel: "Undo", onAction: () => void undoDelete(entry, panel) } : {}),
  });
}

/**
 * Deleting removes the element that currently has focus, which would drop focus
 * to `<body>` — leaving keyboard users at the top of the bexio page, far from
 * the Undo they have five seconds to reach. Hand focus to the next chip's delete
 * button instead, so bulk cleanup keeps working, or back to the mode's own toggle.
 */
function moveFocusOutOf(chip: HTMLElement, elements: PanelElements): void {
  if (!chip.contains(document.activeElement)) return;
  const chips = Array.from(elements.entriesContainer.querySelectorAll<HTMLElement>(".template-chip"));
  const index = chips.indexOf(chip);
  const neighbour = chips[index + 1] ?? chips[index - 1];
  const target = neighbour?.querySelector<HTMLButtonElement>(".template-chip-delete") ?? elements.manageButton;
  target.focus();
}

async function undoDelete(entry: TemplateEntry, panel: HTMLElement): Promise<void> {
  try {
    await chromeStorageTemplateEntries.restoreTemplate(entry);
  } catch {
    showPanelToast(panel, { text: "Could not restore the template — storage error." });
    return;
  }
  await initializeExtension();
}
