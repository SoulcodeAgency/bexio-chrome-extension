import confirmDeletion from "./utils/confirmTemplateDeletion";
import fillForm from "./utils/fillForm";
import getTemplateName from "@bexio-chrome-extension/shared/getTemplateName";
import { DATE, VERSION } from "./utils/packageInfo";
import readFormData from "./utils/readFormData";

// Renders all the html code for placing buttons to interact with
async function renderHtml(templateEntries) {
    // Add some buttons into the page
    let buttons = '';
    if (templateEntries) {
        templateEntries.map(entry => buttons += `<button type="button" id="${entry.id}" class="entry btn btn-info template-button" style="width: 100%; margin-bottom: 2px; text-align: left;">${getTemplateName(entry)}</button>`);
    }

    // Remove the templates HTML, if it already exists
    const templates = document.getElementById("SoulcodeExtensionTemplates");
    if (templates) {
        templates.remove();
    }

    const templatePlacement = document.getElementById("pr_package")?.parentNode?.parentNode?.parentNode as HTMLElement;
    const htmlTemplateButtons = `<div id="bexioTimetrackingTemplates-entries" style="column-count: 2; column-fill: balance;">
        ${buttons}
    </div>`;
    const htmlActions = `<div id="SoulcodeExtensionActions" style="margin-left: 4px; margin-bottom: 5px;">
            <button type="button" id="AddNewTemplate" class="btn btn-info">+ Add as Template</button>
            <button type="button" id="DeleteTemplate" class="btn btn-danger">Delete Template</button>
        </div>`;

    // Place the html into the DOM
    templatePlacement.insertAdjacentHTML("beforeend", `<div id="SoulcodeExtensionTemplates" class="row-fluid">
        <hr>
        <div class="bx-formular-header" style="display: flex; justify-content: space-between">
            <h2 title="Last update: ${DATE}">
            Templates
            <span style="font-size: 0.9rem">(v${VERSION})</span>
            </h2>
            ${htmlActions}
        </div>
        ${htmlTemplateButtons}
        <div id="SoulcodeExtensionLoader" style="position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #3176b4;
        z-index: 10000000000;
        opacity: 0.6;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 10vw;
        display: none;">
            <div style="color: white">☕Loading...</div>
        </div>
    </div>`);

    // Attach functionality to the buttons
    const domButtons = document.getElementById('bexioTimetrackingTemplates-entries')?.querySelectorAll("button.entry");
    domButtons && domButtons.forEach(button => button.addEventListener('click', function (e) {
        e.preventDefault();
        fillForm(button.id)

        // Handle active template button
        const parent = (e.target as HTMLElement).parentNode as HTMLElement;
        const siblings = parent.querySelectorAll(".template-button");

        siblings.forEach((sibling) => {
            sibling.classList.remove("template-button--active");
        });

        (e.target as HTMLElement).classList.add("template-button--active");
    }));

    // Special action buttons
    document.getElementById('AddNewTemplate')?.addEventListener('click', function (e) { e.preventDefault(); readFormData() });
    document.getElementById('DeleteTemplate')?.addEventListener('click', function (e) { e.preventDefault(); confirmDeletion() });
}

export default renderHtml;