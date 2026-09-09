import { chromeStorageTemplateEntries } from "@bexio-chrome-extension/shared";
import { TemplateEntry } from "@bexio-chrome-extension/shared/types";
import { hidePanelToast, showPanelToast } from "./panelToast";
import { hideTemplateTooltip } from "./tooltip";
import { initializeExtension } from "./index";

/**
 * Manage mode: the explicit, visible replacement for the old hidden delete
 * mode. Deleting is instant with a 5-second Undo toast instead of confirm().
 */
export function setupManageMode(panel: HTMLElement, templateEntries: TemplateEntry[]): void {
  const manageButton = panel.querySelector<HTMLButtonElement>("#ManageTemplates");
  const entriesContainer = panel.querySelector<HTMLElement>("#bexioTimetrackingTemplates-entries");
  const addButton = panel.querySelector<HTMLButtonElement>("#AddNewTemplate");
  const addForm = panel.querySelector<HTMLElement>("#SoulcodeExtensionAddForm");
  if (!manageButton || !entriesContainer) return;

  const entriesById = new Map(templateEntries.map((entry) => [entry.id, entry]));

  manageButton.addEventListener("click", (e) => {
    e.preventDefault();
    const managing = panel.classList.toggle("manage-mode");
    manageButton.textContent = managing ? "Done" : "Manage";
    hideTemplateTooltip();
    if (addButton) addButton.disabled = managing;
    if (addForm) addForm.hidden = true;
    if (!managing) hidePanelToast(); // leaving the mode ends the undo window
  });

  entriesContainer.addEventListener("click", (e) => {
    const deleteButton = (e.target as HTMLElement).closest<HTMLButtonElement>(".template-chip-delete");
    if (!deleteButton || !panel.classList.contains("manage-mode")) return;
    e.preventDefault();

    const chip = deleteButton.closest<HTMLElement>(".template-chip");
    const applyButton = chip?.querySelector<HTMLButtonElement>("button.template-button");
    if (!chip || !applyButton) return;

    const entry = entriesById.get(applyButton.id);
    const name = applyButton.textContent ?? "";
    void chromeStorageTemplateEntries
      .deleteTemplate(applyButton.id)
      .then(() => {
        chip.remove();
        showPanelToast(panel, {
          text: `Deleted "${name}"`,
          actionLabel: "Undo",
          onAction: () => void undoDelete(entry, panel),
        });
      })
      .catch(() => showPanelToast(panel, { text: "Could not delete the template — storage error." }));
  });
}

async function undoDelete(entry: TemplateEntry | undefined, panel: HTMLElement): Promise<void> {
  if (!entry) return;
  try {
    // Defensive against concurrent writers: restoreTemplate is a no-op when the
    // id re-appeared in the meantime (e.g. re-added through the side panel).
    await chromeStorageTemplateEntries.restoreTemplate(entry);
  } catch {
    showPanelToast(panel, { text: "Could not restore the template — storage error." });
    return;
  }
  await initializeExtension();
}
