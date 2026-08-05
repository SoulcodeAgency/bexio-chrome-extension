import pollUntil, { POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from "./pollUntil";

/**
 * Polls until the jQuery-UI autocomplete results container (`.ac_results`)
 * is present in the DOM **and** visible (its computed `display` is not `"none"`).
 *
 * Rejects with a `WaitForTimeoutError` once `timeoutMs` has elapsed, e.g. when
 * the contact lookup matches nothing or its AJAX call failed (#83).
 *
 * @param timeToWait  Milliseconds between poll attempts (default 250).
 * @param timeoutMs   Overall deadline in milliseconds (default 20000).
 */
// Waits until contacts items show up
async function waitForContacts(timeToWait = POLL_INTERVAL_MS, timeoutMs = POLL_TIMEOUT_MS): Promise<void> {
  await pollUntil(
    "the contact autocomplete results (.ac_results) to become visible",
    () => {
      const contacts = document.querySelector(".ac_results");
      if (contacts === null) return false;
      // Present but hidden counts as "not there yet"
      return window.getComputedStyle(contacts).display !== "none";
    },
    timeToWait,
    timeoutMs,
  );
}

export default waitForContacts;
