import { useEffect, useRef, useState, useContext } from "react";
import "./ImportEntries.css";
import ImportEntriesTableCell from "./ImportEntriesTableCell";
import { load, save } from "~/../../shared/chromeStorage";
import TemplateSelect from "~/components/TemplateSelect/TemplateSelect";
import applyTemplate from "~/utils/applyTemplate";
import { Alert, Collapse, CollapseProps } from "antd";
import { TemplateContext } from "~/TemplateContext";
import { TemplateEntry } from "~/../../shared/types";

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
    save([], "importHeader");
    save([], "importData");
    save([], "importFooter");
    save([], "importTemplates");
    setTabs(["import"]);
  }

  function clearTextarea() {
    importDataRef!.current!.value = "";
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
        const response = await chrome.tabs.sendMessage(tab.id, data);

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
    save(importHeader, "importHeader");
    save(importData, "importData");
    save(importFooter, "importFooter");
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
      const mappingResult: { [key: string]: string } = {};
      const tagColumnsContent = tagColumnIndexes.map((index) => row[index]);
      // Split content of every tag column by space to search for every word
      tagColumnsContent.forEach((tagColumn, columnIndex) => {
        const tagWords = tagColumn.split(" ");
        // Count how many times each word occurs in the templateEntries and count them up
        tagWords.map((tagWord) => {
          if (tagWord === "") return;
          const templateEntriesWithTag = templateEntries.filter((entry) =>
            entry.templateName.toLowerCase().includes(tagWord.toLowerCase())
          );
          templateEntriesWithTag.map((entry) => {
            // Make the count increase for the first tag column +1, second tag column +2, third tag column +3 etc.
            const countIncrease = columnIndex + 1;
            mappingResult[entry.id] =
              (mappingResult[entry.id] ?? 0) + countIncrease;
          });
        });
      });
      // Get the key(template id) of the mappingResult which has the highest value
      const templateId = Object.keys(mappingResult).reduce((a, b) =>
        // TODO: We might have to handle the case when the mapping has the same value for multiple templates = no real highest value
        mappingResult[a] > mappingResult[b] ? a : b
      );
      // Assign the template id to the importTemplates
      importTemplateAssignment[rowIndex] = templateId;

      console.log(
        "Auto mapping template: Row " +
          rowIndex +
          ", TemplateId: " +
          templateId,
        tagColumnsContent,
        mappingResult
      );
    });

    // Save the auto mapped templates
    // TODO: Currently we just override already assigned templates, Clarify if we should ignore them ?!
    setImportTemplates(importTemplateAssignment);
    save(importTemplateAssignment, "importTemplates");
  }

  function loadImportData() {
    load<string>("importHeader").then((data) => {
      setImportHeader(data ?? []);
    });
    load<ImportRow>("importData").then((data) => {
      setImportData(data ?? []);
    });
    load<string>("importFooter").then((data) => {
      setImportFooter(data ?? []);
    });
    load<string>("importTemplates").then((data) => {
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
    save(importTemplatesCopy, "importTemplates");
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
