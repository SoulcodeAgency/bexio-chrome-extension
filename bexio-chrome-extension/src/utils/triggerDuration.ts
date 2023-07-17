import { durationField } from "../selectors/durationField";
import pressEnter from "./pressEnter";

// Trigger duration
async function triggerDuration(value: string) {
    durationField.value = value;
    durationField.dispatchEvent(pressEnter);
}

export default triggerDuration;