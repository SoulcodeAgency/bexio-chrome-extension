import pollUntil, { POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from "./pollUntil";

/**
 * Normalises an option text / searched value for comparison: collapses runs of
 * whitespace, trims and lower-cases. Bexio renders the select2 "chosen" text
 * (which is what a template stores) with the same content as the `<option>`
 * text, but not always with the same whitespace.
 */
function normalizeOptionText(text: string) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * True when any `<option>` of `select` would be matched by select2's search for
 * `needle`. Select2's default matcher is a case-insensitive substring test, so
 * this predicts whether the search that `triggerField` is about to run can hit
 * anything at all.
 */
function hasMatchingOption(select: HTMLSelectElement, needle: string) {
  return Array.from(select.options).some((option) => normalizeOptionText(option.text).includes(needle));
}

/**
 * How long to keep waiting for `expectedValue` to show up among the options
 * once the list is loaded, before resolving anyway (degrading to the plain
 * "options are loaded" behaviour). Time-based rather than poll-count-based so
 * it stays meaningful independently of the poll interval: it has to cover a
 * dependent select's AJAX repopulation round-trip, not a number of ticks.
 */
export const VALUE_WAIT_BUDGET_MS = 5_000;

/**
 * Polls until the `<select>` element that immediately follows the select2
 * container identified by `selector` has more than one `<option>` (i.e. the
 * AJAX option-load has completed).
 *
 * When `expectedValue` is given, the option list must additionally contain an
 * option that select2's search for that value could match (#84). The dependent
 * selects (Kontaktperson, Arbeitspaket) are repopulated via AJAX after their
 * parent field changes; until that response arrives the select still holds the
 * *previous* selection's options, which `options.length > 1` cannot tell apart
 * from a fresh list. Waiting for the searched value to actually show up stops
 * the select2 search from running against a stale list (which either finds
 * nothing — timing out `waitForSearchBoxFieldToBeRemoved` — or silently picks
 * a stale near-match).
 *
 * That extra wait is bounded by `valueWaitBudgetMs`, counted from the moment
 * the base condition first holds: when the value genuinely is not in the list
 * (a deleted project, a template that no longer matches the contact) the
 * helper gives up waiting for it and resolves anyway, degrading to the plain
 * "options are loaded" behaviour instead of failing.
 *
 * The base condition itself is bounded by `timeoutMs` and rejects with a
 * `WaitForTimeoutError` once it elapses (#83) — bexio's AJAX call can fail or
 * the markup can change, and a promise that never settles would leave the
 * loader overlay on screen forever.
 *
 * @param selector  CSS selector for the select2 container, e.g.
 *                  `"#s2id_monitoring_pr_project_id"`.
 * @param timeToWait  Milliseconds between poll attempts (default 250).
 * @param expectedValue  The value the caller is about to search for. `null` or
 *                       an empty string disables the option-content check.
 * @param valueWaitBudgetMs  How long to wait for `expectedValue` to appear
 *                           once the options are loaded, before resolving
 *                           anyway (default 5000).
 * @param timeoutMs  Overall deadline in milliseconds (default 20000).
 */
// Check that the select has any values
async function waitForSelectOptions(
  selector: string,
  timeToWait = POLL_INTERVAL_MS,
  expectedValue: string | null = null,
  valueWaitBudgetMs = VALUE_WAIT_BUDGET_MS,
  timeoutMs = POLL_TIMEOUT_MS,
): Promise<void> {
  const needle = expectedValue === null ? "" : normalizeOptionText(expectedValue);
  let optionsLoadedAt: number | null = null;
  await pollUntil(
    `the select2 options of "${selector}" to load`,
    () => {
      const selectSelector = document.querySelector(`${selector}+select`) as HTMLSelectElement | null;
      if (selectSelector === null || selectSelector.options.length <= 1) {
        optionsLoadedAt = null;
        return false;
      }
      if (needle === "" || hasMatchingOption(selectSelector, needle)) {
        return true;
      }
      // Options are loaded, but the searched value is not among them (yet):
      // give the dependent-select AJAX repopulation a bounded extra budget,
      // then degrade to the old "options are loaded" behaviour.
      optionsLoadedAt ??= Date.now();
      return Date.now() - optionsLoadedAt >= valueWaitBudgetMs;
    },
    timeToWait,
    timeoutMs,
  );
}

export default waitForSelectOptions;
