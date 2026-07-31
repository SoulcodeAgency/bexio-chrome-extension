import {
  ExchangeRequestData,
  ExchangeResponse,
} from "@bexio-chrome-extension/shared/types";
import fillForm from "../utils/fillForm";
import triggerDate from "../utils/triggerDate";
import triggerDescription from "../utils/triggerDescription";
import triggerDuration from "../utils/triggerDuration";
import { loadApplyNotesSetting } from "@bexio-chrome-extension/shared/chromeStorageSettings";
import triggerCheckbox from "../utils/triggerCheckbox";
import { billableCheckbox } from "../selectors/billableCheckbox";
import { initializeExtension } from "../apps/bexioTimetrackingTemplates/index";

/**
 * Dispatches one side-panel request. Resolves once the request has been handed to its handler.
 *
 * `fillForm` is deliberately **not** awaited: its `waitFor*` helpers poll without a timeout, so
 * awaiting it could keep the message channel open forever and leave the side panel hanging with
 * no feedback. Every other branch is cheap and is awaited.
 */
export async function handleExchangeRequest(
  request: ExchangeRequestData
): Promise<void> {
  // Time + Duration + Description
  if (request.mode === "time+duration") {
    triggerDuration(request.duration);
    triggerDate(request.date);
    triggerCheckbox(billableCheckbox, request.billable);

    // Check if we should apply some notes
    const applyNotesSetting = await loadApplyNotesSetting();
    if (applyNotesSetting && request.notes !== undefined) {
      triggerDescription(request.notes);
    }
  }
  // Template
  if (request.mode === "template") {
    // Not awaited on purpose — see the doc comment above.
    fillForm(request.templateId, request.timeEntryBillable);
  }
  // Re-init the extension
  if (request.mode === "reload") {
    initializeExtension();
  }
}

// Listen to messages from the side panel.
// The listener itself is synchronous and returns `true` so the message channel stays open until
// `sendResponse` is called — an async listener would make the response semantics depend on the
// Chrome version. Every path answers, so the side panel can tell "applied" from "nothing happened".
chrome.runtime.onMessage.addListener(function (
  request: ExchangeRequestData,
  _sender,
  sendResponse: (response: ExchangeResponse) => void
) {
  console.log("Received message from side panel:", request);

  handleExchangeRequest(request).then(
    () => sendResponse({ ok: true }),
    (error: unknown) => {
      console.error("Failed to handle message from side panel:", error);
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  );

  // Keep the message channel open for the asynchronous sendResponse above.
  return true;
});
