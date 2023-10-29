import { TemplateContext } from "./TemplateContext";
import { ReactNode, useEffect, useState } from "react";
import {
  chromeStorageTemplateEntries,
  sortTemplates,
} from "@bexio-chrome-extension/shared";
import { TemplateEntry } from "@bexio-chrome-extension/shared/types";
import { developmentEnv } from "./utils/development";

function TemplateProvider({ children }: { children: ReactNode }) {
  const [templates, setTemplates] = useState<TemplateEntry[]>(
    sortTemplates([])
  );
  const [reload, setReload] = useState(false);

  async function getDevTemplates() {
    const response = await fetch("/devTemplates.json");
    return await response.json();
  }

  useEffect(() => {
    const fetchData = async () => {
      const templateEntries = developmentEnv
        ? await getDevTemplates()
        : await chromeStorageTemplateEntries.loadTemplates();
      setTemplates(sortTemplates(templateEntries));
    };

    fetchData();
  }, [reload]);

  const reloadData = () => {
    setReload(!reload);
  };

  return (
    <TemplateContext.Provider value={{ templates, reloadData }}>
      {children}
    </TemplateContext.Provider>
  );
}

export default TemplateProvider;
