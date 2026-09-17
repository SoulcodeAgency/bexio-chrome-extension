import { billableCheckbox } from "../selectors/billableCheckbox";
import { contactField } from "../selectors/contactField";
import { workField, statusField, contactPersonField, projectField, packageField } from "../selectors/selectors";
import readTextFromSelect2 from "./readTextFromSelect2";
import trimAll from "./trimAll";

export type TemplateFormValues = {
  work: string;
  status: string;
  contact: string;
  contactPerson: string;
  project: string;
  package: string;
  billable: boolean;
};

/**
 * Reads the current values of the bexio monitoring/edit form.
 *
 * Same module-load quirk as `src/selectors/*`: the field elements are captured
 * at import time, so tests must load the fixture before importing this module.
 */
export async function readCurrentFormValues(): Promise<TemplateFormValues> {
  const work = await readTextFromSelect2(workField);
  const status = await readTextFromSelect2(statusField);

  // The contact input shows a display string that is not directly searchable —
  // keep only the first two words (same rule readFormData always applied).
  const contact = contactField.value.split(" ").slice(0, 2).join(" ");

  const contactPerson = await readTextFromSelect2(contactPersonField);
  const project = await readTextFromSelect2(projectField);
  const packageValue = await readTextFromSelect2(packageField);
  const billable = billableCheckbox.checked;

  return { work, status, contact, contactPerson, project, package: packageValue, billable };
}

/** Suggested display name: package → project → contact → work → "New Template", whitespace stripped. */
export function suggestTemplateName(values: TemplateFormValues): string {
  return (
    trimAll(values.package) ||
    trimAll(values.project) ||
    trimAll(values.contact) ||
    trimAll(values.work) ||
    "New Template"
  );
}
