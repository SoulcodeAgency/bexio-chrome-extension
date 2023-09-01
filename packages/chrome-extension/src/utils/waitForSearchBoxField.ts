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