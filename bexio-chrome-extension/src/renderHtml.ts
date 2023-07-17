import confirmDeletion from "./utils/confirmTemplateDeletion";
import fillForm from "./utils/fillForm";
import getTemplateName from "./utils/getTemplateName";
import { DATE, VERSION } from "./utils/packageInfo";
import readFormData from "./utils/readFormData";

// Renders all the html code for placing buttons to interact with
async function renderHtml(templateEntries) {
    // Add some buttons into the page
    let buttons = '';
    if (templateEntries) {
        templateEntries.map(entry => buttons += `<button id="${entry.id}" class="entry btn btn-info template-button" style="margin-right: 2px">${getTemplateName(entry)}</button>`);
    }

    // Remove the templates HTML, if it already exists
    const templates = document.getElementById("SoulcodeExtensionTemplates");
    if (templates) {
        templates.remove();
    }

    const templatePlacement = document.getElementById("pr_package").parentNode.parentNode.parentNode as HTMLElement;
    const htmlTemplateButtons = `<div id="bexioTimetrackingTemplates-entries" style="display: flex; flex-wrap: wrap; gap: 4px;">
        ${buttons}
    </div>`;
    const htmlActions = `<div id="SoulcodeExtensionActions" style="margin-left: 4px; margin-bottom: 5px;">
            <button id="AddNewTemplate" class="btn btn-info">+ Add as Template</button>
            <button id="DeleteTemplate" class="btn btn-danger">Delete Template</button>
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
    </div>`);

    // Attach functionality to the buttons
    const domButtons = document.getElementById('bexioTimetrackingTemplates-entries').querySelectorAll("button.entry");
    domButtons.forEach(button => button.addEventListener('click', function (e) {
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
    document.getElementById('AddNewTemplate').addEventListener('click', function (e) { e.preventDefault(); readFormData() });
    document.getElementById('DeleteTemplate').addEventListener('click', function (e) { e.preventDefault(); confirmDeletion() });
}

export default renderHtml;