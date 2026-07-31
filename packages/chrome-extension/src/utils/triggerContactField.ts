import delay from "./delay";
import pressEnter from "./pressEnter";
import waitForContacts from "./waitForContacts";

// Trigger Contact field
async function triggerContactField(contactField: HTMLInputElement, value: string | null | undefined) {
    // Same early return as triggerField: an empty (or missing) value has nothing to search for.
    // Without this the jQuery-UI autocomplete never opens .ac_results and waitForContacts -
    // which has no timeout - would poll forever, leaving the loader overlay up (#82).
    // `== null` also covers `undefined`, which would otherwise be coerced to the string "undefined".
    if (value == null || value.trim() === "") return;
    contactField.value = value;
    contactField.click();
    contactField.click();
    contactField.click();
    await waitForContacts();
    contactField.dispatchEvent(pressEnter);
    // TODO: Improve the following delay to really check if contacts are gone
    await delay(1000);
}

export default triggerContactField;