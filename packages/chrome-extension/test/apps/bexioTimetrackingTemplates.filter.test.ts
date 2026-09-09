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

const input = () => document.getElementById("templateFilter") as HTMLInputElement;
const reset = () => document.getElementById("templateFilterReset") as HTMLButtonElement;
const empty = () => document.getElementById("templateFilterEmpty") as HTMLElement;
const chipFor = (id: string) => document.getElementById(id)!.closest(".template-chip") as HTMLElement;
const type = (value: string) => {
  input().value = value;
  input().dispatchEvent(new Event("input", { bubbles: true }));
};
const key = (k: string) => input().dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

describe("template filter", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
    loadFixture("monitoring-edit");
  });

  it("matches against keywords, not only the name", async () => {
    await render([template(), template({ id: "tmpl2", templateName: "Globex GmbH", keywords: "zebra invoicing" })]);
    type("zebra");
    expect(chipFor("tmpl1").hidden).toBe(true);
    expect(chipFor("tmpl2").hidden).toBe(false);
  });

  it("shows the empty state with the query when nothing matches, and hides it again", async () => {
    await render([template()]);
    type("nomatch");
    expect(empty().hidden).toBe(false);
    expect(empty().textContent).toBe('No templates match "nomatch"');
    type("falcon");
    expect(empty().hidden).toBe(true);
  });

  it("Escape clears the filter", async () => {
    await render([template(), template({ id: "tmpl2", templateName: "Globex GmbH" })]);
    type("falcon");
    expect(chipFor("tmpl2").hidden).toBe(true);
    key("Escape");
    expect(input().value).toBe("");
    expect(chipFor("tmpl2").hidden).toBe(false);
  });

  it("Enter applies the single visible match — and does nothing with several", async () => {
    const { default: fillForm } = await import("@bexio-chrome-extension/chrome-extension/src/utils/fillForm");
    await render([template(), template({ id: "tmpl2", templateName: "Globex GmbH" })]);
    type("template"); // matches neither → 0 visible
    key("Enter");
    type(""); // both visible
    key("Enter");
    expect(vi.mocked(fillForm)).not.toHaveBeenCalled();

    type("globex"); // exactly one
    key("Enter");
    expect(vi.mocked(fillForm)).toHaveBeenCalledWith("tmpl2");
    expect(document.getElementById("tmpl2")!.classList.contains("template-button--active")).toBe(true);
  });

  it("clear button resets and is only visible while filtering", async () => {
    await render([template()]);
    expect(reset().hidden).toBe(true);
    type("fal");
    expect(reset().hidden).toBe(false);
    reset().click();
    expect(input().value).toBe("");
    expect(reset().hidden).toBe(true);
  });
});
