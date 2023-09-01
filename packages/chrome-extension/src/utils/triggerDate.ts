import { dateField } from "../selectors/dateField";
import pressEnter from "./pressEnter";

// Trigger date
async function triggerDate(value: string) {
    dateField.value = value;
    dateField.dispatchEvent(pressEnter);
}

export default triggerDate;