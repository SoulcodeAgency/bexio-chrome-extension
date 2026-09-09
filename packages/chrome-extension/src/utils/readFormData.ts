import { chromeStorageTemplateEntries } from "@bexio-chrome-extension/shared";
import { initializeExtension } from "../apps/bexioTimetrackingTemplates/index";
import generateHash from "./generateHash";
import { readCurrentFormValues, suggestTemplateName } from "./readCurrentFormValues";
import { TemplateEntry } from "@bexio-chrome-extension/shared/types";

// Read form data
async function readFormData() {
  const values = await readCurrentFormValues();
  const templateName = suggestTemplateName(values);

  let formEntry: TemplateEntry;

  let allEntries: TemplateEntry[] | undefined = undefined;
  let notReadyToSave = true;
  do {
    // Note: make sure a generated id is not part of the base entry to create the hash
    // The cast is deliberate and must stay a cast rather than becoming real fields:
    //   - `id` must NOT exist yet, because the hash below is computed over this object
    //     (see the note above); adding it would change every generated template id.
    //   - `keywords` is intentionally absent: it is a side-panel-only override with no
    //     counterpart in the bexio form, so there is nothing here to read it from.
    //     Templates start without it and gain it when edited in the side panel.
    //     TemplateEntry declares it required, which is part of why this cast is needed;
    //     AutoMapTemplatesV3 reads it defensively (`entry.keywords ? … : …`).
    formEntry = {
      work: values.work,
      status: values.status,
      contact: values.contact,
      project: values.project,
      package: values.package,
      billable: values.billable,
      contactPerson: values.contactPerson,
      templateName,
    } as TemplateEntry;

    // Ask user for a template Name, prefilled with the suggested one
    let userInput = prompt("Name of the template:", templateName);
    if (userInput !== null) {
      formEntry.templateName = userInput;
    } else {
      alert("Please enter a name for the template");
      return;
    }

    // Create the entry and a hash for saving it
    const jsonString = JSON.stringify(formEntry);
    const hash = await generateHash(jsonString);
    formEntry.id = hash;

    // Load all templateEntries (refresh)
    allEntries = await chromeStorageTemplateEntries.loadTemplates();

    // Check if the hash already exists
    const existingEntry = allEntries.find((entry) => entry.id === hash);
    if (existingEntry !== undefined) {
      if (confirm(`This entry already exists, or there was a hash conflict, Try again?`)) {
        // yes
      } else {
        // no
        return;
      }
    } else {
      notReadyToSave = false;
    }
  } while (notReadyToSave);

  if (allEntries === undefined) throw new Error("No template entries found");

  // Push the new entry to the array and save it
  allEntries.push(formEntry);
  console.log("formEntry", formEntry);
  chromeStorageTemplateEntries.saveTemplates(allEntries).then(() => initializeExtension());
}

export default readFormData;
