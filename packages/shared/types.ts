export type TemplateEntry = {
    templateName: string;
    keywords: string;
    billable: boolean;
    contact: string;
    contactPerson: string;
    id: string;
    package: string;
    project: string;
    status: "Offen" | "In Arbeit" | "Erledigt" | "Fakturiert" | "Geschlossen";
    work: string;
    [key: string]: any;
};

export type ImportData = string[];