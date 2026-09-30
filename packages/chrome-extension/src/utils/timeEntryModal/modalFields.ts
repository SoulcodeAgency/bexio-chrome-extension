import {
  getModalBillableToggle,
  getModalDateInput,
  getModalDurationInput,
  getModalRemarksEditor,
} from "../../selectors/timeEntryModal";

/**
 * Plain field writes into the new time entry dialog (#168). The dialog is Angular: its inputs are
 * bound through `ControlValueAccessor`s that read the DOM value on `input` (and the datepicker also
 * on `change` / `blur`). Setting `.value` alone would only change what is displayed, so every write
 * is followed by those events. DOM events cross from the content script's isolated world to the
 * page's listeners; JS objects do not, which is why nothing here touches Angular itself.
 *
 * Each setter throws when its field is missing, so `onMessage` can answer `{ ok: false }` rather
 * than claim an entry was applied.
 */

function writeInput(input: HTMLInputElement, value: string) {
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.dispatchEvent(new Event("blur"));
  input.dispatchEvent(new Event("focusout", { bubbles: true }));
}

/** `dd.MM.yyyy`, the format the datepicker parses. ManicTime's headers also come as `dd/MM/yyyy`. */
export function toModalDate(value: string): string {
  return value.trim().replace(/\//g, ".");
}

/** `hh:mm` — the duration input has `maxlength=5`, so a one-digit hour is padded. */
export function toModalDuration(value: string): string {
  const [hours = "0", minutes = "0"] = value.trim().split(":");
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
}

export async function setModalDate(value: string): Promise<void> {
  const input = getModalDateInput();
  if (!input) throw new Error("The date field of the time entry dialog was not found.");
  writeInput(input, toModalDate(value));
}

export async function setModalDuration(value: string): Promise<void> {
  const input = getModalDurationInput();
  if (!input) throw new Error("The duration field of the time entry dialog was not found.");
  writeInput(input, toModalDuration(value));
}

// Whitespace-free: `textContent` joins paragraphs without a separator.
const withoutWhitespace = (text: string) => text.replace(/\s+/g, "");

/**
 * Replaces the remarks. The editor is ngx-editor (ProseMirror), which keeps its own document model:
 * the text goes in through `document.execCommand("insertText")` on a selection spanning the whole
 * editor — that is an edit ProseMirror handles like typing, and bexio's character counter follows
 * it. Lines become paragraphs.
 *
 * Where `execCommand` is not available or did not produce the text, the paragraphs are written into
 * the DOM directly; ProseMirror's DOM observer reads such changes back into its model.
 */
export async function setModalRemarks(text: string): Promise<void> {
  const editor = getModalRemarksEditor();
  if (!editor) throw new Error("The remarks field of the time entry dialog was not found.");
  const lines = text.split(/\r?\n/);

  editor.focus();
  if (typeof document.execCommand === "function") {
    const range = document.createRange();
    range.selectNodeContents(editor);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    if (text === "") {
      document.execCommand("delete");
    }
    lines.forEach((line, index) => {
      if (index > 0) document.execCommand("insertParagraph");
      if (line !== "") document.execCommand("insertText", false, line);
    });
  }

  if (withoutWhitespace(editor.textContent ?? "") !== withoutWhitespace(text)) {
    editor.replaceChildren(
      ...lines.map((line) => {
        const paragraph = document.createElement("p");
        paragraph.textContent = line;
        return paragraph;
      }),
    );
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

/** Sets "verrechenbar". `undefined` leaves the toggle as it is. */
export async function setModalBillable(checked: boolean | undefined): Promise<void> {
  if (typeof checked !== "boolean") return;
  const toggle = getModalBillableToggle();
  if (!toggle) throw new Error('The "verrechenbar" toggle of the time entry dialog was not found.');
  // A click, not `.checked =`: the toggle's Angular handler listens for the click.
  if (toggle.checked !== checked) toggle.click();
}
