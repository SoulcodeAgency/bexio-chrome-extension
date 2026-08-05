import pollUntil, { POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from "./pollUntil";

/**
 * Polls until `#select2-drop input` is no longer present in the DOM (the
 * select2 drop has closed after an item was selected).
 *
 * Rejects with a `WaitForTimeoutError` once `timeoutMs` has elapsed — a search
 * that matches nothing never closes the drop, which used to hang the whole
 * fill (#83).
 *
 * @param timeToWait  Milliseconds between poll attempts (default 250).
 * @param timeoutMs   Overall deadline in milliseconds (default 20000).
 */
// Waits until Search box is gone
async function waitForSearchBoxFieldToBeRemoved(
  timeToWait = POLL_INTERVAL_MS,
  timeoutMs = POLL_TIMEOUT_MS,
): Promise<void> {
  await pollUntil(
    "the select2 search box (#select2-drop input) to disappear",
    () => document.querySelector("#select2-drop input") === null,
    timeToWait,
    timeoutMs,
  );
}

export default waitForSearchBoxFieldToBeRemoved;
