import { TemplateExchangeData } from "@bexio-chrome-extension/shared/types";

function applyTemplate(templateId: string, timeEntryBillable?: boolean) {
    (async () => {
        const [tab] = await chrome.tabs.query({
            active: true,
            lastFocusedWindow: true,
        });
        if (tab.id) {
            const data: TemplateExchangeData = {
                mode: "template",
                templateId,
                timeEntryBillable
            };

            console.log("Sending template data:", data);
            // const response = 
            await chrome.tabs.sendMessage(tab.id, data);
            // do something with response here, not outside the function
            // console.log(response);
        } else {
            throw new Error("No tab found");
        }
    })();
}

export default applyTemplate;