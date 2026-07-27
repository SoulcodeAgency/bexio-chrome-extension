/**
 * Polls until `#select2-drop input` is no longer present in the DOM (the
 * select2 drop has closed after an item was selected).
 *
 * Polling interval: `timeToWait` ms (default 1000 ms).
 * **No timeout** — polls indefinitely; the promise never rejects.
 *
 * @param timeToWait  Milliseconds between poll attempts (default 1000).
 */
// Waits until Search box is gone
async function waitForSearchBoxFieldToBeRemoved(timeToWait = 1000) {
    return new Promise<void>((resolve) => {
        const waitForRemoval = () => {
            const searchBox = document.querySelector("#select2-drop input");
            if (searchBox === null) {
                resolve();
            } else {
                setTimeout(waitForRemoval, timeToWait);
            }
        };
        waitForRemoval();
    });
}

export default waitForSearchBoxFieldToBeRemoved;