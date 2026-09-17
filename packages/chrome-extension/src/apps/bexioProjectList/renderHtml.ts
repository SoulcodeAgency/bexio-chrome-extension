import { chromeStorageSettings } from "@bexio-chrome-extension/shared";
import convertPopover from "../../utils/convertPopover";
import { getPrimaryActionBlock } from "../../selectors/pageTitleBar";

type NotesDisplayMode = "text" | "tooltip";

const OPTIONS: { mode: NotesDisplayMode; label: string; icon: string; title: string }[] = [
  { mode: "text", label: "Text", icon: "halflings-align-left", title: "Show notes as text" },
  { mode: "tooltip", label: "Tooltip", icon: "halflings-info-sign", title: "Show notes as tooltip icons" },
];

/**
 * Renders the "Text | Tooltip" toggle into bexio's page title bar, left of the page's primary
 * action button. The active option (`aria-pressed="true"`) reflects `removePopoversSetting`;
 * clicking the other option stores the new value and converts or reverts the tooltip icons.
 * Styled by `public/bexioProjectList.css`.
 */
async function renderHtml() {
  // Exit if the toggle is already present
  if (document.getElementById("PopoverTextSwitcher")) {
    return;
  }

  const primaryActionBlock = getPrimaryActionBlock();
  if (!primaryActionBlock) {
    console.warn("[bexio extension] Page title bar not found, the Text | Tooltip toggle is not shown");
    return;
  }

  const group = document.createElement("div");
  group.id = "PopoverTextSwitcher";
  group.className = "btn-group";
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", "Show notes as");
  const buttons = OPTIONS.map(({ mode, label, icon, title }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn";
    button.dataset.mode = mode;
    button.title = title;
    const iconElement = document.createElement("i");
    iconElement.className = `halflings ${icon}`;
    button.append(iconElement, ` ${label}`);
    return button;
  });
  group.append(...buttons);

  // Same wrapper bexio uses for the blocks of its title bar, so the toggle lines up with them.
  const block = document.createElement("div");
  block.className = "bx-flex-block bx-shrink bx-flex-align-middle-left";
  block.appendChild(group);
  // Inserted before the first await, so a second call cannot pass the guard above in the meantime.
  primaryActionBlock.insertAdjacentElement("beforebegin", block);

  const showActiveMode = (isTextMode: boolean) => {
    for (const button of buttons) {
      button.setAttribute("aria-pressed", String((button.dataset.mode === "text") === isTextMode));
    }
  };

  group.addEventListener("click", async (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-mode]");
    if (!button || button.getAttribute("aria-pressed") === "true") {
      return;
    }
    const isTextMode = button.dataset.mode === "text";
    showActiveMode(isTextMode);
    await chromeStorageSettings.saveRemovePopoversSetting(isTextMode);
    convertPopover();
  });

  showActiveMode(await chromeStorageSettings.loadRemovePopoversSetting());
}

export default renderHtml;
