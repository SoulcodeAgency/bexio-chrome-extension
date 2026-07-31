import pressEnter from "./pressEnter";
import waitForSearchBoxField from "./waitForSearchBoxField";
import waitForSearchBoxFieldToBeRemoved from "./waitForSearchBoxFieldToBeRemoved";
import waitForSelectOptions from "./waitForSelectOptions";

// Trigger general fields with search box
async function triggerField(selector: string, value: string | null) {
    if (value === null || value.trim() === "") return;
    const inputSelector = document.querySelector(`${selector} input`) as HTMLInputElement;
    // Pass the value we are about to search for, so a dependent select that still
    // holds the previous selection's options is not accepted as ready (#84).
    // `undefined` keeps the default polling interval.
    await waitForSelectOptions(selector, undefined, value);
    inputSelector.value = value;
    inputSelector.dispatchEvent(pressEnter);
    const searchBoxField = await waitForSearchBoxField() as HTMLInputElement;
    searchBoxField.value = value;
    searchBoxField.dispatchEvent(pressEnter);
    await waitForSearchBoxFieldToBeRemoved();
}

export default triggerField;