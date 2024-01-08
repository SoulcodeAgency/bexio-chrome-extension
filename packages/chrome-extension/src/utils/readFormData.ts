import { chromeStorageTemplateEntries } from "@bexio-chrome-extension/shared";
import { initializeExtension } from "../apps/bexioTimetrackingTemplates/index";
import { billableCheckbox } from "../selectors/billableCheckbox";
import { contactField } from "../selectors/contactField";
import {
  workField,
  statusField,
  contactPersonField,
  projectField,
  packageField,
} from "../selectors/selectors";
import generateHash from "./generateHash";
import readTextFromSelect2 from "./readTextFromSelect2";
import trimAll from "./trimAll";
import { TemplateEntry } from "@bexio-chrome-extension/shared/types";

// Read form data
async function readFormData() {
  // TODO: Probably extract the form data reading into a own helper function.
  const work = await readTextFromSelect2(workField);
  const status = await readTextFromSelect2(statusField);

  // Contact is a bit special, it will show a string which is not directly searchable, thats why we limit it
  let contact = contactField.value;
  let words = contact.split(" ");
  contact = words.slice(0, 2).join(" ");

  const contactPerson = await readTextFromSelect2(contactPersonField);
  const project = await readTextFromSelect2(projectField);

  const packageValue = await readTextFromSelect2(packageField);
  const billable = billableCheckbox.checked;

  const templateName =
    trimAll(packageValue) ||
    trimAll(project) ||
    trimAll(contact) ||
    trimAll(workField) ||
    "New Template";

  let formEntry;

  let allEntries: TemplateEntry[] | undefined = undefined;
  let notReadyToSave = true;
  do {
    // Note: make sure a generated id is not part of the base entry to create the hash
    // TODO: this line is probably fine outside of the do loop as well
    formEntry = {
      work,
      status,
      contact,
      project,
      package: packageValue,
      billable,
      contactPerson,
      templateName,
    };

    // Ask user for a template Name, prefilled with the suggested one
    let userInput = prompt("Name of the template:", templateName);
    if (userInput !== null) {
      formEntry.templateName = userInput;
    } else {
      alert("Please enter a name for the template");
      return;
    }

    // TODO: extract hash logic into helper function
    // Create the entry and a hash for saving it
    const jsonString = JSON.stringify(formEntry);
    const hash = await generateHash(jsonString);
    formEntry.id = hash;

    // Load all templateEntries (refresh)
    allEntries = await chromeStorageTemplateEntries.loadTemplates();

    // Check if the hash already exists
    const existingEntry = allEntries.find((entry) => entry.id === hash);
    if (existingEntry !== undefined) {
      if (
        confirm(
          `This entry already exists, or there was a hash conflict, Try again?`
        )
      ) {
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
  // TODO: verify if this is correct, or would break an empty entries list (basically a new user)

  // Push the new entry to the array and save it
  allEntries.push(formEntry);
  console.log("formEntry", formEntry);
  chromeStorageTemplateEntries
    .saveTemplates(allEntries)
    .then(() => initializeExtension());
}

export default readFormData;
