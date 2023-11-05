import { Tooltip } from "antd";
import { useContext, useEffect, useState } from "react";
import { TemplateContextType, TemplateContext } from "~/TemplateContext";

type ImportEntriesTableCellProps = {
  templateId: string;
  fieldValue: string;
};

const TableCellBillable = (props: ImportEntriesTableCellProps) => {
  const { templates: templateEntries } =
    useContext<TemplateContextType>(TemplateContext);

  const fieldIsBillable = props.fieldValue === "Billable";
  const [templateIsBillable, setTemplateIsBillable] = useState<boolean>();
  const matchesTemplateBillable = fieldIsBillable === templateIsBillable;

  useEffect(() => {
    const template = templateEntries.find(
      (entry) => entry.id === props.templateId
    );

    setTemplateIsBillable(template?.billable);
  }, [props.templateId, templateEntries]);

  const timeEntryIsBillableOutput = fieldIsBillable
    ? "✅ Billable"
    : "◻️ Not billable";
  const templateIsBillableOutput = templateIsBillable
    ? "✅ Billable"
    : "◻️ Not billable";
  const text = (
    <>
      <strong>Time entry: {timeEntryIsBillableOutput}</strong>
      <br />
      Template: {templateIsBillableOutput}
      <br />
      <br />
      Time entry's billable flag ({timeEntryIsBillableOutput}) will override the
      template one ({templateIsBillableOutput}).
    </>
  );

  return (
    <td>
      {templateIsBillable !== undefined && (
        <>
          {fieldIsBillable ? "✅" : "◻️"}
          {matchesTemplateBillable ? "" : <Tooltip title={text}>⚠️</Tooltip>}
        </>
      )}
    </td>
  );
};

export default TableCellBillable;
