/**
 * Polls until the `<select>` element that immediately follows the select2
 * container identified by `selector` has more than one `<option>` (i.e. the
 * AJAX option-load has completed).
 *
 * Polling interval: `timeToWait` ms (default 1000 ms).
 * **No timeout** — if the select never gains options this promise resolves
 * never (10 000-iteration guard is absent here; it polls indefinitely).
 *
 * @param selector  CSS selector for the select2 container, e.g.
 *                  `"#s2id_monitoring_pr_project_id"`.
 * @param timeToWait  Milliseconds between poll attempts (default 1000).
 */
// Check that the select has any values
async function waitForSelectOptions(selector, timeToWait = 1000) {
    return new Promise<void>((resolve) => {
        const waitForSelectBox = () => {
            const selectSelector = document.querySelector(`${selector}+select`) as HTMLSelectElement;
            if (selectSelector !== null && selectSelector.options.length > 1) {
                resolve();
            } else {
                setTimeout(waitForSelectBox, timeToWait);
            }
        };
        waitForSelectBox();
    });
}

export default waitForSelectOptions;