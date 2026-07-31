import { TemplateExchangeData } from "@bexio-chrome-extension/shared/types";
import { sendToBexioTab } from "./sendToBexioTab";

/**
 * Sends a template to the bexio time-tracking form in the active tab.
 *
 * Resolves to `true` when the content script acknowledged the message, `false` when it could not
 * be reached — in which case the user has already been told why (see `sendToBexioTab`).
 */
async function applyTemplate(templateId: string, timeEntryBillable?: boolean): Promise<boolean> {
  const data: TemplateExchangeData = {
    mode: "template",
    templateId,
    timeEntryBillable,
  };

  console.log("Sending template data:", data);
  const result = await sendToBexioTab(data);
  if (!result.ok) {
    return false;
  }

  try {
    // Bring the bexio tab back to the front so the user sees the filled form.
    await chrome.tabs.update(result.tabId, { active: true });
  } catch (error) {
    // The template was applied; failing to re-focus the tab is not worth a toast.
    console.warn("Could not focus the bexio tab:", error);
  }
  return true;
}

export default applyTemplate;
