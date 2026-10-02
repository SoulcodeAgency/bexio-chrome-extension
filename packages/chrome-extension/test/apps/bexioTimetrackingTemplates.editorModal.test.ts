/**
 * The Templates block in bexio's new time entry dialog (#168): injected as a column next to the
 * dialog's form whenever a dialog opens, applying a template through `fillForm` → `fillEditorModal`,
 * and the "saved" report for the side panel.
 *
 * Runs the real content-script entry (`index.ts`, which initialises itself at import) against the
 * synthetic dialog fixture; `fakeMatSelect.ts` stands in for Angular Material.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getChromeFake } from "../../../../test/support/chrome-fake";
import { loadFixture } from "../support/load-fixture";
import { installFakeMatSelects } from "../support/fakeMatSelect";
import { removeResourceObserver } from "../support/fakeResourceObserver";
import type { TemplateEntry } from "@bexio-chrome-extension/shared/types";

const TEMPLATE: TemplateEntry = {
  id: "tmpl1",
  templateName: "Website",
  keywords: "",
  work: "Entwicklung",
  status: "In Arbeit",
  contact: "Muster AG",
  project: "Muster AG - Website",
  package: "",
  contactPerson: "Max Muster",
  billable: false,
};

const OPTIONS = {
  activity: ["Beratung", "Entwicklung"],
  status: ["In Arbeit", "Offen"],
  contact: ["Muster AG"],
  project: ["Muster AG - Website"],
  "sub-contact": ["Muster Max"],
};

let resetWatchers: (() => void)[] = [];

async function loadContentScript() {
  const column =
    await import("@bexio-chrome-extension/chrome-extension/src/apps/bexioTimetrackingTemplates/editorModalColumn");
  const save = await import("@bexio-chrome-extension/chrome-extension/src/eventListeners/onFormSubmit");
  resetWatchers = [column.resetEditorModalWatcher, save.resetEditorModalSaveWatcher];
  await import("@bexio-chrome-extension/chrome-extension/src/apps/bexioTimetrackingTemplates/index");
}

const panel = () => document.getElementById("SoulcodeExtensionTemplates");
const dialogWrapper = () => document.querySelector(".cdk-global-overlay-wrapper")!;

beforeEach(async () => {
  vi.resetModules();
  document.body.innerHTML = "";
  loadFixture("time-tracking-modal.synthetic");
  await chrome.storage.local.set({ entries: [TEMPLATE] });
  // No wait for bexio's contact → projects request (test/utils/timeEntryModal.test.ts covers it).
  removeResourceObserver();
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetWatchers.forEach((reset) => reset());
  resetWatchers = [];
});

describe("Templates column in the time entry dialog", () => {
  it("renders the Templates block as a column next to bexio's form, and widens the dialog", async () => {
    await loadContentScript();
    await vi.waitFor(() => expect(panel()).not.toBeNull());

    const modal = document.querySelector("mat-dialog-container .time-entries-dialog--editor")!;
    const column = modal.nextElementSibling!;
    expect(column.id).toBe("SoulcodeExtensionModalColumn");
    expect(column.contains(panel())).toBe(true);
    expect(panel()!.classList.contains("template-panel--modal")).toBe(true);
    expect(modal.parentElement!.classList.contains("soulcode-modal-with-templates")).toBe(true);
    expect(modal.closest(".cdk-overlay-pane")!.classList.contains("soulcode-modal-pane")).toBe(true);
    expect(Array.from(panel()!.querySelectorAll("button.template-button")).map((b) => b.id)).toEqual(["tmpl1"]);
  });

  it("renders again into every dialog that opens later", async () => {
    await loadContentScript();
    await vi.waitFor(() => expect(panel()).not.toBeNull());

    dialogWrapper().remove();
    await vi.waitFor(() => expect(panel()).toBeNull());
    loadFixture("time-tracking-modal.synthetic"); // bexio opens the next dialog

    await vi.waitFor(() => expect(panel()).not.toBeNull());
    expect(document.querySelector("mat-dialog-container .time-entries-dialog--editor")!.nextElementSibling!.id).toBe(
      "SoulcodeExtensionModalColumn",
    );
  });

  it("keeps keys typed into the column away from the dialog (Escape would close it)", async () => {
    await loadContentScript();
    await vi.waitFor(() => expect(panel()).not.toBeNull());
    const reachedDocument = vi.fn();
    document.addEventListener("keydown", reachedDocument);

    document
      .getElementById("templateFilter")!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    document.removeEventListener("keydown", reachedDocument);
    expect(reachedDocument).not.toHaveBeenCalled();
  });

  it("applies a template to the dialog on a click and hides the loader again", async () => {
    const { log } = installFakeMatSelects({ options: OPTIONS });
    await loadContentScript();
    await vi.waitFor(() => expect(panel()).not.toBeNull());

    document.getElementById("tmpl1")!.click();

    await vi.waitFor(() => expect(log).toContain("select:sub-contact:Muster Max"), { timeout: 5000 });
    expect(log.filter((entry) => entry.startsWith("select:"))).toEqual([
      "select:activity:Entwicklung",
      "select:status:In Arbeit",
      "select:contact:Muster AG",
      "select:project:Muster AG - Website",
      "select:sub-contact:Muster Max",
    ]);
    await vi.waitFor(() => expect(document.getElementById("SoulcodeExtensionLoader")!.style.display).toBe("none"));
  });
});

describe("saving the time entry dialog", () => {
  let sendMessage: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sendMessage = vi.spyOn(getChromeFake().runtime, "sendMessage").mockImplementation(async () => undefined);
  });

  const saveButton = () =>
    Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "Eintrag speichern")!;

  it('reports form-submitted once the dialog closes after a click on "Eintrag speichern"', async () => {
    await loadContentScript();
    saveButton().disabled = false;

    saveButton().click();
    expect(sendMessage).not.toHaveBeenCalled();
    dialogWrapper().remove();

    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith({ mode: "form-submitted" }));
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('reports nothing for "Abbrechen"', async () => {
    await loadContentScript();

    Array.from(document.querySelectorAll("button"))
      .find((b) => b.textContent === "Abbrechen")!
      .click();
    dialogWrapper().remove();
    await new Promise((resolve) => setTimeout(resolve, 600));

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("reports nothing while the dialog stays open — bexio rejected the entry", async () => {
    await loadContentScript();
    vi.useFakeTimers();
    try {
      saveButton().disabled = false;
      saveButton().click();
      await vi.advanceTimersByTimeAsync(20_000);
    } finally {
      vi.useRealTimers();
    }
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
