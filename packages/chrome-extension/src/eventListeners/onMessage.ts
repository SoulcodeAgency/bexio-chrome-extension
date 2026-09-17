import { ExchangeRequestData, ExchangeResponse } from "@bexio-chrome-extension/shared/types";
import fillForm from "../utils/fillForm";
import triggerDate from "../utils/triggerDate";
import triggerDescription from "../utils/triggerDescription";
import triggerDuration from "../utils/triggerDuration";
import {
  loadApplyNotesSetting,
  loadUppercaseFirstLetterSetting,
} from "@bexio-chrome-extension/shared/chromeStorageSettings";
import capitalizeFirstLetter from "../utils/capitalizeFirstLetter";
import triggerCheckbox from "../utils/triggerCheckbox";
import { billableCheckbox } from "../selectors/billableCheckbox";
import { initializeExtension } from "../apps/bexioTimetrackingTemplates/index";
import { submitMonitoringForm } from "../utils/submitMonitoringForm";

/**
 * Dispatches one side-panel request. Resolves once the request is fully applied to the form —
 * the side panel offers its "submit" step on that acknowledgement, so it must not come earlier.
 *
 * `fillForm` **is** awaited. It used not to be, because its `waitFor*` helpers had no timeout;
 * since #83 every wait has a 20 s deadline, so the message channel can only stay open for a
 * bounded time. A fill that ends half-done (timeout, stale template id) resolves to `false`
 * and is answered with `{ ok: false }` — `fillForm` has already told the user via `alert()`.
 *
 * Every `trigger*` call **is** awaited (#124). They are all `async`, so a missing form field
 * surfaces as a rejected promise, not as a synchronous throw — unawaited, those rejections escaped
 * this function's promise chain and the listener below answered `{ ok: true }` for an entry that
 * was never applied. The three cheap field writes go through `Promise.all` rather than one `await`
 * each so that all three are still attempted when one of them fails, as they were before.
 */
export async function handleExchangeRequest(request: ExchangeRequestData): Promise<void> {
  // Time + Duration + Description
  if (request.mode === "time+duration") {
    await Promise.all([
      triggerDuration(request.duration),
      triggerDate(request.date),
      triggerCheckbox(billableCheckbox, request.billable),
    ]);

    // Check if we should apply some notes
    const applyNotesSetting = await loadApplyNotesSetting();
    if (applyNotesSetting && request.notes !== undefined) {
      // Both description settings are read here, right before the single write, so a
      // switch flipped in the side panel takes effect on the very next applied entry.
      const uppercaseFirstLetterSetting = await loadUppercaseFirstLetterSetting();
      await triggerDescription(uppercaseFirstLetterSetting ? capitalizeFirstLetter(request.notes) : request.notes);
    }
  }
  // Template
  if (request.mode === "template") {
    const applied = await fillForm(request.templateId, request.timeEntryBillable);
    if (!applied) {
      throw new Error("The template was not applied completely - check the bexio form.");
    }
  }
  // Submit — the user's second, deliberate click in the side panel
  if (request.mode === "submit") {
    submitMonitoringForm();
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
  sendResponse: (response: ExchangeResponse) => void,
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
    },
  );

  // Keep the message channel open for the asynchronous sendResponse above.
  return true;
});
