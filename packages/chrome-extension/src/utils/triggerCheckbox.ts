// Trigger checkbox
async function triggerCheckbox(selector: HTMLInputElement, checked?: boolean) {
    if (typeof checked === "boolean") {
        selector.checked = checked;
    }
}

export default triggerCheckbox;