import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";
import type { TemplateEntry } from "@bexio-chrome-extension/shared/types";

// Mocked because the real module calls initializeExtension() at import time
// (see docs/architecture/form-layer.md § "Module-load quirk"), which would
// re-render the whole template UI while a test is setting it up.
vi.mock("@bexio-chrome-extension/chrome-extension/src/apps/bexioTimetrackingTemplates/index", () => ({
  initializeExtension: vi.fn(async () => {}),
}));

// fillForm drives the real bexio widgets; here we only care that the click
// handler still reaches it with the clicked button's id.
vi.mock("@bexio-chrome-extension/chrome-extension/src/utils/fillForm", () => ({
  default: vi.fn(async () => {}),
}));

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

const importRenderHtml = async () =>
  (await import("@bexio-chrome-extension/chrome-extension/src/apps/bexioTimetrackingTemplates/renderHtml")).default;

const entriesContainer = () => document.getElementById("bexioTimetrackingTemplates-entries")!;

describe("bexioTimetrackingTemplates renderHtml", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
    loadFixture("monitoring-edit");
  });

  it("renders one button per template with the name as text and the id as the element id", async () => {
    const renderHtml = await importRenderHtml();
    await renderHtml([template(), template({ id: "tmpl2", templateName: "Globex GmbH" })]);

    const buttons = entriesContainer().querySelectorAll("button.entry");
    expect(buttons).toHaveLength(2);
    expect(Array.from(buttons).map((b) => b.id)).toEqual(["tmpl1", "tmpl2"]);
    expect(Array.from(buttons).map((b) => b.textContent)).toEqual(["Project Falcon", "Globex GmbH"]);
    expect(buttons[0].className).toBe("entry btn btn-info template-button");
    expect((buttons[0] as HTMLButtonElement).type).toBe("button");
  });

  it("falls back to the id as the display name for legacy (pre-v0.5.x) entries", async () => {
    const legacy = template({ id: "LegacyName" });
    delete (legacy as Partial<TemplateEntry>).templateName;
    const renderHtml = await importRenderHtml();
    await renderHtml([legacy]);

    expect(entriesContainer().querySelector("button.entry")!.textContent).toBe("LegacyName");
  });

  // Regression: template names come from bexio field values, the prompt() in
  // readFormData and the side panel's modal — none of them sanitised. They must
  // never be parsed as HTML (#85).
  it("does not parse markup in a template name — it is rendered as literal text", async () => {
    const evil = '<img src=x onerror="alert(1)"><button id="fake">pwned</button>';
    const renderHtml = await importRenderHtml();
    await renderHtml([template({ templateName: evil })]);

    const container = entriesContainer();
    expect(container.querySelectorAll("button")).toHaveLength(1);
    expect(container.querySelector("img")).toBeNull();
    expect(document.getElementById("fake")).toBeNull();
    expect(container.querySelector("button.entry")!.textContent).toBe(evil);
  });

  it("does not allow a quote in a template id to break out of the id attribute", async () => {
    const evilId = 'x" onclick="alert(1)" data-x="';
    const renderHtml = await importRenderHtml();
    await renderHtml([template({ id: evilId, templateName: "Innocent" })]);

    const container = entriesContainer();
    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(1);
    const button = buttons[0];
    // The whole string stayed inside the id attribute; no extra attributes appeared.
    expect(button.getAttribute("id")).toBe(evilId);
    expect(button.getAttribute("onclick")).toBeNull();
    expect(button.getAttribute("data-x")).toBeNull();
    expect(button.attributes.length).toBe(4); // type, id, class, style
    // The delete flow looks the button up by id — that still works.
    expect(document.getElementById(evilId)).toBe(button);
  });

  it("keeps the click handler wired: clicking a button fills the form and marks it active", async () => {
    const renderHtml = await importRenderHtml();
    const { default: fillForm } = await import("@bexio-chrome-extension/chrome-extension/src/utils/fillForm");
    await renderHtml([template(), template({ id: "tmpl2", templateName: "Globex GmbH" })]);

    const button = document.getElementById("tmpl1") as HTMLButtonElement;
    button.click();

    expect(vi.mocked(fillForm)).toHaveBeenCalledWith("tmpl1");
    expect(button.classList.contains("template-button--active")).toBe(true);
    expect(document.getElementById("DeleteTemplate")!.classList.contains("btn-danger")).toBe(true);
  });

  it("renders an empty entries container when there are no templates", async () => {
    const renderHtml = await importRenderHtml();
    await renderHtml([]);

    expect(entriesContainer().querySelectorAll("button")).toHaveLength(0);
    expect(document.getElementById("SoulcodeExtensionTemplates")).not.toBeNull();
  });
});
