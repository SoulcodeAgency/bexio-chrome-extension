import { chromeStorageSettings } from "@bexio-chrome-extension/shared";
import convertPopover from "../../utils/convertPopover";

// Renders all the html code for placing buttons to interact with
async function renderHtml() {
  const templates = document.getElementById("PopoverTextSwitcher");
  // Exit if the button is already present
  if (templates) {
    return;
  }

  let isRemovePopoversSettingEnabled = await chromeStorageSettings.loadRemovePopoversSetting();
  const getButtonContent = (isRemovePopoversSettingEnabled) =>
    isRemovePopoversSettingEnabled ? "👀 Show Popovers" : "👀 Show Text";
  const button = `<button type='button' id='PopoverTextSwitcher' class='btn btn-info' style='float: left; margin-right: 10px;'>${getButtonContent(
    isRemovePopoversSettingEnabled
  )}</button>`;

  const globalSearchListElement = document.getElementsByClassName("globalsearch")[0];

  // add a new child element for the the button before the global search
  const newNavElement = `<li class="nav-item pull-right" style="margin-top: 6px;">${button}</li>`;
  globalSearchListElement.insertAdjacentHTML("afterend", newNavElement);

  // Attach functionality to the buttons
  const showTextButton = document.getElementById("PopoverTextSwitcher");
  showTextButton &&
    showTextButton.addEventListener("click", async function (e) {
      e.preventDefault();
      // Switch the setting
      isRemovePopoversSettingEnabled = !isRemovePopoversSettingEnabled;

      // Apply changes according to the new setting value
      showTextButton.innerText = getButtonContent(isRemovePopoversSettingEnabled);
      await chromeStorageSettings.saveRemovePopoversSetting(isRemovePopoversSettingEnabled);
      convertPopover();
    });
}

export default renderHtml;
