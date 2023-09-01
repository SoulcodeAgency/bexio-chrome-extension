import { TemplateContext } from "./TemplateContext";
import { ReactNode, useEffect, useState } from "react";
import { chromeStorageTemplateEntries } from "shared";
import { TemplateEntry } from "shared/types";

function TemplateProvider({ children }: { children: ReactNode }) {
  const development = process.env.NODE_ENV === "development";
  const defaultTemplates = development
    ? [
        {
          templateName: "SouliMouli",
          billable: false,
          contact: "Soulcode AG",
          contactPerson: "",
          id: "ScMisc",
          package: "Misc / Team",
          project: "Soulcode - Back Office",
          status: "",
          work: "",
        },
        {
          templateName: "Leister Marketing",
          billable: false,
          contact: "",
          contactPerson: "",
          id: "LeisterMarketing",
          package: "",
          project: "",
          status: "",
          work: "",
        },
        {
          templateName: "Leister PM",
          billable: false,
          contact: "",
          contactPerson: "",
          id: "LeisterPM",
          package: "",
          project: "",
          status: "",
          work: "",
        },
      ]
    : [];
  const [templates, setTemplates] = useState<TemplateEntry[]>(defaultTemplates);

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
