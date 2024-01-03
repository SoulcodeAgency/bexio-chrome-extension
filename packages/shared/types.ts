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

export type ExchangeMode = "template" | "time+duration";

export type EntryExchangeData = {
  mode: "time+duration";
  duration: string;
  date: string;
  notes: undefined | string;
  billable?: boolean;
};

export type TemplateExchangeData = {
  mode: "template";
  templateId: string;
  timeEntryBillable?: boolean;
};

export type ReloadExtension = {
  mode: "reload";
};

export type ExchangeRequestData =
  | TemplateExchangeData
  | EntryExchangeData
  | ReloadExtension;
