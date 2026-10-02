/**
 * Selectors for bexio's new time entry modal (#168).
 *
 * Since 2026-09 bexio creates and edits time entries in an Angular Material dialog —
 * `mat-dialog-container > … > div.time-entries-dialog--editor` — opened by "Zeit erfassen" on
 * `/index.php/time-tracking` and on the project / work package pages. The old `monitoring/edit`
 * form is still served; `hasMonitoringForm()` tells the two apart, and every caller that works on
 * both dispatches on it.
 *
 * Unlike `selectors.ts`, nothing here is resolved at module load: the dialog comes and goes
 * without a page load, so every lookup runs at call time.
 *
 * bexio ships stable `data-for-test` attributes for most fields; the date field has none. Angular
 * Material's own ids (`mat-select-N`, `mat-option-N`, `mat-input-N`) are generated per render and
 * are never used as selectors.
 */

/** `true` on the old `monitoring/edit` pages, which carry the server-rendered `#MonitoringForm`. */
export const hasMonitoringForm = () => document.getElementById("MonitoringForm") !== null;

/**
 * The dialog's content: header (title), body (the fields) and footer ("Eintrag speichern"). Not
 * `bexio-time-entry-editor-modal`: that component stays an empty host in the page, outside the
 * overlay, and renders the dialog through a portal (verified live 2026-10-02).
 */
export const EDITOR_MODAL_SELECTOR = "mat-dialog-container .time-entries-dialog--editor";

/**
 * The open time entry dialog, or `null`. The last match wins: a dialog that is closing stays in the
 * DOM for its exit animation while a new one may already be there.
 */
export const getOpenEditorModal = (): HTMLElement | null => {
  const modals = document.querySelectorAll<HTMLElement>(EDITOR_MODAL_SELECTOR);
  return modals.length > 0 ? modals[modals.length - 1] : null;
};

/** The dialog's `mat-dialog-container`, which also holds the title and the action buttons. */
export const getEditorModalContainer = (modal: HTMLElement): HTMLElement =>
  modal.closest<HTMLElement>("mat-dialog-container") ?? modal;

/** The dialog title: "Neue Zeiterfassung" or "Zeiterfassung bearbeiten". */
export const getEditorModalTitle = (modal: HTMLElement): string =>
  getEditorModalContainer(modal)
    .querySelector("[mat-dialog-title], .mat-mdc-dialog-title, h1, h2")
    ?.textContent?.trim() ?? "";

/** `true` for "Zeiterfassung bearbeiten" — the dialog edits an existing time entry. */
export const isEditModal = (modal: HTMLElement) => /bearbeiten/i.test(getEditorModalTitle(modal));

/** The `data-for-test` names of the dialog's select fields (`time-entry-editor-<name>`). */
export type ModalSelectKey = "activity" | "status" | "contact" | "project" | "sub-contact" | "work-package";

/** German labels, for messages the user reads. */
export const MODAL_SELECT_LABELS: Record<ModalSelectKey, string> = {
  activity: "Tätigkeit",
  status: "Status",
  contact: "Kontakt",
  project: "Projekt",
  "sub-contact": "Ansprechpartner",
  "work-package": "Arbeitspaket",
};

const byTestName = (root: ParentNode, name: string) =>
  root.querySelector<HTMLElement>(`[data-for-test="time-entry-editor-${name}"]`);

/**
 * A select field of the dialog: the `mat-select` element (role `combobox`). The `data-for-test`
 * attribute sits on the `mat-select` itself; a wrapper carrying it is tolerated.
 */
export const getModalSelect = (key: ModalSelectKey, modal = getOpenEditorModal()): HTMLElement | null => {
  if (!modal) return null;
  const element = byTestName(modal, key);
  if (!element) return null;
  return element.matches("mat-select") ? element : (element.querySelector<HTMLElement>("mat-select") ?? element);
};

/** What a `mat-select` shows as its value; `""` while it shows its placeholder. */
export const readModalSelectText = (select: HTMLElement): string =>
  select.querySelector(".mat-mdc-select-value-text")?.textContent?.replace(/\s+/g, " ").trim() ?? "";

/** A `mat-select` is disabled until the field it depends on is set (Projekt → Kontakt, …). */
export const isModalSelectEnabled = (select: HTMLElement) =>
  select.getAttribute("aria-disabled") !== "true" && !select.classList.contains("mat-mdc-select-disabled");

/** The element to click to open a `mat-select`: its trigger, which carries Angular's click handler. */
export const getModalSelectTrigger = (select: HTMLElement): HTMLElement =>
  select.querySelector<HTMLElement>(".mat-mdc-select-trigger") ?? select;

