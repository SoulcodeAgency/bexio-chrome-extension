import pollUntil, { POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from "./pollUntil";

/**
 * Polls until `#select2-drop input` appears in the DOM (the select2 search
 * box becomes visible when the drop is open).
 *
 * Rejects with a `WaitForTimeoutError` once `timeoutMs` has elapsed, so a drop
 * that never opens cannot leave the loader overlay on screen forever (#83).
 *
 * @param timeToWait  Milliseconds between poll attempts (default 250).
 * @param timeoutMs   Overall deadline in milliseconds (default 20000).
 * @returns The `<input>` element inside the open select2 drop.
 */
// Get search box field
async function waitForSearchBoxField(timeToWait = POLL_INTERVAL_MS, timeoutMs = POLL_TIMEOUT_MS) {
    return pollUntil(
        "the select2 search box (#select2-drop input) to appear",
        () => document.querySelector("#select2-drop input"),
        timeToWait,
        timeoutMs,
    );
}

export default waitForSearchBoxField;
