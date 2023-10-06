import { TemplateContext } from "./TemplateContext";
import { ReactNode, useEffect, useState } from "react";
import {
  chromeStorageTemplateEntries,
  sortTemplates,
} from "@bexio-chrome-extension/shared";
import { TemplateEntry } from "@bexio-chrome-extension/shared/types";

function TemplateProvider({ children }: { children: ReactNode }) {
  const development = process.env.NODE_ENV === "development";
  const [templates, setTemplates] = useState<TemplateEntry[]>(
    sortTemplates([])
  );

  async function getDevTemplates() {
    const response = await fetch("/devTemplates.json");
    return await response.json();
  }

  useEffect(() => {
    const fetchData = async () => {
      const templateEntries = development
        ? await getDevTemplates()
        : await chromeStorageTemplateEntries.loadTemplates();
      setTemplates(sortTemplates(templateEntries));
    };

    fetchData();
  }, [development]);

  return (
    <TemplateContext.Provider value={templates}>
      {children}
    </TemplateContext.Provider>
  );
}

export default TemplateProvider;
