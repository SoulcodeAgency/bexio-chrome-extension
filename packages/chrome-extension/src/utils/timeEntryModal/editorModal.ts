import { TemplateEntry } from "@bexio-chrome-extension/shared/types";
import {
  getCreateTimeEntryButton,
  getModalBillableToggle,
  getModalDurationInput,
  getModalSaveButton,
  getModalSelect,
  getOpenEditorModal,
  isEditModal,
  ModalSelectKey,
  readModalSelectText,
} from "../../selectors/timeEntryModal";
import pollUntil, { WaitForTimeoutError } from "../pollUntil";
import { CONTACT_PROJECTS_REQUEST, RequestWatch, watchRequests } from "./bexioRequests";
import type { TemplateFormValues } from "../readCurrentFormValues";
import { setModalBillable, setModalDate, setModalDuration, setModalRemarks } from "./modalFields";
import selectMatOption from "./selectMatOption";

/**
 * The new time entry dialog (#168) as the side panel and the Templates block use it: open it, fill
 * it from a template or a ManicTime entry, read it back, save it. The counterpart of the old
 * `monitoring/edit` code in `fillForm`, `onMessage`, `readCurrentFormValues` and
 * `submitMonitoringForm`, which dispatch here when the page has no `#MonitoringForm`.
 */

export const EDIT_MODAL_OPEN_MESSAGE =
  '"Zeiterfassung bearbeiten" is open. Close it first - the entry would overwrite an existing time entry.';

/**
 * Returns the open time entry dialog, opening a new one ("Zeit erfassen") when none is open.
 *
 * @param allowEdit Whether an open "Zeiterfassung bearbeiten" dialog may be used. A template may be
 *                  applied to it (as on the old `monitoring/edit/id/…` page); a ManicTime entry
 *                  must not be, it would change an existing time entry's date and duration.
 */
export async function ensureEditorModal({ allowEdit }: { allowEdit: boolean }): Promise<HTMLElement> {
  const open = getOpenEditorModal();
  if (open) {
    if (!allowEdit && isEditModal(open)) throw new Error(EDIT_MODAL_OPEN_MESSAGE);
    return open;
  }
  const createButton = getCreateTimeEntryButton();
  if (!createButton) {
    throw new Error('No "Zeit erfassen" button found on this page - open bexio\'s time tracking (Projekte → Zeiten).');
  }
  createButton.click();
  const modal = await pollUntil("the time entry dialog to open", () => getOpenEditorModal());
  // The dialog's content renders a moment after the container.
  await pollUntil("the time entry dialog's fields to render", () => getModalSelect("activity", modal));
  return modal;
}

/** How long a changed Kontakt may take to load its projects before the fill goes on regardless. */
export const CONTACT_PROJECTS_WAIT_MS = 5_000;

/**
 * Waits until bexio has loaded the projects of the contact just picked (see `bexioRequests.ts` for
 * why a project picked earlier breaks Arbeitspaket). Never fails the fill: without an observer, or
 * when bexio's API path changed and nothing matches, it goes on after at most
 * {@link CONTACT_PROJECTS_WAIT_MS} — the behaviour before this wait existed.
 */
async function waitForContactProjects(watch: RequestWatch, since: number): Promise<void> {
  if (!watch.available) return;
  await pollUntil(
    "bexio to load the contact's projects",
    () => watch.finishedSince(since),
    50,
    CONTACT_PROJECTS_WAIT_MS,
  ).catch((error: unknown) => {
    if (!(error instanceof WaitForTimeoutError)) throw error;
  });
}

/**
 * Applies a template in the order the dialog's dependencies need:
 * Tätigkeit, Status, Kontakt → Projekt (enabled once a contact is set) → Arbeitspaket (enabled once
 * a project is set; skipped when the template has none) → Ansprechpartner → verrechenbar.
 * After a changed Kontakt the project waits for bexio to load that contact's projects.
 * `timeEntryBillable` (a ManicTime entry's flag) wins over the template's `billable`, which defaults
 * to `true` — the same rule as the old form.
 */
export async function fillEditorModal(entry: TemplateEntry, timeEntryBillable?: boolean): Promise<void> {
  await ensureEditorModal({ allowEdit: true });
  const { work = null, status = null, contact = null, contactPerson = null, project = null, billable = true } = entry;

  await selectMatOption("activity", work);
  await selectMatOption("status", status);
  const contactProjects = watchRequests(CONTACT_PROJECTS_REQUEST);
  try {
    const contactPickedAt = performance.now();
    if ((await selectMatOption("contact", contact)) && project) {
      await waitForContactProjects(contactProjects, contactPickedAt);
    }
  } finally {
    contactProjects.stop();
  }
  await selectMatOption("project", project);
  await selectMatOption("work-package", entry.package ?? null);
  await selectMatOption("sub-contact", contactPerson);
  await setModalBillable(timeEntryBillable ?? billable);

  getModalSaveButton()?.focus();
}

export type ModalEntry = {
  date: string;
  duration: string;
  billable?: boolean;
  /** Already filtered by the "apply notes" setting and capitalised; `undefined` leaves the remarks alone. */
  notes?: string;
};

/** Applies a ManicTime entry. Opens a new dialog when none is open; never writes into an edit dialog. */
export async function applyEntryToEditorModal(entry: ModalEntry): Promise<void> {
  await ensureEditorModal({ allowEdit: false });
  await setModalDate(entry.date);
  await setModalDuration(entry.duration);
  await setModalBillable(entry.billable);
  if (entry.notes !== undefined) {
    await setModalRemarks(entry.notes);
  }
}

const readSelect = (key: ModalSelectKey) => {
  const select = getModalSelect(key);
  return select ? readModalSelectText(select) : "";
};

/** Reads the open dialog into the fields of a template. Throws when no dialog is open. */
export async function readEditorModalValues(): Promise<TemplateFormValues> {
  if (!getOpenEditorModal()) throw new Error("No time entry dialog is open.");
  return {
    work: readSelect("activity"),
    status: readSelect("status"),
    // First two words, as the old form stored it — templates are shared by both UIs, and a
    // contact is found again by a substring of its name.
    contact: readSelect("contact").split(" ").slice(0, 2).join(" "),
    contactPerson: readSelect("sub-contact"),
    project: readSelect("project"),
    package: readSelect("work-package"),
    billable: getModalBillableToggle()?.checked ?? true,
  };
}

/** A duration that books nothing: empty, or all zeroes (`00:00`, `0:00`). */
const isEmptyDuration = (value: string) => /^[0:\s]*$/.test(value);

/**
 * Clicks "Eintrag speichern" — only ever on the user's explicit 📤 click in the side panel.
 *
 * @throws when no dialog is open, when the duration is empty or zero, and when the button is
 *         disabled (bexio keeps it disabled until the required fields are valid).
 */
export function submitEditorModal(): void {
  const modal = getOpenEditorModal();
  if (!modal) throw new Error("No time entry dialog is open - nothing to save.");
  const duration = getModalDurationInput(modal)?.value ?? "";
  if (isEmptyDuration(duration)) {
    throw new Error("The duration is empty - nothing to save. Apply an entry first.");
  }
  const saveButton = getModalSaveButton(modal);
  if (!saveButton) throw new Error('The "Eintrag speichern" button was not found.');
  if (saveButton.disabled) {
    throw new Error("bexio does not accept the entry yet - a required field is missing. Check the dialog.");
  }
  saveButton.click();
}
