import { ReloadExtension } from "@bexio-chrome-extension/shared/types";

function reloadExtension() {
  (async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    if (tab.id) {
      const data: ReloadExtension = {
        mode: "reload",
      };

      console.log("Sending reload:", data);
      // const response =
      await chrome.tabs.sendMessage(tab.id, data);
      // do something with response here, not outside the function
      // console.log(response);
    } else {
      throw new Error("No tab found");
    }
  })();
}

export default reloadExtension;
