import { Tooltip } from "antd";
import { useContext, useEffect, useState } from "react";
import { TemplateContextType, TemplateContext } from "~/TemplateContext";
import { FrozenColumn, frozenCellProps } from "./frozenColumns";

type ImportEntriesTableCellProps = {
  templateId: string;
  fieldValue: string;
  frozenColumn?: FrozenColumn;
};

const TableCellBillable = (props: ImportEntriesTableCellProps) => {
  const { templates: templateEntries } = useContext<TemplateContextType>(TemplateContext);

  const fieldIsBillable = props.fieldValue === "Billable";
  const [templateIsBillable, setTemplateIsBillable] = useState<boolean>();
  const matchesTemplateBillable = fieldIsBillable === templateIsBillable;

  useEffect(() => {
    const template = templateEntries.find((entry) => entry.id === props.templateId);

    // eslint-disable-next-line react-hooks/set-state-in-effect -- established pattern; refactoring to derive during render is out of scope for the dependency upgrade
    setTemplateIsBillable(template?.billable);
  }, [props.templateId, templateEntries]);

  const timeEntryIsBillableOutput = fieldIsBillable ? "✅ Billable" : "◻️ Not billable";
  const templateIsBillableOutput = templateIsBillable ? "✅ Billable" : "◻️ Not billable";
  const text = (
    <>
      <strong>Time entry: {timeEntryIsBillableOutput}</strong>
      <br />
      Template: {templateIsBillableOutput}
      <br />
      <br />
      Time entry's billable flag ({timeEntryIsBillableOutput}) will override the template one (
      {templateIsBillableOutput}).
    </>
  );

  const rendering =
    templateIsBillable !== undefined ? (
      <>
        {fieldIsBillable ? "✅" : "◻️"}
        {matchesTemplateBillable ? "" : <Tooltip title={text}>⚠️</Tooltip>}
      </>
    ) : (
      <>{fieldIsBillable ? "✅" : "◻️"}</>
    );

  return <td {...frozenCellProps(props.frozenColumn)}>{rendering}</td>;
};

export default TableCellBillable;
