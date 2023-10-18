import { TemplateEntry } from "@bexio-chrome-extension/shared/types";
import { TemplateContext, TemplateContextType } from "~/TemplateContext.js";
import applyTemplate from "~/utils/applyTemplate.js";
import "./TemplateEntries.css";
import { useContext, useState } from "react";
import { Button, Tooltip } from "antd";
import { deleteTemplate } from "@bexio-chrome-extension/shared/chromeStorageTemplateEntries";
import TemplateModal from "../TemplateModal/TemplateModal";

function TemplateEntries() {
  const { templates: templateEntries, reloadData } =
    useContext<TemplateContextType>(TemplateContext);

  const [templateId, setTemplateId] = useState("");

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
              <th>Keywords</th>
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
                <td>{entry.keywords}</td>
                <td>{entry.contact}</td>
                <td>{entry.project}</td>
                <td>{entry.package}</td>
                <td>{entry.contactPerson}</td>
                <td>{entry.billable ? "✅" : "◻️"}</td>
                <td>{entry.status}</td>
                <td>{entry.work}</td>
                <td>
                  <div style={{ display: "flex" }}>
                    <Tooltip title="Delete Template">
                      <Button
                        danger
                        shape="circle"
                        onClick={() => confirmTemplateDeletion(entry)}
                      >
                        ❌
                      </Button>
                    </Tooltip>
                    <Tooltip title="Edit Template">
                      <Button
                        shape="circle"
                        onClick={() => setTemplateId(entry.id)}
                      >
                        🔨
                      </Button>
                    </Tooltip>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {templateId && (
          <TemplateModal
            key={templateId}
            templateId={templateId}
            closeModal={() => setTemplateId("")}
          />
        )}
      </div>
    </>
  );
}

export default TemplateEntries;
