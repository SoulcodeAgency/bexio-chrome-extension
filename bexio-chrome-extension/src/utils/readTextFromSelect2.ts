// Read value from select2
async function readTextFromSelect2(selector) {
    return selector.closest(".input").querySelector(".select2-chosen").textContent.trim();
}

export default readTextFromSelect2;