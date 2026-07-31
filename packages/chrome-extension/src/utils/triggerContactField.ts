import delay from "./delay";
import pressEnter from "./pressEnter";
import waitForContacts from "./waitForContacts";

// Trigger Contact field
async function triggerContactField(contactField: HTMLInputElement, value: string) {
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