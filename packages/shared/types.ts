/**
 * A single time-tracking template stored in `chrome.storage.local` under the `"entries"` key.
 *
 * **Status values** are the German bexio work-status labels:
 * - `"Offen"` — open / not started
 * - `"In Arbeit"` — in progress
 * - `"Erledigt"` — done
 * - `"Fakturiert"` — invoiced
 * - `"Geschlossen"` — closed
 *
 * **`[key: string]: any` escape hatch** — allows extra fields introduced in later versions to
 * survive storage round-trips without TypeScript errors, and lets legacy entries (which may
 * lack newer fields) be read without type-narrowing gymnastics.
 *
 * **Historical note:** before v0.4.x there was no `templateName` field; the `id` field served
 * as the human-readable name. Always use `getTemplateName(entry)` to display a template's name
 * rather than reading `entry.templateName` directly.
 */
export type TemplateEntry = {
  templateName: string;
  keywords: string;
  billable: boolean;
  contact: string;
  contactPerson: string;
  id: string;
  package: string;
  project: string;
  status: "Offen" | "In Arbeit" | "Erledigt" | "Fakturiert" | "Geschlossen";
  work: string;
  [key: string]: any;
};

export type ExchangeMode = "template" | "time+duration";

export type EntryExchangeData = {
  mode: "time+duration";
  duration: string;
  date: string;
  notes: undefined | string;
  billable?: boolean;
};

export type TemplateExchangeData = {
  mode: "template";
  templateId: string;
  timeEntryBillable?: boolean;
};

export type ReloadExtension = {
  mode: "reload";
};

/**
 * Asks the content script to click bexio's "Speichern" button. Sent by the side panel's 📤 button
 * after an entry was applied — never automatically, the user always confirms with that second click.
 */
export type SubmitFormData = {
  mode: "submit";
};

export type ExchangeRequestData = TemplateExchangeData | EntryExchangeData | ReloadExtension | SubmitFormData;

/**
 * Content script → service worker: open this tab's side panel. Sent by the "open side panel"
 * button in the injected Templates block via `chrome.runtime.sendMessage`; the worker answers
 * with `chrome.sidePanel.open`.
 */
export type OpenSidePanelRequest = {
  mode: "openSidePanel";
};

/**
 * Content script → side panel, also via `chrome.runtime.sendMessage`. The content script sends it
 * whenever `#MonitoringForm` fires a `submit` event — a click on "Speichern", Enter inside the
 * form, or the side panel's own `SubmitFormData` request. The side panel marks the entry that is
 * waiting on 📤 as booked (✅). The service worker's listener ignores it.
 */
export type FormSubmittedMessage = {
  mode: "form-submitted";
};

/**
 * The answer the content script's `chrome.runtime.onMessage` listener sends back for every
 * `ExchangeRequestData` it receives (see `packages/chrome-extension/src/eventListeners/onMessage.ts`).
 *
 * `{ ok: true }` means the request is applied to the form: every `trigger*` call and `fillForm` are
 * awaited, so for a template it arrives after the last field is filled and the loader is hidden. The
 * side panel offers its 📤 submit step on that acknowledgement. A fill that ended half-done (timeout,
 * stale template id) answers `{ ok: false }` (see `docs/architecture/form-layer.md`).
 *
 * The side panel treats a rejected `chrome.tabs.sendMessage` (no content script in the tab) and an
 * `{ ok: false }` response as the two failure cases it reports to the user.
 */
export type ExchangeResponse = { ok: true } | { ok: false; error: string };
