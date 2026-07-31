import pollUntil, { POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from "./pollUntil";

/**
 * Polls until the `<select>` element that immediately follows the select2
 * container identified by `selector` has more than one `<option>` (i.e. the
 * AJAX option-load has completed).
 *
 * Rejects with a `WaitForTimeoutError` once `timeoutMs` has elapsed — bexio's
 * AJAX call can fail or the markup can change, and a promise that never settles
 * would leave the loader overlay on screen forever (#83).
 *
 * @param selector  CSS selector for the select2 container, e.g.
 *                  `"#s2id_monitoring_pr_project_id"`.
 * @param timeToWait  Milliseconds between poll attempts (default 250).
 * @param timeoutMs   Overall deadline in milliseconds (default 20000).
 */
// Check that the select has any values
async function waitForSelectOptions(
    selector: string,
    timeToWait = POLL_INTERVAL_MS,
    timeoutMs = POLL_TIMEOUT_MS,
): Promise<void> {
    await pollUntil(
        `the select2 options of "${selector}" to load`,
        () => {
            const selectSelector = document.querySelector(`${selector}+select`) as HTMLSelectElement | null;
            return selectSelector !== null && selectSelector.options.length > 1;
        },
        timeToWait,
        timeoutMs,
    );
}

export default waitForSelectOptions;
