const DEFAULT_DURATION_MS = 5000;

let hideTimer: number | undefined;

export type PanelToastOptions = {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
};

/** Shows the panel's single toast (replacing any current one). Text only — never HTML. */
export function showPanelToast(panel: HTMLElement, options: PanelToastOptions): void {
  hidePanelToast();

  const toast = document.createElement("div");
  toast.id = "SoulcodeExtensionToast";

  const text = document.createElement("span");
  text.textContent = options.text;
  toast.appendChild(text);

  if (options.actionLabel && options.onAction) {
    const action = document.createElement("button");
    action.type = "button";
    action.textContent = options.actionLabel;
    action.addEventListener("click", () => {
      hidePanelToast();
      options.onAction!();
    });
    toast.appendChild(action);
  }

  panel.appendChild(toast);
  hideTimer = window.setTimeout(hidePanelToast, options.durationMs ?? DEFAULT_DURATION_MS);
}

export function hidePanelToast(): void {
  window.clearTimeout(hideTimer);
  document.getElementById("SoulcodeExtensionToast")?.remove();
}
