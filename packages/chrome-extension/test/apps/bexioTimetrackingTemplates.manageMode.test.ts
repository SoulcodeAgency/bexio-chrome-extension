import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";
import type { TemplateEntry } from "@bexio-chrome-extension/shared/types";

vi.mock("@bexio-chrome-extension/chrome-extension/src/apps/bexioTimetrackingTemplates/index", () => ({
  initializeExtension: vi.fn(async () => {}),
}));
vi.mock("@bexio-chrome-extension/chrome-extension/src/utils/fillForm", () => ({ default: vi.fn(async () => {}) }));

const template = (over: Partial<TemplateEntry> = {}): TemplateEntry => ({
  templateName: "Project Falcon",
  keywords: "",
  billable: false,
  contact: "Acme AG",
  contactPerson: "Doe Jane",
  id: "tmpl1",
  package: "Package Alpha",
  project: "Project Falcon",
  status: "In Arbeit",
  work: "",
  ...over,
});

const render = async (entries: TemplateEntry[]) => {
  const { default: renderHtml } =
    await import("@bexio-chrome-extension/chrome-extension/src/apps/bexioTimetrackingTemplates/renderHtml");
  await renderHtml(entries);
};

const manageButton = () => document.getElementById("ManageTemplates") as HTMLButtonElement;
const panelEl = () => document.getElementById("SoulcodeExtensionTemplates")!;
const deleteCross = (id: string) =>
  document.getElementById(id)!.closest(".template-chip")!.querySelector<HTMLButtonElement>(".template-chip-delete")!;

describe("manage mode", () => {
  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = "";
    loadFixture("monitoring-edit");
    await chrome.storage.local.set({ entries: [] });
  });

  it("Manage toggles the mode: class, label, Add disabled, toast cleared on exit", async () => {
    await render([template()]);
    manageButton().click();
    expect(panelEl().classList.contains("manage-mode")).toBe(true);
    expect(manageButton().textContent).toBe("Done");
    expect((document.getElementById("AddNewTemplate") as HTMLButtonElement).disabled).toBe(true);

    manageButton().click();
    expect(panelEl().classList.contains("manage-mode")).toBe(false);
    expect(manageButton().textContent).toBe("Manage");
    expect((document.getElementById("AddNewTemplate") as HTMLButtonElement).disabled).toBe(false);
  });

  it("clicking × in manage mode deletes from storage, removes the chip and offers Undo", async () => {
    const entry = template();
    await chrome.storage.local.set({ entries: [entry] });
    await render([entry]);
    manageButton().click();
    deleteCross("tmpl1").click();

    await vi.waitFor(async () => {
      expect(((await chrome.storage.local.get("entries")).entries as unknown[]).length).toBe(0);
    });
    expect(document.getElementById("tmpl1")).toBeNull();
    const toast = document.getElementById("SoulcodeExtensionToast")!;
    expect(toast.textContent).toContain('Deleted "Project Falcon"');
    expect(toast.querySelector("button")!.textContent).toBe("Undo");
  });

  it("Undo restores the entry and re-renders", async () => {
    const { initializeExtension } =
      await import("@bexio-chrome-extension/chrome-extension/src/apps/bexioTimetrackingTemplates/index");
    const entry = template();
    await chrome.storage.local.set({ entries: [entry] });
    await render([entry]);
    manageButton().click();
    deleteCross("tmpl1").click();
    await vi.waitFor(() => expect(document.getElementById("SoulcodeExtensionToast")).not.toBeNull());

    document.getElementById("SoulcodeExtensionToast")!.querySelector("button")!.click();
    await vi.waitFor(async () => {
      const stored = (await chrome.storage.local.get("entries")).entries as TemplateEntry[];
      expect(stored.map((e) => e.id)).toEqual(["tmpl1"]);
    });
    expect(vi.mocked(initializeExtension)).toHaveBeenCalled();
  });

  it("apply-clicks are inert in manage mode; leaving the mode hides the toast", async () => {
    const { default: fillForm } = await import("@bexio-chrome-extension/chrome-extension/src/utils/fillForm");
    const entries = [template(), template({ id: "tmpl2", templateName: "Globex GmbH" })];
    await chrome.storage.local.set({ entries });
    await render(entries);
    manageButton().click();

    (document.getElementById("tmpl2") as HTMLButtonElement).click();
    expect(vi.mocked(fillForm)).not.toHaveBeenCalled();

    deleteCross("tmpl1").click();
    await vi.waitFor(() => expect(document.getElementById("SoulcodeExtensionToast")).not.toBeNull());
    manageButton().click(); // Done → undo window ends
    expect(document.getElementById("SoulcodeExtensionToast")).toBeNull();
  });
});
