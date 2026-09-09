import { initializeExtension } from "../apps/bexioTimetrackingTemplates/index";
import { createTemplateFromForm } from "./createTemplateFromForm";
import { readCurrentFormValues, suggestTemplateName } from "./readCurrentFormValues";

// Read form data and save it as a template, asking the user for a name via prompt()
async function readFormData() {
  const values = await readCurrentFormValues();
  const templateName = suggestTemplateName(values);

  let saved = false;
  do {
    // Ask user for a template Name, prefilled with the suggested one
    const userInput = prompt("Name of the template:", templateName);
    if (userInput === null) {
      alert("Please enter a name for the template");
      return;
    }
    const result = await createTemplateFromForm(userInput);
    if (result.ok) {
      saved = true;
    } else if (!confirm(`This entry already exists, or there was a hash conflict, Try again?`)) {
      return;
    }
  } while (!saved);
  initializeExtension();
}

export default readFormData;
