export const descriptionFieldId = "#tinymce";
// Don't access this on load, it can lead to problems, thats why we have a getter function here
export const getDescriptionField = () => {
    // We need to go through the iframe to access the description field
    const iframe = document.querySelector("#monitoring_text_ifr") as HTMLIFrameElement;
    const descriptionInputfield = iframe?.contentWindow?.document.querySelector(descriptionFieldId) as HTMLInputElement | undefined;
    if (descriptionInputfield) {
        return descriptionInputfield;
    } else {
        console.error(iframe, descriptionInputfield);
        throw new Error("Description field not found");
    }
}