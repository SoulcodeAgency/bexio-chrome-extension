import { createTemplateFromForm } from "../../utils/createTemplateFromForm";
import { readCurrentFormValues, suggestTemplateName } from "../../utils/readCurrentFormValues";
import { initializeExtension } from "./index";

/** Inline replacement for the old prompt()-based add flow. */
export function setupInlineAddForm(panel: HTMLElement): void {
  const addButton = panel.querySelector<HTMLButtonElement>("#AddNewTemplate");
  const form = panel.querySelector<HTMLElement>("#SoulcodeExtensionAddForm");
  const input = panel.querySelector<HTMLInputElement>("#templateNameInput");
  const saveButton = panel.querySelector<HTMLButtonElement>("#templateNameSave");
  const cancelButton = panel.querySelector<HTMLButtonElement>("#templateNameCancel");
  const error = panel.querySelector<HTMLElement>("#templateNameError");
  if (!addButton || !form || !input || !saveButton || !cancelButton || !error) return;

  const close = () => {
    form.hidden = true;
    error.hidden = true;
  };

  const showError = (message: string) => {
    error.textContent = message;
    error.hidden = false;
  };

  const submit = async () => {
    const name = input.value.trim();
    if (!name) {
      showError("Please enter a name for the template.");
      return;
    }
    let result;
    try {
      result = await createTemplateFromForm(name);
    } catch {
      showError("Could not save the template — storage error.");
      return;
    }
    if (!result.ok) {
      showError("A template with identical values already exists.");
      return;
    }
    close();
    await initializeExtension(); // re-renders the panel with the new template
  };

  addButton.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!form.hidden) {
      close();
      return;
    }
    input.value = suggestTemplateName(await readCurrentFormValues());
    error.hidden = true;
    form.hidden = false;
    input.select();
    input.focus();
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
      void submit();
    }
    if (e.key === "Escape") close();
  });
}
