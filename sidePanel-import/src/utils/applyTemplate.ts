function applyTemplate(templateId: string) {
    (async () => {
        const [tab] = await chrome.tabs.query({
            active: true,
            lastFocusedWindow: true,
        });
        if (tab.id) {
            const response = await chrome.tabs.sendMessage(tab.id, {
                mode: "template",
                templateId: templateId,
            });
            // do something with response here, not outside the function
            console.log(response);
        } else {
            throw new Error("No tab found");
        }
    })();
}

export default applyTemplate;