import { createTemplateFromForm } from "../../utils/createTemplateFromForm";
import { readCurrentFormValues, suggestTemplateName } from "../../utils/readCurrentFormValues";
import { PanelElements } from "./panelElements";
import { initializeExtension } from "./index";

/** Inline replacement for the old prompt()-based add flow. */
export function setupInlineAddForm(elements: PanelElements): void {
  const { addButton, addForm: form, nameInput: input, nameSave: saveButton, nameCancel: cancelButton } = elements;
  const error = elements.nameError;

  // prompt() was modal, so the old flow could not be re-entered. This one can:
  // Save-click plus Enter (or a double-click) would otherwise run two saves, and
  // the loser writes its error into a form the winner has already re-rendered away.
  let submitting = false;

  const close = () => {
    form.hidden = true;
    error.hidden = true;
  };

  const showError = (message: string) => {
    error.textContent = message;
    error.hidden = false;
  };

  const submit = async () => {
    if (submitting) return;
    const name = input.value.trim();
    if (!name) {
      showError("Please enter a name for the template.");
      return;
    }

    submitting = true;
    saveButton.disabled = true;
    try {
      const result = await createTemplateFromForm(name);
      if (!result.ok) {
        // Naming the way out matters: the old confirm() at least looped back to
        // the prompt. The collision is on name *and* values, so a different name
        // saves fine.
        showError("A template with this name and these values already exists — pick a different name.");
        return;
      }
      close();
      await initializeExtension(); // re-renders the panel with the new template
    } catch {
      showError("Could not save the template — please try again.");
    } finally {
      submitting = false;
      saveButton.disabled = false;
    }
  };

  addButton.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!form.hidden) {
      close();
      return;
    }

    // Open first, then suggest a name. Reading the bexio form can throw when a
    // select2 widget is not where `readTextFromSelect2` expects it, and doing it
    // before the form is shown would make "+ Add" a button that does nothing at
    // all — no form, no message.
    error.hidden = true;
    form.hidden = false;
    input.focus();
    try {
      input.value = suggestTemplateName(await readCurrentFormValues());
      input.select();
    } catch {
      input.value = "";
      showError("Could not read the form — type a name yourself.");
    }
  });

  cancelButton.addEventListener("click", (e) => {
    e.preventDefault();
    close();
  });
  saveButton.addEventListener("click", (e) => {
    e.preventDefault();
    void submit();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation(); // never let it reach bexio's form submit
      void submit();
    }
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  });
}
