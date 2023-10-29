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

type ImportRow = string[];
type ImportData = ImportRow[];

function ImportEntries() {
  const [applyNotesSetting, setApplyNotesSetting] = useState(true);
  const [clipboardStatus, setClipboardStatus] = useState("");
  const [importHeader, setImportHeader] = useState<ImportRow>([]);
  const [importFooter, setImportFooter] = useState<ImportRow>([]);
  const [importData, setImportData] = useState<ImportData>([]);
  const [importTemplates, setImportTemplates] = useState<string[]>([]);
  const [tabs, setTabs] = useState<string[]>(["import", "apply"]);
  const importDataRef = useRef<HTMLTextAreaElement>(null);
  const { templates: templateEntries, reloadData } =
    useContext<TemplateContextType>(TemplateContext);

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
    setClipboardStatus("");
  }

  function convertImportData(csvString: string) {
    const rows = csvString.split("\n");
    const importHeader = rows[0].split("\t");
    const importFooter = rows[rows.length - 1].split("\t");

    if (importHeader.find((column) => column === "Tag 1") === undefined) {
      const errorMessage =
        "Clipboard data could not be parsed correctly. Make sure you have atleast a column called 'Tag 1'";
      setClipboardStatus(errorMessage);
      resetImportState();
      throw new Error(errorMessage);
    }
    // Clear status
    setClipboardStatus("");

    const importData = rows
      .slice(1)
      .slice(0, -1)
      .map((row) => row.replace(/\r/g, ""))
      .map((row: string) => row.split("\t"));

    setImportFooter(importFooter);
    setImportHeader(importHeader);
    setImportData(importData);
    setImportTemplates([]);
    setTabs(["import", "apply"]);
  }

  function applyImportEntry(
    date: string,
    timeAmount: string,
    entryIndex: number
  ) {
    // Take the first 2 number blocks of the time, we only need hh:mm from the hh:mm:ss signature
    timeAmount = timeAmount.split(":").slice(0, 2).join(":");

    const data: {
      mode: string;
      duration: string;
      date: string;
      notes: undefined | string;
    } = {
      mode: "time+duration",
      duration: timeAmount,
      date: date,
      notes: undefined,
    };
    // Add notes (description) if they exist & if notes are enabled
    const notes = getNotes(entryIndex);
    if (notes.length) {
      data.notes = notes;
      console.log("Using notes: ", notes);
    }

    (async () => {
      // Sending data to the website context, can only be handled by chrome extension
      if (chrome.tabs) {
        const [tab] = await chrome.tabs.query({
          active: true,
          lastFocusedWindow: true,
        });
        if (tab.id) {
          console.log("sending data", data);
          // const response =
          await chrome.tabs.sendMessage(tab.id, data);

          // Check if this entry has a template
          const templateId = importTemplates[entryIndex];
          if (templateId.length) {
            applyTemplate(templateId);
          }
          // do something with response here, not outside the function
          // console.log(response);
        } else {
          throw new Error("No tab found");
        }
      }
    })();
  }

  function saveImport() {
    chromeStorage.save(importHeader, "importHeader");
    chromeStorage.save(importData, "importData");
    chromeStorage.save(importFooter, "importFooter");
    setTabs(["apply"]);
  }

  // Disabled for the moment - checking need
  // function reloadImportData() {
  //   setTabs(["apply"]);
  //   loadImportData();
  // }

  const tagColumnIndexes = importHeader.reduce(
    (acc: number[], column, index) => {
      if (column.startsWith("Tag")) {
        acc.push(index);
      }
      return acc;
    },
    []
  );

  function autoMapTemplates() {
    const importTemplateAssignment: string[] = [];
    importData.forEach((row, rowIndex) => {
      console.groupCollapsed(rowIndex + 1);
      const mappingResult: { [key: string]: number } = {};
      const tagColumnsContent = tagColumnIndexes.map((index) => row[index]);
      // Split content of every tag column by space to search for every word
      tagColumnsContent.forEach((tagColumn, columnIndex) => {
        const tagWords = tagColumn.match(/[a-zA-Z0-9]+/g);
        console.log("tagWords:", tagWords);
        // Count how many times each word occurs in the templateEntries and count them up
        tagWords?.length &&
          tagWords.map((tagWord) => {
            if (tagWord === "") return;
            tagWord = tagWord.toLowerCase();
            templateEntries.map((entry) => {
              let matches = 0;
              // Give points for the following columns if they match the tagWord
              entry.templateName.toLowerCase().includes(tagWord)
                ? matches++
                : null;
              entry.contact
                ? entry.contact.toLowerCase().includes(tagWord)
                  ? matches++
                  : null
                : null;
              entry.project
                ? entry.project.toLowerCase().includes(tagWord)
                  ? matches++
                  : null
                : null;
              entry.package
                ? entry.package.toLowerCase().includes(tagWord)
                  ? matches++
                  : null
                : null;
              entry.contactPerson
                ? entry.contactPerson.toLowerCase().includes(tagWord)
                  ? matches++
                  : null
                : null;
              entry.keywords
                ? entry.keywords.toLowerCase().includes(tagWord)
                  ? matches++
                  : null
                : null;

              // Make the count weight increase for every column: For the first tag column *1, second tag column *2, third tag column *3 etc.
              const countIncrease = matches * (columnIndex + 1);
              mappingResult[entry.id] =
                (mappingResult[entry.id] ?? 0) + countIncrease;
            });
          });
      });
      // Get the key(template id) of the mappingResult which has the highest value
      const templateId = Object.keys(mappingResult).reduce((a, b) =>
        mappingResult[a] > mappingResult[b] ? a : b
      );

      // Check if there is only 1 highest value, otherwise we do not auto map and leave the decision to the user
      const highestValue = Math.max(...Object.values(mappingResult));
      const highestValueCount = Object.values(mappingResult).filter(
        (value) => value === highestValue
      ).length;

      if (highestValueCount === 1) {
        // We have a winner! Assign the template id to the row
        importTemplateAssignment[rowIndex] = templateId;
      }

      console.table(mappingResult);
      console.log(
        "Auto mapping template: Row " + rowIndex + ", TemplateId: " + templateId
      );
      console.groupEnd();
    });

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
    chromeStorage.load<string[]>("importFooter").then((data) => {
      setImportFooter(data ?? []);
    });
    chromeStorage.load<string[]>("importTemplates").then((data) => {
      setImportTemplates(data ?? []);
    });
  }

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
        clipboard. Use the "Copy to clipboard" function in ManicTime's TimeSheet
        Summary, and make sure you have at least a "Tag 1" column.
      </p>
      <p>
        Paste the data into the following field (Note: it will import and
        override already imported data below)
      </p>
      <div>
        <textarea
          ref={importDataRef}
          wrap="off"
          rows={10}
          onChange={(e) => convertImportData(e.target.value)}
        />
      </div>

      <Button onClick={clearTextarea}>Clear textarea</Button>
      <Button type="primary" onClick={saveImport}>
        Save this import
      </Button>

      {clipboardStatus && (
        <div className="error">
          <p>Error: {clipboardStatus}</p>
        </div>
      )}
    </div>
  );

  const importDataHTML = (
    <div className="content">
      <Tooltip title="This will try to select the right template for your time entries">
        <Button type="primary" onClick={autoMapTemplates}>
          Auto map templates
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
              {entry.map((entryField, index) => (
                <ImportEntriesTableCell
                  columnHeader={importHeader[index]}
                  fieldValue={entryField}
                  key={entryField + index}
                  onButtonClick={() =>
                    applyImportEntry(
                      importHeader[index],
                      entryField,
                      entryIndex
                    )
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
        {/* TODO This button is probably more confusing than helping */}
        {/* <Button type="dashed" onClick={reloadImportData}>
          Reload saved data
        </Button> */}
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
                Select a <strong>template</strong> to use for every row, or try
                out the "Auto-map templates"-feature above and correct wrong
                ones.
              </li>
              <li>Click on the ▶️-button next to the time you want to track</li>
              <li>
                Date, Time and if selected also the Template with its values
                will auto-magically fill the form. 🥳
              </li>
              <li>
                Submit the form, and click the next time entry, to automatically
                open the time tracking page and auto fill again.
              </li>
            </ol>
          }
        />
      </div>
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
