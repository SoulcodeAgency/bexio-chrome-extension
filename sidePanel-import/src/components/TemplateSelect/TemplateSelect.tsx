import { useContext } from "react";
import { TemplateEntry } from "~/../../shared/types";
import { TemplateContext } from "~/TemplateContext";

type TemplateSelectProps = {
  selectedTemplate: string;
  onChange: (templateId: string) => void;
};

const TemplateSelect = (props: TemplateSelectProps) => {
  const templateEntries = useContext<TemplateEntry[]>(TemplateContext);
  const handleSelectChange = (event: React.ChangeEvent) => {
    props.onChange((event.target as HTMLInputElement).value);
  };

  return (
    <select defaultValue={props.selectedTemplate} onChange={handleSelectChange}>
      <option key="" value=""></option>
      {templateEntries.map((entry) => (
        <option key={entry.id} value={entry.id}>
          {entry.templateName}
        </option>
      ))}
    </select>
  );
};

export default TemplateSelect;
