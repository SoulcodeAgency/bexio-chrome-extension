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