import { chromeStorageTemplateEntries } from "@bexio-chrome-extension/shared";
import getTemplateName from "@bexio-chrome-extension/shared/getTemplateName";
import { TemplateEntry } from "@bexio-chrome-extension/shared/types";
import generateHash from "./generateHash";
import { readCurrentFormValues } from "./readCurrentFormValues";

export type CreateTemplateResult = { ok: true; entry: TemplateEntry } | { ok: false; reason: "duplicate" };

/** Two templates are "the same" when their name and every form field match. */
function hasSameContent(existing: TemplateEntry, candidate: TemplateEntry): boolean {
  return (
    getTemplateName(existing) === candidate.templateName &&
    existing.work === candidate.work &&
    existing.status === candidate.status &&
    existing.contact === candidate.contact &&
    existing.project === candidate.project &&
    existing.package === candidate.package &&
    existing.contactPerson === candidate.contactPerson &&
    existing.billable === candidate.billable
  );
}

/**
 * Reads the form, builds a template entry and saves it.
 *
 * The `id` is the SHA-256 of the entry's JSON **without** `id`. The key order of
 * the object literal below is load-bearing: it must match what readFormData
 * produced historically, so identical form values keep hashing to the same id.
 *
 * Duplicates are detected by **content**, not by comparing that hash against the
 * stored ids. Since `updateActiveTemplate` rewrites a template's fields while
 * keeping its id, a stored id can be the hash of content that no longer exists —
 * comparing hashes would then both miss real duplicates and reject saves that
 * collide with nothing.
 */
export async function createTemplateFromForm(templateName: string): Promise<CreateTemplateResult> {
  const values = await readCurrentFormValues();

  const entry = {
    work: values.work,
    status: values.status,
    contact: values.contact,
    project: values.project,
    package: values.package,
    billable: values.billable,
    contactPerson: values.contactPerson,
    templateName,
  } as TemplateEntry;

  entry.id = await generateHash(JSON.stringify(entry));

  const allEntries = await chromeStorageTemplateEntries.loadTemplates();
  if (allEntries.some((existing) => hasSameContent(existing, entry))) {
    return { ok: false, reason: "duplicate" };
  }

  // Ids must stay unique even though they are no longer checksums of the current
  // content: re-creating a template whose stored twin was later changed via ↻
  // hashes to that twin's now-stale id, and two entries sharing an id would break
  // every lookup (apply, update, delete). Salt until free — no-op in the normal case.
  for (let salt = 1; allEntries.some((existing) => existing.id === entry.id); salt += 1) {
    entry.id = await generateHash(JSON.stringify({ ...entry, salt }));
  }

  allEntries.push(entry);
  await chromeStorageTemplateEntries.saveTemplates(allEntries);
  return { ok: true, entry };
}
