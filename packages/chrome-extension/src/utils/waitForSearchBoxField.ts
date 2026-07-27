/**
 * Polls until `#select2-drop input` appears in the DOM (the select2 search
 * box becomes visible when the drop is open).
 *
 * Polling interval: `timeToWait` ms (default 1000 ms).
 * **No timeout** — polls indefinitely; the promise never rejects.
 *
 * @param timeToWait  Milliseconds between poll attempts (default 1000).
 * @returns The `<input>` element inside the open select2 drop.
 */
// Get search box field
async function waitForSearchBoxField(timeToWait = 1000) {
    return new Promise((resolve) => {
        const waitForSearchBox = () => {
            const searchBox = document.querySelector("#select2-drop input");
            if (searchBox !== null) {
                resolve(searchBox);
            } else {
                setTimeout(waitForSearchBox, timeToWait);
            }
        };
        waitForSearchBox();
    });
}

export default waitForSearchBoxField;