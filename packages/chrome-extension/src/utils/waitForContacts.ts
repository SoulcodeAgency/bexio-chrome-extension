/**
 * Polls until the jQuery-UI autocomplete results container (`.ac_results`)
 * is present in the DOM **and** visible (its computed `display` is not `"none"`).
 *
 * Polling interval: `timeToWait` ms (default 1000 ms).
 * **No timeout** — polls indefinitely; the promise never rejects.
 *
 * @param timeToWait  Milliseconds between poll attempts (default 1000).
 */
// Waits until contacts items show up
async function waitForContacts(timeToWait = 1000) {
    return new Promise<void>((resolve) => {
        const waitForContacts = () => {
            const contacts = document.querySelector(".ac_results");
            if (contacts === null) {
                setTimeout(waitForContacts, timeToWait);
            } else {
                // Check if its displaying
                const style = window.getComputedStyle(contacts);
                if (style.display === 'none') {
                    // The element is hidden
                    setTimeout(waitForContacts, timeToWait);
                } else {
                    // The element is visible
                    resolve();
                }

            }
        };
        waitForContacts();
    });
}

export default waitForContacts;