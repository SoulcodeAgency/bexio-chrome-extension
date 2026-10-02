/**
 * A stand-in for the Angular behaviour of bexio's time entry dialog (#168), wired onto the
 * `time-tracking-modal.synthetic` fixture. The fixture is static markup; this adds what Angular
 * Material would do, as far as the extension depends on it:
 *
 * - a click on a `mat-select`'s trigger opens a panel in `.cdk-overlay-container` (id from
 *   `aria-controls`, **reused** on every opening; closed panels stay in the DOM, like bexio's),
 *   with an ngx-mat-select-search input (plus its hidden twin) that filters client-side;
 * - a click on a `mat-option` shows its text as the select's value and closes the panel;
 *   Escape closes it without a selection;
 * - Kontakt enables Projekt, Projekt enables Arbeitspaket (after `enableDelayMs`);
 * - optional `loadDelayMs` per field: the panel's options appear that long after it opened;
 * - optional `serverSearch` per field: the panel lists only the first option until something is
 *   typed into the search, like a list that is searched server-side.
 *
 * Every select interaction is appended to `log` (`open:<key>`, `select:<key>:<text>`).
 */
import type { ModalSelectKey } from "../../src/selectors/timeEntryModal";

export type FakeMatSelectOptions = {
  options: Partial<Record<ModalSelectKey, string[]>>;
  loadDelayMs?: Partial<Record<ModalSelectKey, number>>;
  serverSearch?: ModalSelectKey[];
  enableDelayMs?: number;
};

const DEPENDENTS: Partial<Record<ModalSelectKey, ModalSelectKey>> = {
  contact: "project",
  project: "work-package",
};

export function installFakeMatSelects(config: FakeMatSelectOptions): { log: string[] } {
  const log: string[] = [];
  const overlay = document.querySelector<HTMLElement>(".cdk-overlay-container")!;
  let panelCounter = 0;

  const selects = Array.from(document.querySelectorAll<HTMLElement>("mat-select[data-for-test]"));
  for (const select of selects) {
    const key = select.getAttribute("data-for-test")!.replace("time-entry-editor-", "") as ModalSelectKey;
    const panelId = `mat-select-${panelCounter++}-panel`;

    const close = () => {
      select.setAttribute("aria-expanded", "false");
      select.removeAttribute("aria-controls");
    };

    const setValue = (text: string) => {
      select.querySelector(".mat-mdc-select-value")!.innerHTML =
        `<span class="mat-mdc-select-value-text"><span class="mat-mdc-select-min-line"></span></span>`;
      select.querySelector(".mat-mdc-select-min-line")!.textContent = text;
    };

    const enable = (target: ModalSelectKey) => {
      const dependent = document.querySelector<HTMLElement>(`mat-select[data-for-test="time-entry-editor-${target}"]`);
      if (!dependent) return;
      setTimeout(() => {
        dependent.setAttribute("aria-disabled", "false");
        dependent.classList.remove("mat-mdc-select-disabled");
      }, config.enableDelayMs ?? 0);
    };

    select.querySelector(".mat-mdc-select-trigger")!.addEventListener("click", () => {
      if (select.getAttribute("aria-disabled") === "true") return;
      log.push(`open:${key}`);
      select.setAttribute("aria-expanded", "true");
      select.setAttribute("aria-controls", panelId);

      const panel = document.createElement("div");
      panel.id = panelId;
      panel.setAttribute("role", "listbox");
      panel.className = "mat-mdc-select-panel mdc-menu-surface mdc-menu-surface--open";
      panel.innerHTML = `
        <input class="mat-select-search-input mat-select-search-hidden">
        <div class="mat-select-search-inner"><input class="mat-select-search-input"></div>
        <div class="options"></div>`;
      overlay.appendChild(panel);

      const all = config.options[key] ?? [];
      const serverSearch = config.serverSearch?.includes(key) ?? false;
      const renderOptions = (query: string) => {
        const container = panel.querySelector(".options")!;
        container.innerHTML = "";
        const visible = query
          ? all.filter((text) => text.toLowerCase().includes(query.toLowerCase()))
          : serverSearch
            ? all.slice(0, 1)
            : all;
        for (const text of visible) {
          const option = document.createElement("mat-option");
          option.className = "mat-mdc-option mdc-list-item";
          option.innerHTML = `<span class="mdc-list-item__primary-text"></span>`;
          option.querySelector("span")!.textContent = ` ${text} `;
          option.addEventListener("click", () => {
            log.push(`select:${key}:${text}`);
            setValue(text);
            close();
            const dependent = DEPENDENTS[key];
            if (dependent) enable(dependent);
          });
          container.appendChild(option);
        }
      };

      const search = panel.querySelector<HTMLInputElement>(".mat-select-search-inner input")!;
      search.addEventListener("input", () => renderOptions(search.value));
      const onEscape = (event: Event) => {
        if ((event as KeyboardEvent).key === "Escape") close();
      };
      search.addEventListener("keydown", onEscape);
      select.addEventListener("keydown", onEscape);

      const delay = config.loadDelayMs?.[key];
      if (delay) setTimeout(() => renderOptions(""), delay);
      else renderOptions("");
    });
  }
  return { log };
}
