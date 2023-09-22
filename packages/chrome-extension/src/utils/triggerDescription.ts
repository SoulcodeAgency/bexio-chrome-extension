import { getDescriptionField } from "../selectors/descriptionField";

// Trigger description field
async function triggerDescription(value: string) {
    const descriptionField = getDescriptionField();
    if (descriptionField) {
        descriptionField.textContent = value;
    }
}

export default triggerDescription;