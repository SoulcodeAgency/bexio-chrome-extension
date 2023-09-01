export const descriptionFieldId = "#tinymce";
// We need to go through the iframe to access the description field
const iframe = document.querySelector("#monitoring_text_ifr") as HTMLIFrameElement;
export const descriptionField = iframe.contentWindow.document.querySelector(descriptionFieldId) as HTMLInputElement;