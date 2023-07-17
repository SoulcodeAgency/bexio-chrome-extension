import "./App.css";
import TemplateEntries from "./components/TemplateEntries/TemplateEntries";
import ImportEntries from "./components/ImportEntries/ImportEntries";
import { TemplateContext } from "./TemplateContext";
import { useEffect, useState } from "react";
import { loadTemplates } from "../../shared/chromeStorageTemplateEntries";
import { TemplateEntry } from "../../types";

function App() {
  const [templates, setTemplates] = useState<TemplateEntry[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const templateEntries = await loadTemplates();
      setTemplates(templateEntries);
    };

    fetchData();
  }, []);

  return (
    <>
      <TemplateContext.Provider value={templates}>
        <div style={{ textAlign: "left" }}>
          <TemplateEntries />
          <ImportEntries />
        </div>
      </TemplateContext.Provider>
    </>
  );
}

export default App;
