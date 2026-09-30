import {
  getLiveSelectPanel,
  getModalSelect,
  getModalSelectTrigger,
  getPanelOptions,
  getPanelSearchInput,
  isModalSelectEnabled,
  MODAL_SELECT_LABELS,
  ModalSelectKey,
  readModalSelectText,
} from "../../selectors/timeEntryModal";
import { findBestOption, matchOption, normalizeOptionText } from "../optionMatch";
import pollUntil, { WaitForTimeoutError } from "../pollUntil";
import { VALUE_WAIT_BUDGET_MS } from "../waitForSelectOptions";

/**
 * How long the full option list is searched before the search box is used. Contact lists are
 * filtered client-side, so the full list normally holds the value; typing is the fallback for a
 * list that only shows what was searched for.
 */
export const SEARCH_FALLBACK_AFTER_MS = 1_000;

const optionText = (option: HTMLElement) =>
  option.querySelector(".mdc-list-item__primary-text")?.textContent ?? option.textContent ?? "";

/** Best effort: closes a panel the fill gives up on, so the dialog is left usable. */
function closePanel(select: HTMLElement, panel: HTMLElement | null) {
  const escape = () => new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true });
  (panel ? getPanelSearchInput(panel) : null)?.dispatchEvent(escape());
  select.dispatchEvent(escape());
  if (select.getAttribute("aria-expanded") === "true") {
    const backdrops = document.querySelectorAll<HTMLElement>(".cdk-overlay-container .cdk-overlay-backdrop");
    backdrops[backdrops.length - 1]?.click();
  }
}

/**
 * Selects `value` in one of the time entry dialog's `mat-select` fields, the way a user would:
 *
 * 1. wait for the field (and for it to be enabled — Projekt waits for Kontakt, Arbeitspaket for
 *    Projekt),
 * 2. click its trigger and wait for the live option panel,
 * 3. find the best matching option (`findBestOption`: exact, then substring, then the word-set rule
 *    that ignores the order of first and last name). When the full list holds no match after
 *    {@link SEARCH_FALLBACK_AFTER_MS}, the value's first word goes into the search box,
 * 4. click that option and wait until the field shows it.
 *
 * Does nothing for an empty value, and nothing when the field already shows the value.
 *
 * Every wait goes through `pollUntil`, so a field that never appears or enables rejects with a
 * `WaitForTimeoutError`. So does a value that is not among the loaded options for
 * `VALUE_WAIT_BUDGET_MS` — the template no longer fits (a deleted project, another contact) —
 * after closing the panel again. `fillForm` reports both to the user.
 */
export async function selectMatOption(key: ModalSelectKey, value: string | null | undefined): Promise<void> {
  if (value == null || value.trim() === "") return;
  const label = MODAL_SELECT_LABELS[key];

  const select = await pollUntil(`the "${label}" field to appear`, () => getModalSelect(key));
  await pollUntil(`the "${label}" field to become enabled`, () => isModalSelectEnabled(select));

  if (matchOption(readModalSelectText(select), value) === "exact") return;

  getModalSelectTrigger(select).click();
  const panel = await pollUntil(`the "${label}" options to open`, () => getLiveSelectPanel(select));

  // The check must not throw: pollUntil calls it from a timer after the first attempt, where a
  // throw would escape the promise. A value that never shows up is reported as "missing" instead.
  let optionsSeenAt: number | null = null;
  let searched = false;
  const found = await pollUntil(`the "${label}" options to load`, (): HTMLElement | "missing" | false => {
    const livePanel = getLiveSelectPanel(select) ?? panel;
    const options = getPanelOptions(livePanel);
    const best = findBestOption(options, value, optionText);
    if (best) return best;
    // The budget runs from the first time any option showed up, so a search that leaves no
    // option at all still ends in "missing" rather than in the much longer overall deadline.
    if (options.length === 0 && optionsSeenAt === null) return false;
    optionsSeenAt ??= Date.now();
    const waited = Date.now() - optionsSeenAt;
    if (!searched && waited >= SEARCH_FALLBACK_AFTER_MS) {
      searched = true;
      const search = getPanelSearchInput(livePanel);
      if (search) {
        search.value = normalizeOptionText(value).split(" ")[0];
        search.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
    return waited >= VALUE_WAIT_BUDGET_MS ? "missing" : false;
  }).catch((error: unknown) => {
    closePanel(select, getLiveSelectPanel(select));
    throw error;
  });
  if (found === "missing") {
    closePanel(select, getLiveSelectPanel(select));
    throw new WaitForTimeoutError(`a "${value}" option in the "${label}" field`, VALUE_WAIT_BUDGET_MS);
  }
  const option = found;

  const chosen = normalizeOptionText(optionText(option));
  option.click();
  await pollUntil(
    `the "${label}" field to show "${chosen}"`,
    () =>
      normalizeOptionText(readModalSelectText(select)) === chosen && select.getAttribute("aria-expanded") !== "true",
  );
}

export default selectMatOption;
