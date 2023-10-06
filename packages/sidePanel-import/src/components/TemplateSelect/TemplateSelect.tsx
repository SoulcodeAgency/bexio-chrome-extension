import { useContext } from "react";
import { TemplateContext, TemplateContextType } from "~/TemplateContext";

type TemplateSelectProps = {
  selectedTemplate: string;
  onChange: (templateId: string) => void;
};

const TemplateSelect = (props: TemplateSelectProps) => {
  const { templates: templateEntries } =
    useContext<TemplateContextType>(TemplateContext);
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
