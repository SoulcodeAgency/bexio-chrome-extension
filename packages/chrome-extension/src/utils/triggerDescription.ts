import { descriptionField } from "../selectors/descriptionField";

// Trigger description field
async function triggerDescription(value: string) {
    if (descriptionField) {
        descriptionField.textContent = value;
    }
}

export default triggerDescription;