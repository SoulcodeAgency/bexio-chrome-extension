import { descriptionField } from "../selectors/descriptionField";

// Trigger duration
async function triggerDescription(value: string) {
    descriptionField.textContent = value;
}

export default triggerDescription;