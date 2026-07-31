import { deleteTemplate } from "@bexio-chrome-extension/shared/chromeStorageTemplateEntries";
import { initializeExtension } from "../apps/bexioTimetrackingTemplates/index";

async function confirmActiveTemplateDeletion(buttonId?: string) {
  console.log("confirm buttonID", buttonId);
  // Typed as `string | undefined` because both branches below genuinely assign
  // `undefined` when no button is found — which is what the `!== undefined` check
  // further down relies on. The initialisers stay `""` so runtime is unchanged.
  let activeTemplateId: string | undefined = "";
  let activeTemplateName: string | undefined = "";
  
  if (buttonId === undefined) {
    const activeButton = document.querySelector(".template-button--active") ?? undefined;
    activeTemplateName = activeButton?.textContent ?? undefined;
    activeTemplateId = activeButton?.id ?? undefined;
  } else {
    // Use the buttonId to find the active template, not the class
    const button = document.getElementById(buttonId);
    activeTemplateName = button?.textContent ?? undefined;
    activeTemplateId = button?.id ?? undefined;
  }

  if (activeTemplateId !== undefined) {
    if (confirm(`Are you sure you want to delete the active template "${activeTemplateName}"?`)) {
      deleteTemplate(activeTemplateId).then(() => initializeExtension());
    }
  } else {
    alert(
      "Sorry - There is no active template to delete or something went wrong! Please select first the template you want to delete. Thanks."
    );
  }
}

export default confirmActiveTemplateDeletion;
