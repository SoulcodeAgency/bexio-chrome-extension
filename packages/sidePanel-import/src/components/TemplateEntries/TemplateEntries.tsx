import { TemplateEntry } from "@bexio-chrome-extension/shared/types";
import { TemplateContext, TemplateContextType } from "~/TemplateContext.js";
import applyTemplate from "~/utils/applyTemplate.js";
import "./TemplateEntries.css";
import { useContext } from "react";
import { Button, Tooltip } from "antd";
import { deleteTemplate } from "@bexio-chrome-extension/shared/chromeStorageTemplateEntries";

function TemplateEntries() {
  const { templates: templateEntries, reloadData } =
    useContext<TemplateContextType>(TemplateContext);

  async function confirmTemplateDeletion(template: TemplateEntry) {
    console.log(
      `Deleting template "${template.templateName}" with id: ${template.id}`
    );
    if (template.id !== undefined) {
      if (
        confirm(
          `Are you sure you want to delete the template "${template.templateName}"?`
        )
      ) {
        deleteTemplate(template.id).then(() => reloadData());
      }
    } else {
      alert("Sorry - Something went wrong!");
    }
  }

  return (
    <>
      <h2>Bexio Templates</h2>
      <div className="content">
        <table>
          <thead>
            <tr>
              <th>Apply</th>
              <th>Template Name</th>
              <th>Contact</th>
              <th>Project</th>
              <th>Package</th>
              <th>Contact Person</th>
              <th>Billable</th>
              <th>Status</th>
              <th>Work</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {templateEntries.map((entry: TemplateEntry) => (
              <tr key={entry.id}>
                <td>
                  <Button onClick={() => applyTemplate(entry.id)}>▶️</Button>
                </td>
                <td>{entry.templateName}</td>
                <td>{entry.contact}</td>
                <td>{entry.project}</td>
                <td>{entry.package}</td>
                <td>{entry.contactPerson}</td>
                <td>{entry.billable ? "✅" : "◻️"}</td>
                <td>{entry.status}</td>
                <td>{entry.work}</td>
                <td>
                  <Tooltip title="Delete Template">
                    <Button
                      danger
                      shape="circle"
                      onClick={() => confirmTemplateDeletion(entry)}
                    >
                      ❌
                    </Button>
                  </Tooltip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default TemplateEntries;
