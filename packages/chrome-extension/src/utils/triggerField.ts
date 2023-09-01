import pressEnter from "./pressEnter";
import waitForSearchBoxField from "./waitForSearchBoxField";
import waitForSearchBoxFieldToBeRemoved from "./waitForSearchBoxFieldToBeRemoved";
import waitForSelectOptions from "./waitForSelectOptions";

// Trigger general fields with search box
async function triggerField(selector, value) {
    if (value === null || value.trim() === "") return;
    const inputSelector = document.querySelector(`${selector} input`) as HTMLInputElement;
    await waitForSelectOptions(selector);
    inputSelector.value = value;
    inputSelector.dispatchEvent(pressEnter);
    const searchBoxField = await waitForSearchBoxField() as HTMLInputElement;
    searchBoxField.value = value;
    searchBoxField.dispatchEvent(pressEnter);
    await waitForSearchBoxFieldToBeRemoved();
}

export default triggerField;