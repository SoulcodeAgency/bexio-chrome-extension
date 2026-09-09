// Read value from select2
async function readTextFromSelect2(selector: Element) {
  // The `!`s keep the existing behaviour exactly: if bexio's markup changes and any
  // link in this chain is missing, this throws here, as it does today. A guard would
  // silently return undefined instead and push the failure somewhere less obvious.
  return selector.closest(".input")!.querySelector(".select2-chosen")!.textContent!.trim();
}

export default readTextFromSelect2;
