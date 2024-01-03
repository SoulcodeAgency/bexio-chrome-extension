import { useEffect, useRef, useState, useContext } from "react";
import "./ImportEntries.css";
import ImportEntriesTableCell from "./ImportEntriesTableCell";
import TemplateSelect from "~/components/TemplateSelect/TemplateSelect";
import applyTemplate from "~/utils/applyTemplate";
import { Button, Alert, Collapse, CollapseProps, Switch, Tooltip } from "antd";
import { TemplateContext, TemplateContextType } from "~/TemplateContext";
import { chromeStorage } from "@bexio-chrome-extension/shared";
import {
  loadApplyNotesSetting,
  saveApplyNotesSetting,
} from "@bexio-chrome-extension/shared/chromeStorageSettings";
import { EntryExchangeData } from "@bexio-chrome-extension/shared/types";
import { autoMapTemplatesV3 } from "./AutoMapTemplatesV3";
import { autoMapTemplatesV1 } from "./AutoMapTemplatesV1";
import { autoMapTemplatesV2 } from "./AutoMapTemplatesV2";
import { handleCsvData } from "~/utils/csvParser";

export type ImportRow = string[];
export type ImportData = ImportRow[];
export type ImportBillable = "Billable" | "Not billable" | undefined;
export type EntryStatus = { [key: string]: boolean };

