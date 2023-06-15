// Clicking extension icon will open the browser on the bexio time tracking page
chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({ url: "https://office.bexio.com/index.php/monitoring/edit" });
});