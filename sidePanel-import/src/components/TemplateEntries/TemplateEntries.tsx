import { useState, useEffect } from "react";
import { loadTemplateEntries } from "../../../../shared/chromeStorageTemplateEntries.js";
import { TemplateEntry } from "../../../../types.js";
import "./TemplateEntries.css";

function TemplateEntries() {
  const [storage, setStorage] = useState<TemplateEntry[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const templateEntries = await loadTemplateEntries();

      setStorage(templateEntries);
    };

    fetchData();
  }, []);

  function applyTemplate(templateId: string) {
    (async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });
      if (tab.id) {
        const response = await chrome.tabs.sendMessage(tab.id, {
          mode: "template",
          templateId: templateId,
        });
        // do something with response here, not outside the function
        console.log(response);
      } else {
        throw new Error("No tab found");
      }
    })();
  }

  return (
    <>
      <h2>Saved templates</h2>
      <div className="content">
        <table>
          <thead>
            <tr>
              <th>#</th>
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
            {storage.map((entry: TemplateEntry) => (
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