function ImportEntries() {
  const [applyNotesSetting, setApplyNotesSetting] = useState(true);
  const [parseStatus, setParseStatus] = useState("");
  const [importHeader, setImportHeader] = useState<ImportRow>([]);
  const [importFooter, setImportFooter] = useState<ImportRow>([]);
  const [importData, setImportData] = useState<ImportData>([]);
  const [entryStatus, setEntryStatus] = useState<EntryStatus>({});
  const [importTemplates, setImportTemplates] = useState<string[]>([]);
  const [tabs, setTabs] = useState<string[]>(["import", "apply"]);
  const importDataRef = useRef<HTMLTextAreaElement>(null);
  const { templates: templateEntries, reloadData } =
    useContext<TemplateContextType>(TemplateContext);

  const billableColumnIndex = importHeader.findIndex(
    (column) => column === "Billable"
  );

  function getBillable(entryIndex: number): boolean | undefined {
    let billable: ImportBillable = undefined;
    if (billableColumnIndex >= 0) {
      billable = importData[entryIndex][billableColumnIndex] as ImportBillable;
      console.log(
        "Added billable value:",
        billable,
        "as",
        billable === "Billable"
      );
    }
    // Only return true or false if it is set, otherwise undefined
    if (billable === "Billable") {
      return true;
    } else if (billable === "Not billable") {
      return false;
    }
    // Every other value should return undefined
    return undefined;
  }

  function getNotes(entryIndex: number) {
    let notes = "";
    const notesColumnIndex = importHeader.findIndex(
      (column) => column === "Notes"
    );
    if (notesColumnIndex >= 0) {
      notes = importData[entryIndex][notesColumnIndex];
      console.log("added notes from notes column");
    }
    if (notes === "") {
      // Get all indexes of the importHeader which start with "Tag"
      const tagColumnIndexes = importHeader.reduce(
        (acc: number[], column, index) => {
          if (column.startsWith("Tag")) {
            acc.push(index);
          }
          return acc;
        },
        []
      );
      // Sort the indexes, so we can start with the last one
      tagColumnIndexes.sort((a, b) => b - a);

      // Go through the tag columns, and check if they have content within importData and apply it to notes
      tagColumnIndexes.forEach((tagColumnIndex) => {
        if (notes === "") {
          notes = importData[entryIndex][tagColumnIndex];
          console.log(
            "applying notes from tag column " + importHeader[tagColumnIndex]
          );
        }
      });
    }
    return notes;
  }

  function resetImportState() {
    setImportHeader([]);
    setImportData([]);
    setImportFooter([]);
    setImportTemplates([]);
  }

  function removeImportData() {
    resetImportState();
    chromeStorage.save([], "importHeader");
    chromeStorage.save([], "importData");
    chromeStorage.save({}, "entryStatus");
    chromeStorage.save([], "importFooter");
    chromeStorage.save([], "importTemplates");
    setTabs(["import"]);
  }

  function switchApplyNotesSetting() {
    saveApplyNotesSetting(!applyNotesSetting);
    setApplyNotesSetting(!applyNotesSetting);
  }

  function clearTextarea() {
    importDataRef?.current && (importDataRef.current.value = "");
    setParseStatus("");
  }

  function convertImportData(csvString: string) {
    try {
      const { importFooter, importHeader, importData } =
        handleCsvData(csvString);
      setParseStatus("");
      setImportFooter(importFooter);
      setImportHeader(importHeader);
      setImportData(importData);
      setEntryStatus({});
      setImportTemplates([]);
      setTabs(["import", "apply"]);
    } catch (error: any) {
      setParseStatus(error.message as string);
      resetImportState();
    }
  }

  function applyImportEntry(
    columnIndex: number,
    timeAmount: string,
    entryIndex: number
  ) {
    // Take the first 2 number blocks of the time, we only need hh:mm from the hh:mm:ss signature
    timeAmount = timeAmount.split(":").slice(0, 2).join(":");
    const date = importHeader[columnIndex];
    const data: EntryExchangeData = {
      mode: "time+duration",
      duration: timeAmount,
      date: date,
      notes: undefined,
      billable: undefined,
    };

    // Add billable if it exists
    const billable = getBillable(entryIndex);
    if (billable !== undefined) {
      data.billable = billable;
    }

    // Add notes (description) if they exist & if notes are enabled
    const notes = getNotes(entryIndex);
    if (notes.length) {
      data.notes = notes;
    }

    (async () => {
      // Sending data to the website context, can only be handled by chrome extension
      if (chrome.tabs) {
        const [tab] = await chrome.tabs.query({
          active: true,
          lastFocusedWindow: true,
        });
        if (tab.id) {
          console.log("Sending data", data);
          // const response =
          await chrome.tabs.sendMessage(tab.id, data);

          // Check if this entry has a template
          const templateId = importTemplates[entryIndex];
          if (templateId?.length) {
            applyTemplate(templateId, billable);
          }
          // do something with response here, not outside the function
          // console.log(response);

          // Update the entry status
          const entryStatusCopy = { ...entryStatus };
          entryStatusCopy[`${columnIndex}-${entryIndex}`] = true;
          setEntryStatus(entryStatusCopy);
          chromeStorage.save(entryStatusCopy, "entryStatus");
          console.log("Updated entry status", entryStatusCopy);
        } else {
          throw new Error("No tab found");
        }
      }
    })();
  }

  function resetEntryStatus(id: string) {
    // Reset the entry status
    const entryStatusCopy = { ...entryStatus };
    entryStatusCopy[id] = false;
    setEntryStatus(entryStatusCopy);
    chromeStorage.save(entryStatusCopy, "entryStatus");
    console.log("Reset entry status for id ", id, entryStatusCopy);
  }

  function saveImport() {
    chromeStorage.save(importHeader, "importHeader");
    chromeStorage.save(importData, "importData");
    chromeStorage.save(importFooter, "importFooter");
    setTabs(["apply"]);
  }

  const tagColumnIndexes = importHeader.reduce(
    (acc: number[], column, index) => {
      if (column.startsWith("Tag")) {
        acc.push(index);
      }
      return acc;
    },
    []
  );

  function callAutoMapTemplatesV1() {
    const importTemplateAssignment = autoMapTemplatesV1(
      importData,
      templateEntries,
      importHeader,
      tagColumnIndexes
    );

    // Save the auto mapped templates
    setImportTemplates(importTemplateAssignment);
    chromeStorage.save(importTemplateAssignment, "importTemplates");
  }

  function callAutoMapTemplatesV2() {
    const importTemplateAssignment = autoMapTemplatesV2(
      importData,
      templateEntries,
      importHeader,
      tagColumnIndexes
    );

    // Save the auto mapped templates
    setImportTemplates(importTemplateAssignment);
    chromeStorage.save(importTemplateAssignment, "importTemplates");
  }

  function callAutoMapTemplatesV3() {
    const importTemplateAssignment = autoMapTemplatesV3(
      importData,
      templateEntries,
      importHeader,
      tagColumnIndexes
    );

    // Save the auto mapped templates
    setImportTemplates(importTemplateAssignment);
    chromeStorage.save(importTemplateAssignment, "importTemplates");
  }

  function loadImportData() {
    chromeStorage.load<string[]>("importHeader").then((data) => {
      setImportHeader(data ?? []);
    });
    chromeStorage.load<ImportRow[]>("importData").then((data) => {
      setImportData(data ?? []);
    });
    chromeStorage.load<EntryStatus>("entryStatus").then((data) => {
      setEntryStatus(data ?? {});
    });
    chromeStorage.load<string[]>("importFooter").then((data) => {
      setImportFooter(data ?? []);
    });
    chromeStorage.load<string[]>("importTemplates").then((data) => {
      setImportTemplates(data ?? []);
    });
  }

  // Load import data & templates when tabs change
  useEffect(() => {
    loadImportData();

    loadApplyNotesSetting().then((data) => {
      setApplyNotesSetting(data ?? true);
    });
  }, []);

  function onChangeTemplate(templateId: string, index: number) {
    const importTemplatesCopy = [...importTemplates];
    importTemplatesCopy[index] = templateId;
    setImportTemplates(importTemplatesCopy);
    chromeStorage.save(importTemplatesCopy, "importTemplates");
  }

  function changeTabs(key: string | string[]) {
    if (typeof key === "string") key = [key];
    setTabs(key);
  }

  const manicTimeImport = (
    <div className="content">
      <p>
        This lets you import entries from <b>ManicTime</b> - directly from your
        clipboard: <br />
        <ul>
          <li>
            Use the <i>"Copy to clipboard"</i> function in ManicTime's TimeSheet
            Summary, and make sure you have at least a <i>"Tag 1"</i> column.
          </li>
          <li>
            Optionally you can add <b>Notes</b> and <b>Billable</b> columns as
            well to apply them. <br />
            ⚠️ Notes are only supported if they don't contain line breaks. If
            you have any line breaks, you can still search and remove them in
            the following textarea field
          </li>
        </ul>
      </p>
      <p>
        Paste the data into the following field <br />
        <i>
          (Note: This will import data and override the "Apply imported
          data"-tab content)
        </i>
      </p>
      <div>
        <textarea
          ref={importDataRef}
          wrap="off"
          rows={10}
          onChange={(e) => convertImportData(e.target.value)}
        />
      </div>

      {parseStatus && (
        <div className="error">
          <p>Error: {parseStatus}</p>
        </div>
      )}

      <Button onClick={clearTextarea}>Clear textarea</Button>
      <Button type="primary" onClick={saveImport}>
        Save this import
      </Button>
    </div>
  );

  const importDataHTML = importData.length ? (
    <div className="content">
      <Tooltip title="First version of the auto mapper, weight depends on Tag culumns">
        <Button type="default" onClick={callAutoMapTemplatesV1}>
          Auto map templates v1
        </Button>
      </Tooltip>
      <Tooltip title="Second version, which weights the bexio fields, not the Tag columns">
        <Button type="default" onClick={callAutoMapTemplatesV2}>
          Auto map templates v2
        </Button>
      </Tooltip>
      <Tooltip title="Based on v2, but further weights exact word matches">
        <Button type="primary" onClick={callAutoMapTemplatesV3}>
          Auto map templates v3
        </Button>
      </Tooltip>

      <Tooltip title="If enabled, Notes will be handled too when applying time entries. Content is taken from the 'Notes' column or the last 'Tag' column which contains content.">
        <Switch
          checkedChildren="Apply notes"
          unCheckedChildren="Ignore notes"
          defaultChecked={false}
          onClick={switchApplyNotesSetting}
          checked={applyNotesSetting}
        />
      </Tooltip>
      <br />
      <br />
      <table className="importDataTable">
        <thead>
          <tr>
            <th>#</th>
            <th title="Select the template to apply">Template</th>
            {importHeader.map((field) => (
              <th
                key={field}
                style={{ minWidth: field === "Notes" ? "120px" : "auto" }}
              >
                {field}
                {field === "Notes" && (
                  <Tooltip title="If enabled, Notes will be handled too when applying time entries. Content is taken from the 'Notes' column or the last 'Tag' column which contains content.">
                    <Switch
                      checkedChildren="Apply notes"
                      unCheckedChildren="Ignore notes"
                      defaultChecked={false}
                      onClick={switchApplyNotesSetting}
                      checked={applyNotesSetting}
                    />
                  </Tooltip>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {importData.map((entry, entryIndex) => (
            <tr key={entry[0] + entryIndex + importTemplates[entryIndex]}>
              <td>{entryIndex + 1}</td>
              <td>
                <TemplateSelect
                  selectedTemplate={importTemplates[entryIndex]}
                  onChange={(templateId: string) =>
                    onChangeTemplate(templateId, entryIndex)
                  }
                />
              </td>
              {entry.map((fieldValue, columnIndex) => (
                <ImportEntriesTableCell
                  templateId={importTemplates[entryIndex]}
                  columnHeader={importHeader[columnIndex]}
                  fieldValue={fieldValue}
                  key={`table-cell-${entryIndex + 1}-${columnIndex}`}
                  entryStatus={entryStatus[`${columnIndex}-${entryIndex}`]}
                  onButtonClick={() =>
                    applyImportEntry(columnIndex, fieldValue, entryIndex)
                  }
                  onButtonClickReset={() =>
                    resetEntryStatus(`${columnIndex}-${entryIndex}`)
                  }
                />
              ))}
            </tr>
          ))}
          <tr>
            <td></td>
            <td></td>
            {importFooter.map((field, index) => (
              <td key={importHeader[index]}>{field}</td>
            ))}
          </tr>
        </tbody>
      </table>
      <br />
      <br />
      <div>
        <Button danger onClick={removeImportData}>
          Delete saved data
        </Button>

        <br />
        <br />
        <Alert
          showIcon
          type="info"
          message="How to use this:"
          description={
            <ol>
              <li>
                Select an <strong>Auto-map button</strong> above and check if
                the templates do match with your entries.
                <br />
                You can manually fix single entries, or do it completely
                manually of course.
                <br />
                <i>
                  These changes are saved automatically, in case you leave and
                  come back later.
                </i>
              </li>
              <li>
                Click on the ▶️-button next to the time you want to track. It
                will automatically fill the form in bexio and change its status
                to "applied" (✅)
                <br />
                ⚠️ This action currently is not yet saved, so we suggest to go
                through all entries in one session. If this page gets closed,
                you will loose the state of the button.
                <br />
                ℹ️ You can click the button again, if you want to re-apply it
                for some reason. <br />
                ℹ️ If you change the selected template, the state will also get
                reset.
              </li>
              <li>
                Auto filling
                <ol>
                  <li>
                    Date and Time will get applied on the bexio form directly.
                  </li>
                  <li>If added, Billable and Notes are also applied.</li>
                  <li>
                    If selected also the Template with its values will
                    auto-magically fill out the rest of the form. 🥳
                  </li>
                </ol>
              </li>
              <li>
                Submit the form <br />
                ℹ️ Click the next time entry, to automatically open the time
                tracking page and auto fill again, no need to open the time
                track page within bexio.
              </li>
            </ol>
          }
        />
      </div>
    </div>
  ) : (
    <div>
      <Alert
        showIcon
        type="info"
        message="Before you can apply the imported data, you need to add some data above and maybe also save it for later use."
      />
    </div>
  );

  const items: CollapseProps["items"] = [
    {
      key: "import",
      label: "ManicTime import",
      children: <div>{manicTimeImport}</div>,
    },
    {
      key: "apply",
      label: "Apply imported data",
      children: <div>{importDataHTML}</div>,
    },
  ];

  return (
    <Collapse
      items={items}
      defaultActiveKey={tabs}
      activeKey={tabs}
      onChange={changeTabs}
    />
  );
}

export default ImportEntries;
