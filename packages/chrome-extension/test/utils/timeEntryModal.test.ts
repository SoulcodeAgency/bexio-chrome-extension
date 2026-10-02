/**
 * bexio's new time entry dialog (#168): selectors, `selectMatOption`, the field setters and the
 * dialog operations the side panel and the Templates block use.
 *
 * The fixture is **synthetic** (see `time-tracking-modal.synthetic.md`) and
 * `test/support/fakeMatSelect.ts` stands in for Angular Material. These tests therefore pin what the
 * extension does to that DOM; whether bexio's Angular model accepts it is the manual check in
 * docs/architecture/testing.md.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";
import { installFakeMatSelects, FakeMatSelectOptions } from "../support/fakeMatSelect";
import {
  getCreateTimeEntryButton,
  getEditorModalTitle,
  getLiveSelectPanel,
  getModalBillableToggle,
  getModalDateInput,
  getModalDurationInput,
  getModalRemarksEditor,
  getModalSaveButton,
  getModalSelect,
  getOpenEditorModal,
  hasMonitoringForm,
  isEditModal,
  isModalSelectEnabled,
  readModalSelectText,
} from "../../src/selectors/timeEntryModal";
import selectMatOption, { SEARCH_FALLBACK_AFTER_MS } from "../../src/utils/timeEntryModal/selectMatOption";
import {
  setModalBillable,
  setModalDate,
  setModalDuration,
  setModalRemarks,
  toModalDate,
  toModalDuration,
} from "../../src/utils/timeEntryModal/modalFields";
import {
  applyEntryToEditorModal,
  EDIT_MODAL_OPEN_MESSAGE,
  ensureEditorModal,
  fillEditorModal,
  readEditorModalValues,
  submitEditorModal,
} from "../../src/utils/timeEntryModal/editorModal";
import { WaitForTimeoutError } from "../../src/utils/pollUntil";
import { VALUE_WAIT_BUDGET_MS } from "../../src/utils/waitForSelectOptions";
import { TemplateEntry } from "@bexio-chrome-extension/shared/types";

const OPTIONS: FakeMatSelectOptions["options"] = {
  activity: ["Beratung", "Entwicklung", "Entwicklung extern"],
  status: ["Erledigt", "Fakturiert", "Geschlossen", "In Arbeit", "Offen"],
  contact: ["Beispiel GmbH", "Muster AG", "Muster AG Zürich"],
  project: ["Muster AG - Website", "Muster AG - Intranet"],
  "work-package": ["Konzept", "Umsetzung"],
  "sub-contact": ["Muster Max", "Beispiel Erika"],
};

const TEMPLATE: TemplateEntry = {
  id: "t1",
  templateName: "Website",
  keywords: "",
  work: "Entwicklung",
  status: "In Arbeit",
  contact: "Muster AG",
  project: "Muster AG - Website",
  package: "Umsetzung",
  // Stored by the old form as "Firstname Lastname"; the dialog lists "Lastname Firstname".
  contactPerson: "Erika Beispiel",
  billable: false,
};

function setup(config: Partial<FakeMatSelectOptions> = {}) {
  loadFixture("time-tracking-modal.synthetic");
  return installFakeMatSelects({ options: OPTIONS, ...config });
}

const select = (key: Parameters<typeof getModalSelect>[0]) => getModalSelect(key)!;

/** Runs `promise` to completion under fake timers. */
async function settle<T>(promise: Promise<T>, ms = 30_000): Promise<T> {
  let result: { value: T } | { error: unknown } | undefined;
  promise.then(
    (value) => (result = { value }),
    (error: unknown) => (result = { error }),
  );
  await vi.advanceTimersByTimeAsync(ms);
  if (!result) throw new Error("promise did not settle");
  if ("error" in result) throw result.error;
  return result.value;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("time entry dialog selectors", () => {
  beforeEach(() => setup());

  it("tell the new UI from the old monitoring/edit page", () => {
    expect(hasMonitoringForm()).toBe(false);
  });

  it("find the open dialog and read its title", () => {
    const modal = getOpenEditorModal()!;
    expect(modal.classList.contains("time-entries-dialog--editor")).toBe(true);
    expect(getEditorModalTitle(modal)).toBe("Neue Zeiterfassung");
    expect(isEditModal(modal)).toBe(false);
  });

  it("recognise the edit dialog by its title", () => {
    getOpenEditorModal()!.querySelector("h2")!.textContent = "Zeiterfassung bearbeiten";
    expect(isEditModal(getOpenEditorModal()!)).toBe(true);
  });

  it("resolve every field through data-for-test (the date through its datepicker)", () => {
    for (const key of ["activity", "status", "contact", "project", "sub-contact", "work-package"] as const) {
      expect(select(key).tagName.toLowerCase(), key).toBe("mat-select");
    }
    expect(getModalDurationInput()!.maxLength).toBe(5);
    expect(getModalDateInput()!.value).toBe("30.09.2026");
    expect(getModalRemarksEditor()!.classList.contains("ProseMirror")).toBe(true);
    expect(getModalBillableToggle()!.checked).toBe(true);
    expect(getModalSaveButton()!.textContent).toBe("Eintrag speichern");
    expect(getCreateTimeEntryButton()!.textContent!.trim()).toBe("Zeit erfassen");
  });

  it("read a select's value, and nothing while it shows its placeholder", () => {
    expect(readModalSelectText(select("sub-contact"))).toBe("Muster Max");
    expect(readModalSelectText(select("activity"))).toBe("");
  });

  it("see Projekt and Arbeitspaket disabled until their parent is set", () => {
    expect(isModalSelectEnabled(select("contact"))).toBe(true);
    expect(isModalSelectEnabled(select("project"))).toBe(false);
    expect(isModalSelectEnabled(select("work-package"))).toBe(false);
  });

  it("take the last panel of an id: closed panels stay in the overlay with the same id", async () => {
    const trigger = select("status").querySelector<HTMLElement>(".mat-mdc-select-trigger")!;
    trigger.click();
    const first = getLiveSelectPanel(select("status"));
    select("status").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(getLiveSelectPanel(select("status"))).toBeNull();

    trigger.click();
    const second = getLiveSelectPanel(select("status"))!;
    expect(document.querySelectorAll(`[id="${second.id}"]`)).toHaveLength(2);
    expect(second).not.toBe(first);
    expect(second).toBe(document.querySelectorAll(`[id="${second.id}"]`)[1]);
  });
});

describe("selectMatOption", () => {
  it("opens the field, clicks the matching option and waits until the field shows it", async () => {
    const { log } = setup();

    await settle(selectMatOption("status", "In Arbeit"));

    expect(log).toEqual(["open:status", "select:status:In Arbeit"]);
    expect(readModalSelectText(select("status"))).toBe("In Arbeit");
  });

  it("prefers the exact option over an earlier one that merely contains the value", async () => {
    setup();
    await settle(selectMatOption("contact", "Muster AG"));
    expect(readModalSelectText(select("contact"))).toBe("Muster AG");
  });

  it("matches a person whatever the order of first and last name", async () => {
    const { log } = setup();
    await settle(selectMatOption("sub-contact", "Erika Beispiel"));
    expect(log).toContain("select:sub-contact:Beispiel Erika");
  });

  it("ignores stale panels with the same id", async () => {
    const { log } = setup();
    await settle(selectMatOption("status", "Offen"));
    await settle(selectMatOption("status", "Erledigt"));
    expect(log).toEqual(["open:status", "select:status:Offen", "open:status", "select:status:Erledigt"]);
    expect(readModalSelectText(select("status"))).toBe("Erledigt");
  });

  it("does nothing for an empty value, and nothing when the field already shows the value", async () => {
    const { log } = setup();
    await settle(selectMatOption("status", ""));
    await settle(selectMatOption("status", null));
    await settle(selectMatOption("sub-contact", "Muster Max"));
    expect(log).toEqual([]);
  });

  it("waits for a dependent field to be enabled and for its options to load", async () => {
    const { log } = setup({ enableDelayMs: 700, loadDelayMs: { project: 900 } });

    await settle(selectMatOption("contact", "Muster AG"), 0);
    const project = selectMatOption("project", "Muster AG - Website");
    await vi.advanceTimersByTimeAsync(500);
    expect(log).toEqual(["open:contact", "select:contact:Muster AG"]); // still disabled

    await settle(project);
    expect(readModalSelectText(select("project"))).toBe("Muster AG - Website");
  });

  it("types the value's first word into the search when the full list does not hold it", async () => {
    const { log } = setup({ serverSearch: ["contact"] });

    await settle(selectMatOption("contact", "Muster AG Zürich"));

    expect(log).toEqual(["open:contact", "select:contact:Muster AG Zürich"]);
    const search = document.querySelector<HTMLInputElement>(".mat-select-search-inner input")!;
    expect(search.value).toBe("muster");
  });

  it("gives up with a WaitForTimeoutError when the value is not among the options, and closes the panel", async () => {
    setup();
    const attempt = selectMatOption("project", "Gibt es nicht");
    // Projekt is disabled without a contact: the wait for it is what times out here.
    await expect(settle(attempt)).rejects.toBeInstanceOf(WaitForTimeoutError);

    const statusAttempt = selectMatOption("status", "Gibt es nicht");
    const error = await settle(statusAttempt, VALUE_WAIT_BUDGET_MS + SEARCH_FALLBACK_AFTER_MS).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(WaitForTimeoutError);
    expect(String(error)).toContain('"Gibt es nicht" option in the "Status" field');
    expect(select("status").getAttribute("aria-expanded")).toBe("false");
  });
});

describe("dialog field setters", () => {
  it("normalise ManicTime's date and duration to the dialog's formats", () => {
    expect(toModalDate("01/07/2026")).toBe("01.07.2026");
    expect(toModalDate("01.07.2026")).toBe("01.07.2026");
    expect(toModalDuration("1:30")).toBe("01:30");
    expect(toModalDuration("10:05")).toBe("10:05");
  });

  it("write date and duration and dispatch the events Angular listens to", async () => {
    setup();
    const events: string[] = [];
    for (const type of ["input", "change", "blur"]) {
      getModalDurationInput()!.addEventListener(type, () => events.push(type));
    }

    await setModalDate("01/07/2026");
    await setModalDuration("1:30");

    expect(getModalDateInput()!.value).toBe("01.07.2026");
    expect(getModalDurationInput()!.value).toBe("01:30");
    expect(events).toEqual(["input", "change", "blur"]);
  });

  it("insert the remarks through execCommand where the browser has it", async () => {
    setup();
    const editor = getModalRemarksEditor()!;
    const commands: string[] = [];
    // jsdom has no execCommand; this one edits the DOM the way a browser's would for this editor.
    document.execCommand = vi.fn((command: string, _ui?: boolean, value?: string) => {
      commands.push(value === undefined ? command : `${command}:${value}`);
      if (command === "insertText") editor.lastElementChild!.textContent = value!;
      if (command === "insertParagraph") editor.appendChild(document.createElement("p"));
      return true;
    });
    const inputs: Event[] = [];
    editor.addEventListener("input", (event) => inputs.push(event));

    try {
      await setModalRemarks("First line\nSecond line");
    } finally {
      delete (document as { execCommand?: unknown }).execCommand;
    }

    expect(commands).toEqual(["insertText:First line", "insertParagraph", "insertText:Second line"]);
    expect(inputs).toHaveLength(0); // no DOM fallback
  });

  it("fall back to writing paragraphs when execCommand is not available", async () => {
    setup();
    await setModalRemarks("First line\nSecond line");
    const paragraphs = Array.from(getModalRemarksEditor()!.querySelectorAll("p")).map((p) => p.textContent);
    expect(paragraphs).toEqual(["First line", "Second line"]);
  });

  it("click the billable toggle only when its state differs, and leave it alone for undefined", async () => {
    setup();
    const toggle = getModalBillableToggle()!;
    const clicks = vi.fn();
    toggle.addEventListener("click", clicks);

    await setModalBillable(true);
    await setModalBillable(undefined);
    expect(clicks).not.toHaveBeenCalled();

    await setModalBillable(false);
    expect(clicks).toHaveBeenCalledTimes(1);
    expect(toggle.checked).toBe(false);
  });

  it("throw when their field is missing", async () => {
    document.body.innerHTML = "";
    await expect(setModalDate("01.07.2026")).rejects.toThrow(/date field/);
    await expect(setModalDuration("1:30")).rejects.toThrow(/duration field/);
    await expect(setModalRemarks("x")).rejects.toThrow(/remarks field/);
    await expect(setModalBillable(true)).rejects.toThrow(/verrechenbar/);
  });
});

describe("fillEditorModal", () => {
  it("applies a template in the dependency order: activity, status, contact → project → work package → person", async () => {
    const { log } = setup({ enableDelayMs: 300 });
    getModalSaveButton()!.disabled = false; // bexio enables it once the required fields are set

    await settle(fillEditorModal(TEMPLATE));

    expect(log.filter((entry) => entry.startsWith("select:"))).toEqual([
      "select:activity:Entwicklung",
      "select:status:In Arbeit",
      "select:contact:Muster AG",
      "select:project:Muster AG - Website",
      "select:work-package:Umsetzung",
      "select:sub-contact:Beispiel Erika",
    ]);
    expect(getModalBillableToggle()!.checked).toBe(false);
    expect(document.activeElement).toBe(getModalSaveButton());
  });

  it("skips the work package when the template has none, and lets the entry's billable flag win", async () => {
    const { log } = setup();

    await settle(fillEditorModal({ ...TEMPLATE, package: "" }, true));

    expect(log.some((entry) => entry.includes("work-package"))).toBe(false);
    expect(getModalBillableToggle()!.checked).toBe(true);
  });

  it("defaults billable to true for templates saved without it", async () => {
    setup();
    getModalBillableToggle()!.checked = false;
    const legacy = { ...TEMPLATE } as Partial<TemplateEntry>;
    delete legacy.billable;

    await settle(fillEditorModal(legacy as TemplateEntry));

    expect(getModalBillableToggle()!.checked).toBe(true);
  });
});

describe("ensureEditorModal", () => {
  function closeDialogAndReopenOnCreate() {
    const pane = document.querySelector(".cdk-global-overlay-wrapper")!;
    const html = pane.outerHTML;
    pane.remove();
    getCreateTimeEntryButton()!.addEventListener("click", () =>
      setTimeout(() => document.querySelector(".cdk-overlay-container")!.insertAdjacentHTML("beforeend", html), 300),
    );
  }

  it('clicks "Zeit erfassen" and waits for the dialog when none is open', async () => {
    setup();
    closeDialogAndReopenOnCreate();
    expect(getOpenEditorModal()).toBeNull();

    const modal = await settle(ensureEditorModal({ allowEdit: false }));

    expect(modal).toBe(getOpenEditorModal());
  });

  it("returns the open dialog without clicking anything", async () => {
    setup();
    const clicks = vi.fn();
    getCreateTimeEntryButton()!.addEventListener("click", clicks);

    await settle(ensureEditorModal({ allowEdit: false }));

    expect(clicks).not.toHaveBeenCalled();
  });

  it("refuses an open edit dialog for a ManicTime entry, accepts it for a template", async () => {
    setup();
    getOpenEditorModal()!.querySelector("h2")!.textContent = "Zeiterfassung bearbeiten";

    await expect(settle(ensureEditorModal({ allowEdit: false }))).rejects.toThrow(EDIT_MODAL_OPEN_MESSAGE);
    await expect(settle(ensureEditorModal({ allowEdit: true }))).resolves.toBe(getOpenEditorModal());
  });

  it('says so when the page has no "Zeit erfassen" button', async () => {
    document.body.innerHTML = "<div></div>";
    await expect(settle(ensureEditorModal({ allowEdit: true }))).rejects.toThrow(/Zeit erfassen/);
  });
});

describe("applyEntryToEditorModal", () => {
  it("writes date, duration, billable and notes", async () => {
    setup();

    await settle(
      applyEntryToEditorModal({ date: "02.07.2026", duration: "2:15", billable: false, notes: "Did stuff" }),
    );

    expect(getModalDateInput()!.value).toBe("02.07.2026");
    expect(getModalDurationInput()!.value).toBe("02:15");
    expect(getModalBillableToggle()!.checked).toBe(false);
    expect(getModalRemarksEditor()!.textContent).toBe("Did stuff");
  });

  it("leaves the remarks alone when no notes are given", async () => {
    setup();
    getModalRemarksEditor()!.innerHTML = "<p>kept</p>";

    await settle(applyEntryToEditorModal({ date: "02.07.2026", duration: "2:15" }));

    expect(getModalRemarksEditor()!.textContent).toBe("kept");
  });
});

describe("readEditorModalValues", () => {
  it("reads the dialog into the fields of a template, the contact cut to two words", async () => {
    setup();
    await settle(fillEditorModal({ ...TEMPLATE, contact: "Muster AG Zürich" }));

    await expect(readEditorModalValues()).resolves.toEqual({
      work: "Entwicklung",
      status: "In Arbeit",
      contact: "Muster AG",
      contactPerson: "Beispiel Erika",
      project: "Muster AG - Website",
      package: "Umsetzung",
      billable: false,
    });
  });

  it("throws when no dialog is open", async () => {
    document.body.innerHTML = "";
    await expect(readEditorModalValues()).rejects.toThrow(/No time entry dialog/);
  });
});

describe("submitEditorModal", () => {
  function prepare(duration: string, enabled: boolean) {
    setup();
    getModalDurationInput()!.value = duration;
    getModalSaveButton()!.disabled = !enabled;
    const clicks = vi.fn();
    getModalSaveButton()!.addEventListener("click", clicks);
    return clicks;
  }

  it('clicks "Eintrag speichern"', () => {
    const clicks = prepare("01:30", true);
    submitEditorModal();
    expect(clicks).toHaveBeenCalledTimes(1);
  });

  it.each(["", "00:00", "0:00"])("refuses the empty duration %j", (duration) => {
    const clicks = prepare(duration, true);
    expect(() => submitEditorModal()).toThrow(/duration is empty/);
    expect(clicks).not.toHaveBeenCalled();
  });

  it("refuses while bexio keeps the button disabled", () => {
    const clicks = prepare("01:30", false);
    expect(() => submitEditorModal()).toThrow(/required field is missing/);
    expect(clicks).not.toHaveBeenCalled();
  });

  it("refuses without a dialog", () => {
    document.body.innerHTML = "";
    expect(() => submitEditorModal()).toThrow(/No time entry dialog/);
  });
});
