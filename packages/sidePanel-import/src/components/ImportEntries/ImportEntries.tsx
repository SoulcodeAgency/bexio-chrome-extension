import { useEffect, useRef, useState, useContext } from "react";
import "./ImportEntries.css";
import ImportEntriesTableCell from "./ImportEntriesTableCell";
import TemplateSelect from "~/components/TemplateSelect/TemplateSelect";
import applyTemplate from "~/utils/applyTemplate";
import { Alert, Collapse, CollapseProps } from "antd";
import { TemplateContext } from "~/TemplateContext";
import { chromeStorage } from "@bexio-chrome-extension/shared";
import { TemplateEntry } from "@bexio-chrome-extension/shared/types";

type ImportRow = string[];
type ImportData = ImportRow[];

function ImportEntries() {
  const [clipboardStatus, setClipboardStatus] = useState("");
  const [importHeader, setImportHeader] = useState<ImportRow>([]);
  const [importFooter, setImportFooter] = useState<ImportRow>([]);
  const [importData, setImportData] = useState<ImportData>([]);
  const [importTemplates, setImportTemplates] = useState<string[]>([]);
  const [tabs, setTabs] = useState<string[]>(["import", "apply"]);
  const importDataRef = useRef<HTMLTextAreaElement>(null);
  const templateEntries = useContext<TemplateEntry[]>(TemplateContext);

  // TODO: Instead of relying on the last column being "Notes", we could check where the columns exists and use that index instead
  const hasNotes = importHeader[importHeader.length - 1] === "Notes";

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

    (async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });
      if (tab.id) {
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
        // Add notes if they exist
        if (hasNotes) {
          data.notes = importData[entryIndex][importHeader.length - 1];
        }
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
    })();
  }

  function saveImport() {
    chromeStorage.save(importHeader, "importHeader");
    chromeStorage.save(importData, "importData");
    chromeStorage.save(importFooter, "importFooter");
    setTabs(["apply"]);
  }

  function reloadImportData() {
    setTabs(["apply"]);
    loadImportData();
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

  function autoMapTemplates() {
    const importTemplateAssignment: string[] = [];
    importData.forEach((row, rowIndex) => {
      const mappingResult: { [key: string]: number } = {};
      const tagColumnsContent = tagColumnIndexes.map((index) => row[index]);
      // Split content of every tag column by space to search for every word
      tagColumnsContent.forEach((tagColumn, columnIndex) => {
        const tagWords = tagColumn.split(" ");
        // Count how many times each word occurs in the templateEntries and count them up
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

      console.log(
        "Auto mapping template: Row " +
          rowIndex +
          ", TemplateId: " +
          templateId,
        "content",
        tagColumnsContent
      );
      console.table(mappingResult);
    });

    // Save the auto mapped templates
    setImportTemplates(importTemplateAssignment);
    chromeStorage.save(importTemplateAssignment, "importTemplates");
  }

  function loadImportData() {
    chromeStorage.load<string>("importHeader").then((data) => {
      setImportHeader(data ?? []);
    });
    chromeStorage.load<ImportRow>("importData").then((data) => {
      setImportData(data ?? []);
    });
    chromeStorage.load<string>("importFooter").then((data) => {
      setImportFooter(data ?? []);
    });
    chromeStorage.load<string>("importTemplates").then((data) => {
      setImportTemplates(data ?? []);
    });
  }

  useEffect(() => {
    loadImportData();
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

      <button onClick={clearTextarea}>Clear textarea</button>
      <button
        style={{ backgroundColor: "#4291a8", color: "white" }}
        onClick={saveImport}
      >
        Save this import
      </button>

      {clipboardStatus && (
        <div className="error">
          <p>Error: {clipboardStatus}</p>
        </div>
      )}
    </div>
  );

  const importDataHTML = (
    <div className="content">
      <button
        style={{ backgroundColor: "#3276b4", color: "white" }}
        onClick={autoMapTemplates}
      >
        Auto map templates
      </button>
      <br />
      <br />

      <table className="importDataTable">
        <thead>
          <tr>
            <th>#</th>
            <th title="Select the template to apply">Template</th>
            {importHeader.map((field) => (
              <th key={field}>{field}</th>
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
        <button
          style={{ backgroundColor: "#3276b4", color: "white" }}
          onClick={reloadImportData}
        >
          Reload saved data
        </button>
        <button
          style={{ backgroundColor: "red", color: "white" }}
          onClick={removeImportData}
        >
          Delete saved data
        </button>

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
