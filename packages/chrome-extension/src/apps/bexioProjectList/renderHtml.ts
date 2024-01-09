import convertPopoverToText from "../../utils/convertPopoverToText";

// Renders all the html code for placing buttons to interact with
async function renderHtml() {
  // Remove the templates HTML, if it already exists
  const templates = document.getElementById("ProjectListShowText");
  if (templates) {
    templates.remove();
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
      convertPopoverToText();
    });
}

export default renderHtml;
