/**
 * The panel's static elements, resolved **once** right after the markup is
 * inserted and before the first template chip is appended.
 *
 * This is a boundary, not a convenience. `renderHtml` sets `button.id = entry.id`
 * from untrusted storage — for pre-v0.5.x entries the free-form template name
 * *is* the id — and chips are inserted ahead of the static elements in document
 * order. A later `document.getElementById("closeModal")` or
 * `panel.querySelector("#templateFilterEmpty")` would therefore resolve to a
 * template chip whose id happens to match that string, handing the panel's own
 * wiring to stored data: the loader would lose its dismiss control, the filter
 * would relabel and hide a healthy chip, and the toast helper would delete one.
 * Resolving up front and passing the elements around makes that impossible.
 *
 * The `!` assertions are the same ones `renderHtml` always used: this function is
 * called on markup the caller just wrote, so a missing element is a bug in that
 * markup and should throw loudly rather than silently disable a feature.
 */
export type PanelElements = {
  panel: HTMLElement;
  entriesContainer: HTMLElement;
  emptyState: HTMLElement;
  filterInput: HTMLInputElement;
  filterReset: HTMLButtonElement;
  addButton: HTMLButtonElement;
  addForm: HTMLElement;
  nameInput: HTMLInputElement;
  nameSave: HTMLButtonElement;
  nameCancel: HTMLButtonElement;
  nameError: HTMLElement;
  manageButton: HTMLButtonElement;
  closeLoaderButton: HTMLElement;
};

export function resolvePanelElements(panel: HTMLElement): PanelElements {
  return {
    panel,
    entriesContainer: panel.querySelector<HTMLElement>("#bexioTimetrackingTemplates-entries")!,
    emptyState: panel.querySelector<HTMLElement>("#templateFilterEmpty")!,
    filterInput: panel.querySelector<HTMLInputElement>("#templateFilter")!,
    filterReset: panel.querySelector<HTMLButtonElement>("#templateFilterReset")!,
    addButton: panel.querySelector<HTMLButtonElement>("#AddNewTemplate")!,
    addForm: panel.querySelector<HTMLElement>("#SoulcodeExtensionAddForm")!,
    nameInput: panel.querySelector<HTMLInputElement>("#templateNameInput")!,
    nameSave: panel.querySelector<HTMLButtonElement>("#templateNameSave")!,
    nameCancel: panel.querySelector<HTMLButtonElement>("#templateNameCancel")!,
    nameError: panel.querySelector<HTMLElement>("#templateNameError")!,
    manageButton: panel.querySelector<HTMLButtonElement>("#ManageTemplates")!,
    closeLoaderButton: panel.querySelector<HTMLElement>("#closeModal")!,
  };
}
