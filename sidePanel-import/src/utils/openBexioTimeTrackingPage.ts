export const BEXIO_MONITORING_TIMETRACKING =
    "https://office.bexio.com/index.php/monitoring/edit";

async function openBexioTimeTrackingPage() {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({
            active: true,
            lastFocusedWindow: true,
        }).then(async ([tab]) => {
            if (tab.url === BEXIO_MONITORING_TIMETRACKING) {
                console.log("already on timetracking page")
                resolve(true);
            } else if (tab.id) {
                console.log("not on timetracking page, trying to open it...")
                // Attach an event listener first, so we can wait for the page to load
                const onUpdate = async (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
                    if (tabId === tab.id) {
                        if (tab.url === BEXIO_MONITORING_TIMETRACKING && changeInfo.status === "complete") {
                            console.log("Tab has loaded completely");
                            // Wait a little bit, so the rendering can be finished. (Not sure how easy we could track this, maybe with a message and an other listener here)
                            await new Promise(resolve => setTimeout(resolve, 500));
                            // Remove event listener again
                            chrome.tabs.onUpdated.removeListener(onUpdate);
                            resolve(true);
                        }
                    }
                };
                chrome.tabs.onUpdated.addListener(onUpdate);
                // Open the page
                await chrome.tabs.update(tab.id, { url: BEXIO_MONITORING_TIMETRACKING });
            } else {
                reject("No tab found");
                throw new Error("No tab found");
            }
        });
    });
}

export default openBexioTimeTrackingPage;