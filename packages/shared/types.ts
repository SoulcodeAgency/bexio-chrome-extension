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

export type ImportData = string[];

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

export type ExchangeRequestData =
  | TemplateExchangeData
  | EntryExchangeData
  | ReloadExtension;

/**
 * The answer the content script's `chrome.runtime.onMessage` listener sends back for every
 * `ExchangeRequestData` it receives (see `packages/chrome-extension/src/eventListeners/onMessage.ts`).
 *
 * It is a **dispatch acknowledgement**, not a "the form is filled" signal: the listener replies as
 * soon as it has handed the request to the matching handler. `fillForm` in particular is not
 * awaited, because its `waitFor*` helpers have no timeout and could keep the message channel open
 * forever (see `docs/architecture/form-layer.md`).
 *
 * The side panel treats a rejected `chrome.tabs.sendMessage` (no content script in the tab) and an
 * `{ ok: false }` response as the two failure cases it reports to the user.
 */
export type ExchangeResponse = { ok: true } | { ok: false; error: string };