/**
 * The option panel of an open `mat-select`, or `null`.
 *
 * Closed panels stay in `.cdk-overlay-container` — with the **same id** as the next one. So the
 * id from `aria-controls` is looked up among all overlay panels and the last one wins.
 */
export const getLiveSelectPanel = (select: HTMLElement): HTMLElement | null => {
  if (select.getAttribute("aria-expanded") !== "true") return null;
  const panels = Array.from(
    document.querySelectorAll<HTMLElement>(
      ".cdk-overlay-container .mat-mdc-select-panel, .cdk-overlay-container [role='listbox']",
    ),
  );
  const panelId = select.getAttribute("aria-controls");
  const candidates = panelId ? panels.filter((panel) => panel.id === panelId) : panels;
  return candidates.length > 0 ? candidates[candidates.length - 1] : null;
};

/** The selectable options of a panel (disabled ones left out). */
export const getPanelOptions = (panel: HTMLElement): HTMLElement[] =>
  Array.from(panel.querySelectorAll<HTMLElement>("mat-option, .mat-mdc-option")).filter(
    (option) =>
      option.getAttribute("aria-disabled") !== "true" && !option.classList.contains("mdc-list-item--disabled"),
  );

/**
 * The ngx-mat-select-search input of an open panel. ngx-mat-select-search keeps a hidden twin
 * (`.mat-select-search-hidden`), which is never the one to type into.
 */
export const getPanelSearchInput = (panel: HTMLElement): HTMLInputElement | null => {
  const selector = "input.mat-select-search-input:not(.mat-select-search-hidden)";
  const inPanel = panel.querySelector<HTMLInputElement>(selector);
  if (inPanel) return inPanel;
  const all = document.querySelectorAll<HTMLInputElement>(`.cdk-overlay-container ${selector}`);
  return all.length > 0 ? all[all.length - 1] : null;
};

/** The first `<input>` of the element carrying `data-for-test="time-entry-editor-<name>"`, or that element. */
const getTestInput = (name: string, modal: HTMLElement | null): HTMLInputElement | null => {
  if (!modal) return null;
  const element = byTestName(modal, name);
  if (!element) return null;
  return element instanceof HTMLInputElement ? element : element.querySelector<HTMLInputElement>("input");
};

/** "Dauer" — `bexio-time-entry-hh-mm-input`, `hh:mm`. */
export const getModalDurationInput = (modal = getOpenEditorModal()) => getTestInput("duration", modal);

/** "Datum" — the mat-datepicker input, `dd.MM.yyyy`. It has no `data-for-test`. */
export const getModalDateInput = (modal = getOpenEditorModal()) =>
  modal?.querySelector<HTMLInputElement>("bexio-simple-datepicker input") ?? null;

/** "Bemerkungen" — ngx-editor, i.e. a ProseMirror `contenteditable`. */
export const getModalRemarksEditor = (modal = getOpenEditorModal()): HTMLElement | null => {
  const host = modal ? byTestName(modal, "remarks") : null;
  if (!host) return null;
  return (
    host.querySelector<HTMLElement>("[contenteditable='true']") ??
    host.querySelector<HTMLElement>(".ngx-editor-textarea")
  );
};

/**
 * "verrechenbar" — the checkbox of a `bexio-slide-toggle`. Picked by its label when the dialog has
 * more than one toggle.
 */
export const getModalBillableToggle = (modal = getOpenEditorModal()): HTMLInputElement | null => {
  if (!modal) return null;
  const toggles = Array.from(modal.querySelectorAll<HTMLElement>("bexio-slide-toggle"));
  const toggle = toggles.find((element) => /verrechenbar/i.test(element.textContent ?? "")) ?? toggles[0];
  return toggle?.querySelector<HTMLInputElement>("input[type='checkbox']") ?? null;
};

const normalizedText = (element: Element) => (element.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/** "Eintrag speichern". It stays `disabled` until the required fields are valid. */
export const getModalSaveButton = (modal = getOpenEditorModal()): HTMLButtonElement | null => {
  if (!modal) return null;
  const buttons = Array.from(getEditorModalContainer(modal).querySelectorAll<HTMLButtonElement>("button"));
  return (
    buttons.find((button) => normalizedText(button) === "eintrag speichern") ??
    buttons.find((button) => button.classList.contains("Button--primary")) ??
    null
  );
};

/**
 * The button that opens a new time entry dialog: `.fe-create-time-entry-btn` on project pages, the
 * "Zeit erfassen" button in the page heading of `/time-tracking`.
 */
export const getCreateTimeEntryButton = (): HTMLElement | null =>
  document.querySelector<HTMLElement>(".fe-create-time-entry-btn") ??
  Array.from(document.querySelectorAll<HTMLElement>("button, a")).find(
    (element) => normalizedText(element) === "zeit erfassen",
  ) ??
  null;
