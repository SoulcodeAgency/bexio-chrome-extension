import getTemplateName from "@bexio-chrome-extension/shared/getTemplateName";
import { TemplateEntry } from "@bexio-chrome-extension/shared/types";

const SHOW_DELAY_MS = 350;
const TOOLTIP_WIDTH_PX = 250;

let tooltip: HTMLDivElement | null = null;
let showTimer: number | undefined;

function ensureTooltip(panel: HTMLElement): HTMLDivElement {
  if (tooltip && tooltip.isConnected) return tooltip;
  tooltip = document.createElement("div");
  tooltip.id = "SoulcodeTemplateTooltip";
  tooltip.hidden = true;
  panel.appendChild(tooltip);
  return tooltip;
}

export function hideTemplateTooltip(): void {
  window.clearTimeout(showTimer);
  if (tooltip) tooltip.hidden = true;
}

/** Attaches the delayed field-preview tooltip to one chip's apply button. */
export function attachTemplateTooltip(chipButton: HTMLButtonElement, entry: TemplateEntry, panel: HTMLElement): void {
  chipButton.addEventListener("mouseenter", () => {
    if (panel.classList.contains("manage-mode")) return;
    window.clearTimeout(showTimer);
    showTimer = window.setTimeout(() => showTooltip(chipButton, entry, panel), SHOW_DELAY_MS);
  });
  chipButton.addEventListener("mouseleave", hideTemplateTooltip);
}

function showTooltip(chipButton: HTMLButtonElement, entry: TemplateEntry, panel: HTMLElement): void {
  const el = ensureTooltip(panel);
  el.innerHTML = ""; // clearing only — template values go in via textContent below

  const name = document.createElement("div");
  name.className = "tooltip-name";
  name.textContent = getTemplateName(entry);
  el.appendChild(name);

  const dl = document.createElement("dl");
  const rows: Array<[string, string]> = [
    ["Tätigkeit", entry.work],
    ["Projekt", entry.project],
    ["Arbeitspaket", entry.package],
    ["Kontakt", entry.contact],
    ["Status", entry.status],
    ["Abrechenbar", entry.billable ? "Ja" : "Nein"],
  ];
  for (const [label, value] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value ?? "";
    dl.append(dt, dd);
  }
  el.appendChild(dl);

  // Position below the chip, clamped inside the panel (rects are 0 in jsdom — harmless).
  const chipRect = chipButton.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const left = Math.max(0, Math.min(chipRect.left - panelRect.left, panelRect.width - TOOLTIP_WIDTH_PX));
  el.style.left = `${left}px`;
  el.style.top = `${chipRect.bottom - panelRect.top + 6}px`;
  el.hidden = false;
}
