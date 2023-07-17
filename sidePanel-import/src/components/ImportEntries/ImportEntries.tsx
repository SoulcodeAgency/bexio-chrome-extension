import { useEffect, useRef, useState } from "react";
import "./ImportEntries.css";
import ImportEntriesTableCell from "./ImportEntriesTableCell";
import { load, save } from "../../../../shared/chromeStorage";

type ImportRow = string[];
type ImportData = ImportRow[];

function ImportEntries() {
  const [clipboardStatus, setClipboardStatus] = useState("");
  const [importHeader, setImportHeader] = useState<ImportRow>([]);
  const [importFooter, setImportFooter] = useState<ImportRow>([]);
  const [importData, setImportData] = useState<ImportData>([]);
  const importDataRef = useRef<HTMLTextAreaElement>(null);

  function resetImportState() {
    setImportHeader([]);
    setImportData([]);
    setImportFooter([]);
  }

  function removeImportData() {
    resetImportState();
    save([], "importHeader");
    save([], "importData");
    save([], "importFooter");
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

    console.log(importHeader);
    console.log(importData);
  }

  function applyImportEntry(date: string, timeAmount: string) {
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
        // do something with response here, not outside the function
        console.log(response);
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
  }

  useEffect(() => {
    loadImportData();
  }, []);

  return (
    <>
      <h2>Import entries</h2>
      <div className="content">
        <p>
          This lets you import entries from tools like <b>ManicTime</b> -
          directly from your clipboard. Use the "Copy to clipboard" function in
          ManicTime's TimeSheet Summary, and make sure you have columns for your
          tags. (e.g. Tag 1, Tag 2, Tag 3)
        </p>
        <p>Paste the data into the following field</p>
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
            Reload stored imported data
          </button>
          <button
            style={{ backgroundColor: "red", color: "white" }}
            onClick={removeImportData}
          >
            Delete imported data
          </button>

          <table className="importDataTable">
            <thead>
              <tr>
                <th>#</th>
                {importHeader.map((field) => (
                  <th key={field}>{field}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {importData.map((entry, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  {entry.map((entryField, index) => (
                    <ImportEntriesTableCell
                      columnHeader={importHeader[index]}
                      fieldValue={entryField}
                      key={entryField + index}
                      onButtonClick={() =>
                        applyImportEntry(importHeader[index], entryField)
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
