export const descriptionFieldId = "#tinymce";
// We need to go through the iframe to access the description field
const iframe = document.querySelector("#monitoring_text_ifr") as HTMLIFrameElement;
// Don't access this on load, it can lead to problems, thats why we have a getter function here
export const getDescriptionField = () => iframe?.contentWindow?.document.querySelector(descriptionFieldId) as HTMLInputElement | undefined;