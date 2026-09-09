import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";
import type { TemplateEntry } from "@bexio-chrome-extension/shared/types";

vi.mock("@bexio-chrome-extension/chrome-extension/src/apps/bexioTimetrackingTemplates/index", () => ({
  initializeExtension: vi.fn(async () => {}),
}));
vi.mock("@bexio-chrome-extension/chrome-extension/src/utils/fillForm", () => ({ default: vi.fn(async () => {}) }));

const render = async (entries: TemplateEntry[]) => {
  const { default: renderHtml } =
    await import("@bexio-chrome-extension/chrome-extension/src/apps/bexioTimetrackingTemplates/renderHtml");
  await renderHtml(entries);
};

const openForm = async () => {
  (document.getElementById("AddNewTemplate") as HTMLButtonElement).click();
  await vi.waitFor(() => {
    expect((document.getElementById("SoulcodeExtensionAddForm") as HTMLElement).hidden).toBe(false);
    // The form is shown first and the suggested name filled in afterwards, so a
    // failing read cannot leave "+ Add" looking dead — wait for the suggestion.
    expect(nameInput().value).not.toBe("");
  });
};
const nameInput = () => document.getElementById("templateNameInput") as HTMLInputElement;
const errorEl = () => document.getElementById("templateNameError") as HTMLElement;
const save = () => (document.getElementById("templateNameSave") as HTMLButtonElement).click();

describe("inline add form", () => {
  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = "";
    loadFixture("monitoring-edit-filled");
    await chrome.storage.local.set({ entries: [] });
  });

  it("opens with the suggested name pre-filled ('Misc' from the filled fixture's package)", async () => {
    await render([]);
    await openForm();
    expect(nameInput().value).toBe("Misc");
  });

  it("saves a template and re-renders; no prompt() involved", async () => {
    const { initializeExtension } =
      await import("@bexio-chrome-extension/chrome-extension/src/apps/bexioTimetrackingTemplates/index");
    await render([]);
    await openForm();
    nameInput().value = "My Inline Template";
    save();
    await vi.waitFor(async () => {
      const stored = await chrome.storage.local.get("entries");
      expect((stored.entries as Array<{ templateName: string }>).map((e) => e.templateName)).toEqual([
        "My Inline Template",
      ]);
    });
    expect(vi.mocked(initializeExtension)).toHaveBeenCalled();
  });

  it("shows an inline error on empty name and on duplicate", async () => {
    await render([]);
    await openForm();
    nameInput().value = "   ";
    save();
    await vi.waitFor(() => expect(errorEl().hidden).toBe(false));
    expect(errorEl().textContent).toBe("Please enter a name for the template.");

    nameInput().value = "Twice";
    save();
    await vi.waitFor(async () =>
      expect(((await chrome.storage.local.get("entries")).entries as unknown[]).length).toBe(1),
    );
    await openForm(); // re-open (save closed it)
    nameInput().value = "Twice"; // same name + same form values → duplicate
    save();
    await vi.waitFor(() => expect(errorEl().hidden).toBe(false));
    expect(errorEl().textContent).toBe(
      "A template with this name and these values already exists — pick a different name.",
    );
  });

  // Regression: reading the bexio form can throw (a select2 widget that is not
  // where readTextFromSelect2 expects it). That must not leave "+ Add" as a
  // button that does nothing at all — no form, no message.
  it("still opens the form, with an explanation, when the bexio form cannot be read", async () => {
    vi.doMock("@bexio-chrome-extension/chrome-extension/src/utils/readCurrentFormValues", () => ({
      readCurrentFormValues: vi.fn(async () => {
        throw new Error("select2 markup changed");
      }),
      suggestTemplateName: vi.fn(() => "unused"),
    }));
    try {
      await render([]);
      (document.getElementById("AddNewTemplate") as HTMLButtonElement).click();

      await vi.waitFor(() => expect(errorEl().hidden).toBe(false));
      expect((document.getElementById("SoulcodeExtensionAddForm") as HTMLElement).hidden).toBe(false);
      expect(errorEl().textContent).toBe("Could not read the form — type a name yourself.");
    } finally {
      vi.doUnmock("@bexio-chrome-extension/chrome-extension/src/utils/readCurrentFormValues");
    }
  });

  it("Escape closes the form without saving", async () => {
    await render([]);
    await openForm();
    nameInput().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect((document.getElementById("SoulcodeExtensionAddForm") as HTMLElement).hidden).toBe(true);
    expect(((await chrome.storage.local.get("entries")).entries as unknown[] | undefined) ?? []).toHaveLength(0);
  });
});
