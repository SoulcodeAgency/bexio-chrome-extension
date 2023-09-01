import fillForm from "../utils/fillForm";
import triggerDate from "../utils/triggerDate";
import triggerDescription from "../utils/triggerDescription";
import triggerDuration from "../utils/triggerDuration";

// Listen to messages from the side panel
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        // if (request.greeting === "hello") {
        //     sendResponse({ farewell: "goodbye" });
        // }
        // Time + Duration + Description
        if (request.mode === "time+duration") {
            triggerDuration(request.duration);
            triggerDate(request.date);
            if (request.notes !== undefined) {
                triggerDescription(request.notes);
            }
        }
        // Template
        if (request.mode === "template") {
            fillForm(request.templateId);
        }
    }
);