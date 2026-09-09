import { getDescriptionField } from "../selectors/descriptionField";

// Trigger description field
// `getDescriptionField` throws when TinyMCE's iframe body is not in the DOM (yet), so there is no
// falsy case to guard against. Letting it reject is the point: `onMessage` awaits this call and
// turns the rejection into an `{ ok: false }` the side panel can show (#124).
async function triggerDescription(value: string) {
  const descriptionField = getDescriptionField();
  descriptionField.textContent = value;
}

export default triggerDescription;
