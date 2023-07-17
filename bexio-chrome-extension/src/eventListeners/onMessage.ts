import fillForm from "../utils/fillForm";
import triggerDate from "../utils/triggerDate";
import triggerDuration from "../utils/triggerDuration";

// Listen to messages from the side panel
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        // Example
        if (request.greeting === "hello") {
            sendResponse({ farewell: "goodbye" });
        }
        // Time + Duration
        if (request.mode === "time+duration") {
            triggerDuration(request.duration);
            triggerDate(request.date);
        }
        // Template
        if (request.mode === "template") {
            fillForm(request.templateId);
        }
    }
);