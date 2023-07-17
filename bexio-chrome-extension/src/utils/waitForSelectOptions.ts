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