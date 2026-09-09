import fillForm from "../../utils/fillForm";
import getTemplateName from "@bexio-chrome-extension/shared/getTemplateName";
import { DATE, VERSION } from "../../utils/packageInfo";
import { toggleDisplayLoader } from "../../utils/loader";
import { updateActiveTemplate } from "../../utils/updateActiveTemplate";
import { showPanelToast } from "./panelToast";
import { setupTemplateFilter } from "./filter";
import { setupInlineAddForm } from "./inlineAddForm";
import { setupManageMode } from "./manageMode";
import { attachTemplateTooltip, hideTemplateTooltip } from "./tooltip";
import { TemplateEntry } from "@bexio-chrome-extension/shared/types";

/**
 * Builds one template chip as DOM nodes.
 *
 * The id, the display name and the keywords are **never** interpolated into an
 * HTML string: they come from untrusted storage (bexio field values, the add
 * form, the side panel's template modal; for pre-v0.5.x entries the free-form
 * name *is* the id). `textContent`, the `id` property setter, `setAttribute`
 * and `dataset` assignments cannot be escaped out of — the same "sanitise
 * before HTML" rule the tooltip feature follows (see `convertPopover.ts`).
 */
function createTemplateChip(entry: TemplateEntry): HTMLDivElement {
  const name = getTemplateName(entry);

  const chip = document.createElement("div");
  chip.className = "template-chip";
  chip.dataset.filter = `${name} ${entry.keywords ?? ""}`.toLowerCase();

  const button = document.createElement("button");
  button.type = "button";
  button.id = entry.id;
  button.className = "entry template-button";
  button.setAttribute("aria-pressed", "false");
  button.textContent = name;
  chip.appendChild(button);

  const updateButton = document.createElement("button");
  updateButton.type = "button";
  updateButton.className = "template-chip-update";
  updateButton.title = "Overwrite this template with the current form values";
  updateButton.textContent = "↻";
  updateButton.hidden = true; // shown for the active chip only (setActiveChip)
  chip.appendChild(updateButton);

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "template-chip-delete";
  deleteButton.setAttribute("aria-label", `Delete template ${name}`);
  deleteButton.textContent = "×";
  chip.appendChild(deleteButton);

  return chip;
}

function setActiveChip(panel: HTMLElement, button: HTMLButtonElement): void {
  panel.querySelectorAll<HTMLButtonElement>("button.template-button").forEach((other) => {
    other.classList.remove("template-button--active");
    other.setAttribute("aria-pressed", "false");
  });
  panel.querySelectorAll<HTMLButtonElement>(".template-chip-update").forEach((update) => (update.hidden = true));
  button.classList.add("template-button--active");
  button.setAttribute("aria-pressed", "true");
  const update = button.parentElement?.querySelector<HTMLButtonElement>(".template-chip-update");
  if (update) update.hidden = false;
}

// Renders the whole template panel into the monitoring/edit page.
async function renderHtml(templateEntries: TemplateEntry[] | undefined) {
  // Remove the panel if it already exists (re-render after storage changes)
  document.getElementById("SoulcodeExtensionTemplates")?.remove();

  const templatePlacement = document.getElementById("pr_package")?.parentNode?.parentNode?.parentNode as HTMLElement;

  // Static markup only — template-derived strings are appended as DOM nodes below.
  const logoPath = chrome.runtime.getURL("assets/logo_orig.png");
  templatePlacement.insertAdjacentHTML(
    "beforeend",
    `<div id="SoulcodeExtensionTemplates" class="row-fluid">
        <hr>
        <div class="bx-formular-header" style="display: flex; justify-content: space-between">
            <h2 title="Soulcode extension v${VERSION} — last update ${DATE}">Templates</h2>
            <div id="SoulcodeExtensionActions" style="margin-left: 4px; margin-bottom: 5px; display: flex; align-items: center; gap: 5px;">
              <div class="template-search-filter">
                <input type="search" id="templateFilter" class="search-input" placeholder="Filter templates">
                <button id="templateFilterReset" class="template-search-filter-clear-button" type="button">&times;</button>
              </div>
              <button type="button" id="AddNewTemplate" class="btn btn-info">+ Add</button>
              <button type="button" id="ManageTemplates" class="btn">Manage</button>
            </div>
        </div>
        <div id="SoulcodeExtensionAddForm" hidden>
          <label for="templateNameInput">Name</label>
          <input type="text" id="templateNameInput">
          <button type="button" id="templateNameSave" class="btn btn-info">Save</button>
          <button type="button" id="templateNameCancel" class="btn">Cancel</button>
          <span id="templateNameError" hidden></span>
        </div>
        <div id="bexioTimetrackingTemplates-entries"><div id="templateFilterEmpty" hidden></div></div>
        <div id="SoulcodeExtensionLoader" style="position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #3176b4;
        z-index: 10000000000;
        opacity: 0.6;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 5rem;
        display: none;">
            <div style="color: white"><img src="${logoPath}" style="min-width: 200px; max-width: 10vw; margin-right: 20px;" />Loading...</div>
            <div id="closeModal" style="position: absolute; top: 30px; right: 30px; cursor: pointer;">
                <div style="width: 40px; height: 40px; border-radius: 50%; background-color: #ccc; display: flex; justify-content: center; align-items: center;">
                    <span style="font-size: 2rem;font-weight: normal;">&times;</span>
                </div>
            </div>
        </div>
    </div>`,
  );

  const panel = document.getElementById("SoulcodeExtensionTemplates")!;
  const entriesContainer = document.getElementById("bexioTimetrackingTemplates-entries")!;
  const emptyState = document.getElementById("templateFilterEmpty")!;

  (templateEntries ?? []).forEach((entry) => {
    const chip = createTemplateChip(entry);
    entriesContainer.insertBefore(chip, emptyState);
    attachTemplateTooltip(chip.querySelector<HTMLButtonElement>("button.template-button")!, entry, panel);
  });

  // ── Apply / update click handling (delegated) ──
  entriesContainer.addEventListener("click", (e) => {
    const updateButton = (e.target as HTMLElement).closest<HTMLButtonElement>(".template-chip-update");
    if (updateButton) {
      e.preventDefault();
      const applyButton = updateButton.parentElement?.querySelector<HTMLButtonElement>("button.template-button");
      if (!applyButton) return;
      void updateActiveTemplate(applyButton.id).then((updated) => {
        if (!updated) {
          showPanelToast(panel, { text: "Could not update — template not found in storage." });
          return;
        }
        updateButton.textContent = "Updated ✓";
        window.setTimeout(() => (updateButton.textContent = "↻"), 1500);
      });
      return;
    }
    const applyButton = (e.target as HTMLElement).closest<HTMLButtonElement>("button.template-button");
    if (!applyButton) return;
    e.preventDefault();
    hideTemplateTooltip();
    if (panel.classList.contains("manage-mode")) return; // apply is inert while managing
    fillForm(applyButton.id);
    setActiveChip(panel, applyButton);
  });

  setupInlineAddForm(panel);

  document.getElementById("closeModal")?.addEventListener("click", (e) => {
    e.preventDefault();
    toggleDisplayLoader(false);
  });

  setupTemplateFilter(panel);
  setupManageMode(panel, templateEntries ?? []);
}

export default renderHtml;
