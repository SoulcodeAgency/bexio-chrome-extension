import { chromeStorageTemplateEntries } from "@bexio-chrome-extension/shared";
import { readCurrentFormValues } from "./readCurrentFormValues";

/**
 * Overwrites the stored template's form fields with the current form values.
 * Keeps `id`, `templateName` and `keywords`: the id is an identifier (the side
 * panel references it via TemplateExchangeData.templateId), not a content
 * checksum — it is only ever hashed at creation time.
 *
 * Guarded against the update() unknown-id quirk (see chromeStorage.ts): if the
 * id is not in storage, nothing is written and `false` is returned.
 */
export async function updateActiveTemplate(templateId: string): Promise<boolean> {
  const entries = await chromeStorageTemplateEntries.loadTemplates();
  const existing = entries.find((entry) => entry.id === templateId);
  if (!existing) return false;

  const values = await readCurrentFormValues();
  await chromeStorageTemplateEntries.updateTemplate({ ...existing, ...values });
  return true;
}
