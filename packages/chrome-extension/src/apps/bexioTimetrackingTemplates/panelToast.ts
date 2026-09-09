const DEFAULT_DURATION_MS = 5000;

/**
 * The toast currently on screen, held as an element reference rather than looked
 * up by id.
 *
 * Two reasons, both real failures rather than style:
 *   - A `document.getElementById("SoulcodeExtensionToast")` resolves to a
 *     *template chip* when a pre-v0.5.x entry carries that free-form name as its
 *     id (chips come first in document order), so hiding a toast would delete a
 *     healthy chip's button. See `panelElements.ts`.
 *   - A timer armed by an earlier toast must only ever remove *its own* node. By
 *     id it would reach across a re-render — or, in the test suite, across files
 *     — and delete whatever toast is on screen when it fires.
 */
let toast: HTMLElement | undefined;
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

  // The caller's `panel` is captured per render, so a promise that settles after a
  // re-render (a side-panel "reload", an add, an undo) holds the detached one and
  // its message would never be seen. Fall back to the live panel in that case.
  const target = panel.isConnected ? panel : document.getElementById("SoulcodeExtensionTemplates");
  if (!target) return;

  const element = document.createElement("div");
  element.id = "SoulcodeExtensionToast";
  // The native alert()/confirm() this replaced were announced by screen readers;
  // without a live region the toast — including its Undo — is silent.
  element.setAttribute("role", "status");
  element.setAttribute("aria-live", "polite");

  const text = document.createElement("span");
  text.textContent = options.text;
  element.appendChild(text);

  if (options.actionLabel && options.onAction) {
    const action = document.createElement("button");
    action.type = "button";
    action.textContent = options.actionLabel;
    action.addEventListener("click", () => {
      hidePanelToast();
      options.onAction!();
    });
    element.appendChild(action);
  }

  target.appendChild(element);
  toast = element;
  hideTimer = window.setTimeout(hidePanelToast, options.durationMs ?? DEFAULT_DURATION_MS);
}

export function hidePanelToast(): void {
  window.clearTimeout(hideTimer);
  toast?.remove();
  toast = undefined;
}
