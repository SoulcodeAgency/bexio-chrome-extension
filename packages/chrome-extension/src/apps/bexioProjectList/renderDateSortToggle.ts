import { chromeStorageSettings } from "@bexio-chrome-extension/shared";
import { autoSortByDate } from "../../utils/dateSort";
import { getPrimaryActionBlock } from "../../selectors/pageTitleBar";

/**
 * Renders the "Newest first" toggle into bexio's page title bar, left of the page's primary action
 * button. Pressed (`aria-pressed="true"`) reflects `autoDateSortSetting`; a click flips and stores
 * it, and switching it on sorts the page's time entries right away. One setting for all four pages
 * of this content script. Styled by `public/bexioProjectList.css`.
 */
async function renderDateSortToggle() {
  if (document.getElementById("AutoDateSortToggle")) {
    return;
  }

  // A missing title bar is already reported by renderHtml().
  const primaryActionBlock = getPrimaryActionBlock();
  if (!primaryActionBlock) {
    return;
  }

  const button = document.createElement("button");
  button.id = "AutoDateSortToggle";
  button.type = "button";
  button.className = "btn";
  button.title = "Sort time entries by date, newest first, whenever bexio shows them unsorted";
  button.setAttribute("aria-pressed", "false");
  const iconElement = document.createElement("i");
  iconElement.className = "halflings halflings-sort-by-attributes-alt";
  button.append(iconElement, " Newest first");

  // Same wrapper bexio uses for the blocks of its title bar, so the toggle lines up with them.
  const block = document.createElement("div");
  block.className = "bx-flex-block bx-shrink bx-flex-align-middle-left";
  block.appendChild(button);
  // Inserted before the first await, so a second call cannot pass the guard above in the meantime.
  primaryActionBlock.insertAdjacentElement("beforebegin", block);

  button.setAttribute("aria-pressed", String(await chromeStorageSettings.loadAutoDateSortSetting()));

  // Attached after the stored state is shown, so a click always flips what the user sees.
  button.addEventListener("click", async () => {
    const isEnabled = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(isEnabled));
    await chromeStorageSettings.saveAutoDateSortSetting(isEnabled);
    autoSortByDate();
  });
}

export default renderDateSortToggle;
