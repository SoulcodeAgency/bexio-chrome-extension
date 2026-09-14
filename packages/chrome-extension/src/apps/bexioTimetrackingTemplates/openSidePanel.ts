import { OpenSidePanelRequest } from "@bexio-chrome-extension/shared/types";
import { PanelElements } from "./panelElements";
import { showPanelToast } from "./panelToast";

/**
 * The "open side panel" button. A content script cannot call `chrome.sidePanel`
 * itself, so the click is relayed to the service worker, which opens the panel for
 * this tab (see `public/service_worker.js`). Chrome only allows that in response to
 * a user gesture — the click here is one, and it survives `runtime.sendMessage`.
 */
export function setupOpenSidePanelButton({ panel, openSidePanelButton }: PanelElements): void {
  openSidePanelButton.addEventListener("click", (e) => {
    e.preventDefault();
    const request: OpenSidePanelRequest = { mode: "openSidePanel" };
    chrome.runtime.sendMessage(request).catch((error: unknown) => {
      console.error("Could not open the side panel:", error);
      showPanelToast(panel, { text: "Could not open the side panel — use the extension icon in the toolbar." });
    });
  });
}
