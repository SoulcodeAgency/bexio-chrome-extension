import { useState, useEffect } from "react";
import loadLocalTemplateEntries from "../../../../shared/loadLocalTemplateEntries.js";
import { TemplateEntry } from "../../../../types";
import "./LocalStorage.css";

function LocalStorage() {
  const [storage, setStorage] = useState<TemplateEntry[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const templateEntries = await loadLocalTemplateEntries();
      console.log(
        "🚀 ~ file: localStorage.tsx:21 ~ fetchData ~ templateEntries:",
        templateEntries
      );

      setStorage(templateEntries);
    };

    fetchData();
  }, []);

  return (
    <>
      <h2>Saved templates</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
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
          {storage.map((entry: TemplateEntry, index) => (
            <tr key={entry.id}>
              <td>{index + 1}</td>
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
    </>
  );
}

export default LocalStorage;
