import { TemplateContext } from "./TemplateContext";
import { ReactNode, useEffect, useState } from "react";
import { loadTemplates } from "~/../../shared/chromeStorageTemplateEntries";
import { TemplateEntry } from "~/../../shared/types";

function TemplateProvider({ children }: { children: ReactNode }) {
  const [templates, setTemplates] = useState<TemplateEntry[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const templateEntries = await loadTemplates();
      setTemplates(templateEntries);
    };

    fetchData();
  }, []);

  return (
    <TemplateContext.Provider value={templates}>
      {children}
    </TemplateContext.Provider>
  );
}

export default TemplateProvider;
