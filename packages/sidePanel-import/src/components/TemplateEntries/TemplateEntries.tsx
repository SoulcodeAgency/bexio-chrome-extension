import { TemplateEntry } from "@bexio-chrome-extension/shared/types";
import { TemplateContext } from "~/TemplateContext.js";
import applyTemplate from "~/utils/applyTemplate.js";
import "./TemplateEntries.css";
import { useContext } from "react";

function TemplateEntries() {
  const templateEntries = useContext<TemplateEntry[]>(TemplateContext);

  return (
    <>
      <h2>Bexio Templates</h2>
      <div className="content">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Template Name</th>
              <th>Contact</th>
              <th>Project</th>
              <th>Package</th>
              <th>Contact Person</th>
              <th>Billable</th>
              <th>Status</th>
              <th>Work</th>
            </tr>
          </thead>
          <tbody>
            {templateEntries.map((entry: TemplateEntry) => (
              <tr key={entry.id}>
                <td>
                  <button onClick={() => applyTemplate(entry.id)}>▶️</button>
                </td>
                <td>{entry.templateName}</td>
                <td>{entry.contact}</td>
                <td>{entry.project}</td>
                <td>{entry.package}</td>
                <td>{entry.contactPerson}</td>
                <td>{entry.billable ? "✅" : "❌"}</td>
                <td>{entry.status}</td>
                <td>{entry.work}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default TemplateEntries;
