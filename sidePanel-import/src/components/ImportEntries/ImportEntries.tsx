import { useEffect, useRef, useState } from "react";
import "./ImportEntries.css";
import ImportEntriesTableCell from "./ImportEntriesTableCell";
import { load, save } from "~/../../shared/chromeStorage";
import TemplateSelect from "~/components/TemplateSelect/TemplateSelect";
import applyTemplate from "~/utils/applyTemplate";

type ImportRow = string[];
type ImportData = ImportRow[];

function ImportEntries() {
  const [clipboardStatus, setClipboardStatus] = useState("");
  const [importHeader, setImportHeader] = useState<ImportRow>([]);
  const [importFooter, setImportFooter] = useState<ImportRow>([]);
  const [importData, setImportData] = useState<ImportData>([]);
  const [importTemplates, setImportTemplates] = useState<string[]>([]);
  const importDataRef = useRef<HTMLTextAreaElement>(null);

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
        const response = await chrome.tabs.sendMessage(tab.id, {
          mode: "time+duration",
          duration: timeAmount,
          date: date,
        });

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

  return (
    <>
      <h2>ManicTime import</h2>
      <div className="content">
        <p>
          This lets you import entries from <b>ManicTime</b> - directly from
          your clipboard. Use the "Copy to clipboard" function in ManicTime's
          TimeSheet Summary, and make sure you have at least a "Tag 1" column.
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

        {clipboardStatus && (
          <div className="error">
            <p>Error: {clipboardStatus}</p>
          </div>
        )}

        <h3>Imported data</h3>
        <div className="content">
          <p>Note: You can also save the imported data for later use.</p>
          <button
            style={{ backgroundColor: "#4291a8", color: "white" }}
            onClick={saveImport}
          >
            Save this import
          </button>
          <button
            style={{ backgroundColor: "#3276b4", color: "white" }}
            onClick={loadImportData}
          >
            Reload imported data from storage
          </button>
          <button
            style={{ backgroundColor: "red", color: "white" }}
            onClick={removeImportData}
          >
            Delete imported data
          </button>

          <ol>
            <li>
              Select the <strong>template</strong> to use for every row
              (templates will be saved automatically)
            </li>
            <li>Click on the ▶️-button next to the time you want to track</li>
            <li>
              Date, Time and if selected also the Template will magically fill
              the form. 🥳
            </li>
          </ol>
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
                {importFooter.map((field, index) => (
                  <td key={importHeader[index]}>{field}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default ImportEntries;
