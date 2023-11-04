import { ExchangeRequestData } from "@bexio-chrome-extension/shared/types";
import fillForm from "../utils/fillForm";
import triggerDate from "../utils/triggerDate";
import triggerDescription from "../utils/triggerDescription";
import triggerDuration from "../utils/triggerDuration";
import {
    loadApplyNotesSetting
} from "@bexio-chrome-extension/shared/chromeStorageSettings";
import triggerCheckbox from "../utils/triggerCheckbox";
import { billableCheckbox } from "../selectors/billableCheckbox";

// Listen to messages from the side panel
chrome.runtime.onMessage.addListener(
    async function (request: ExchangeRequestData, sender, sendResponse) {
        console.log("Received message from side panel:", request);
        // if (request.greeting === "hello") {
        //     sendResponse({ farewell: "goodbye" });
        // }
        // Time + Duration + Description
        if (request.mode === "time+duration") {
            triggerDuration(request.duration);
            triggerDate(request.date);
            triggerCheckbox(billableCheckbox, request.billable);

            // Check if we should apply some notes
            await loadApplyNotesSetting().then((applyNotesSetting) => {
                if (applyNotesSetting && request.notes !== undefined) {
                    triggerDescription(request.notes);
                }
            });
        }
        // Template
        if (request.mode === "template") {
            fillForm(request.templateId, request.timeEntryBillable);
        }

    }
);