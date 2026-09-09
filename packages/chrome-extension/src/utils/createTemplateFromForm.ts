import { chromeStorageTemplateEntries } from "@bexio-chrome-extension/shared";
import { TemplateEntry } from "@bexio-chrome-extension/shared/types";
import generateHash from "./generateHash";
import { readCurrentFormValues } from "./readCurrentFormValues";

export type CreateTemplateResult = { ok: true; entry: TemplateEntry } | { ok: false; reason: "duplicate" };

/**
 * Reads the form, builds a template entry and saves it.
 *
 * The `id` is the SHA-256 of the entry's JSON **without** `id`. The key order of
 * the object literal below is load-bearing: it must match what readFormData
 * produced historically, so identical form values keep hashing to the same id
 * (that is how duplicates are detected across versions).
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
  if (allEntries.some((existing) => existing.id === entry.id)) {
    return { ok: false, reason: "duplicate" };
  }
  allEntries.push(entry);
  await chromeStorageTemplateEntries.saveTemplates(allEntries);
  return { ok: true, entry };
}
