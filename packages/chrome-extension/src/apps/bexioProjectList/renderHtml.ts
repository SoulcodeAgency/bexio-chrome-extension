import {
  loadRemovePopoversSetting,
  saveRemovePopoversSetting,
} from "@bexio-chrome-extension/shared/chromeStorageSettings";
import convertPopoverToText from "../../utils/convertPopoverToText";

// Renders all the html code for placing buttons to interact with
async function renderHtml() {
  const isRemovePopoversSettingEnabled = await loadRemovePopoversSetting();
  const templates = document.getElementById("ProjectListShowText");

  // Exit if the button is already present
  if (templates) {
    return;
  }
  const button =
    "<button type='button' id='ProjectListShowTextButton' class='btn btn-info' style='float: left; margin-right: 10px;'>👀 Show Text</button>";
  const templatePlacement = document.getElementsByClassName(
    "filterQuickSearch"
  )[0] as HTMLElement;

  // Place the html into the DOM
  templatePlacement.innerHTML = button + templatePlacement.innerHTML;

  // Attach functionality to the buttons
  const showTextButton = document.getElementById("ProjectListShowTextButton");
  showTextButton &&
    showTextButton.addEventListener("click", function (e) {
      e.preventDefault();
      saveRemovePopoversSetting(!isRemovePopoversSettingEnabled);
      convertPopoverToText();
    });
}

export default renderHtml;
