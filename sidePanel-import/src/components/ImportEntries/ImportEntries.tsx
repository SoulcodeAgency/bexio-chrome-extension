import { useRef, useState } from "react";
// import loadLocalImportEntries from "../../../../shared/loadLocalImportEntries.js";
// import { TemplateEntry } from "../../../../types.js";
import "./ImportEntries.css";

type ImportHeader = string[];
type ImportData = string[][];

function ImportEntries() {
  const [clipboardStatus, setClipboardStatus] = useState("");
  const [importHeaders, setImportHeaders] = useState<ImportHeader>([]);
  const [importData, setImportData] = useState<ImportData>([]);
  const importDataRef = useRef<HTMLTextAreaElement>(null);

  function resetImportState() {
    setImportHeaders([]);
    setImportData([]);
  }

  function convertImportData(csvString: string) {
    const rows = csvString.split("\n");
    const importHeaders = rows[0].split("\t");

    if (importHeaders.find((column) => column === "Tag 1") === undefined) {
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
      .map((row) => row.replace(/\r/g, ""))
      .map((row: string) => row.split("\t"));

    setImportHeaders(importHeaders);
    setImportData(importData);

    console.log(importHeaders);
    console.log(importData);
  }

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
        <button onClick={() => (importDataRef!.current!.value = "")}>
          Clear textarea
        </button>

        {clipboardStatus && (
          <div className="error">
            <p>Error: {clipboardStatus}</p>
          </div>
        )}

        <h3>Imported data</h3>
        <button onClick={() => resetImportState()}>Clear imported data</button>
        <div className="content">
          <table className="importDataTable">
            <thead>
              <tr>
                <th>#</th>
                {importHeaders.map((field) => (
                  <th key={field}>{field}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {importData.map((entry, index) => (
                <tr key={index}>
                  {index !== importData.length - 1 ? (
                    <td>{index + 1}</td>
                  ) : (
                    <td></td>
                  )}
                  {entry.map((entryField, index) => (
                    <td key={entryField + index}>
                      {entryField}
                      {/*
                      we need to be carefull with inputs and keeping state in sync
                      <input
                        key={"input_" + entryField + index}
                        defaultValue={entryField}
                      /> */}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default ImportEntries;
