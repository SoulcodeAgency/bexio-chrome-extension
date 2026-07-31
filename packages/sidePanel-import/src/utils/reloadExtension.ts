import { ReloadExtension } from "@bexio-chrome-extension/shared/types";
import { sendToBexioTab } from "./sendToBexioTab";

/**
 * Asks the content script to re-render its injected template list (after a template was edited or
 * deleted in the side panel).
 *
 * The storage write that triggers this has already succeeded by the time we get here, so a tab
 * without a content script is reported as a warning rather than an error.
 */
export const RELOAD_UNREACHABLE_MESSAGE =
  "The template list on the bexio page was not refreshed — reload that tab to see the change.";

async function reloadExtension(): Promise<boolean> {
  const data: ReloadExtension = {
    mode: "reload",
  };

  console.log("Sending reload:", data);
  const result = await sendToBexioTab(data, {
    unreachableMessage: RELOAD_UNREACHABLE_MESSAGE,
    unreachableLevel: "warning",
  });
  return result.ok;
}

export default reloadExtension;
