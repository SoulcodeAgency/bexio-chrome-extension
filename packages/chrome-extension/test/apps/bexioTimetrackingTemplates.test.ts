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

  it("renders one chip per template: apply button with name/id inside a .template-chip wrapper", async () => {
    const renderHtml = await importRenderHtml();
    await renderHtml([template(), template({ id: "tmpl2", templateName: "Globex GmbH" })]);

    const chips = entriesContainer().querySelectorAll("div.template-chip");
    expect(chips).toHaveLength(2);
    const buttons = entriesContainer().querySelectorAll("button.entry");
    expect(Array.from(buttons).map((b) => b.id)).toEqual(["tmpl1", "tmpl2"]);
    expect(Array.from(buttons).map((b) => b.textContent)).toEqual(["Project Falcon", "Globex GmbH"]);
    expect(buttons[0].className).toBe("entry template-button");
    expect(buttons[0].getAttribute("aria-pressed")).toBe("false");
    // each chip carries a hidden update button and a delete cross
    expect(chips[0].querySelector<HTMLButtonElement>(".template-chip-update")!.hidden).toBe(true);
    expect(chips[0].querySelector(".template-chip-delete")).not.toBeNull();
    // filter metadata: lowercased name + keywords
    expect((chips[0] as HTMLElement).dataset.filter).toBe("project falcon ");
  });

  it("puts the version into the heading tooltip, not the heading text", async () => {
    const renderHtml = await importRenderHtml();
    await renderHtml([]);
    const heading = document.querySelector("#SoulcodeExtensionTemplates h2")!;
    expect(heading.textContent!.trim()).toBe("Templates");
    expect(heading.getAttribute("title")).toMatch(/v\d+\.\d+\.\d+/);
  });

  it("falls back to the id as the display name for legacy (pre-v0.5.x) entries", async () => {
    const legacy = template({ id: "LegacyName" });
    delete (legacy as Partial<TemplateEntry>).templateName;
    const renderHtml = await importRenderHtml();
    await renderHtml([legacy]);

    expect(entriesContainer().querySelector("button.entry")!.textContent).toBe("LegacyName");
  });

  // Regression: template names come from bexio field values, the add form and
  // the side panel's modal — none of them sanitised. They must never be parsed
  // as HTML (#85).
  it("does not parse markup in a template name — it is rendered as literal text", async () => {
    const evil = '<img src=x onerror="alert(1)"><button id="fake">pwned</button>';
    const renderHtml = await importRenderHtml();
    await renderHtml([template({ templateName: evil })]);

    const container = entriesContainer();
    expect(container.querySelectorAll("button.entry")).toHaveLength(1);
    expect(container.querySelector("img")).toBeNull();
    expect(document.getElementById("fake")).toBeNull();
    expect(container.querySelector("button.entry")!.textContent).toBe(evil);
  });

  it("does not allow a quote in a template id to break out of the id attribute", async () => {
    const evilId = 'x" onclick="alert(1)" data-x="';
    const renderHtml = await importRenderHtml();
    await renderHtml([template({ id: evilId, templateName: "Innocent" })]);

    const container = entriesContainer();
    const buttons = container.querySelectorAll("button.entry");
    expect(buttons).toHaveLength(1);
    const button = buttons[0];
    // The whole string stayed inside the id attribute; no extra attributes appeared.
    expect(button.getAttribute("id")).toBe(evilId);
    expect(button.getAttribute("onclick")).toBeNull();
    expect(button.getAttribute("data-x")).toBeNull();
    expect(button.attributes.length).toBe(4); // type, id, class, aria-pressed
    // The delete flow looks the button up by id — that still works.
    expect(document.getElementById(evilId)).toBe(button);
  });

  it("marks the clicked chip active: class, aria-pressed and visible update button", async () => {
    const renderHtml = await importRenderHtml();
    const { default: fillForm } = await import("@bexio-chrome-extension/chrome-extension/src/utils/fillForm");
    await renderHtml([template(), template({ id: "tmpl2", templateName: "Globex GmbH" })]);

    const first = document.getElementById("tmpl1") as HTMLButtonElement;
    const second = document.getElementById("tmpl2") as HTMLButtonElement;
    second.click();
    first.click();

    expect(vi.mocked(fillForm)).toHaveBeenLastCalledWith("tmpl1");
    expect(first.classList.contains("template-button--active")).toBe(true);
    expect(first.getAttribute("aria-pressed")).toBe("true");
    expect(first.parentElement!.querySelector<HTMLButtonElement>(".template-chip-update")!.hidden).toBe(false);
    // the previously active chip is fully reset
    expect(second.classList.contains("template-button--active")).toBe(false);
    expect(second.getAttribute("aria-pressed")).toBe("false");
    expect(second.parentElement!.querySelector<HTMLButtonElement>(".template-chip-update")!.hidden).toBe(true);
  });

  it("↻ on the active chip overwrites the template from the form and flashes 'Updated ✓'", async () => {
    document.body.innerHTML = "";
    loadFixture("monitoring-edit-filled"); // this test needs form values, not the empty fixture
    const entry = template({ work: "Old Work" });
    await chrome.storage.local.set({ entries: [entry] });
    const renderHtml = await importRenderHtml();
    await renderHtml([entry]);

    (document.getElementById("tmpl1") as HTMLButtonElement).click(); // activate
    const update = document.querySelector<HTMLButtonElement>(".template-chip-update")!;
    expect(update.hidden).toBe(false);
    update.click();

    await vi.waitFor(async () => {
      const stored = (await chrome.storage.local.get("entries")).entries as TemplateEntry[];
      expect(stored[0].work).toBe("Work"); // fixture value replaced "Old Work"
      expect(stored[0].id).toBe("tmpl1");
      expect(stored[0].templateName).toBe("Project Falcon");
    });
    expect(update.textContent).toBe("Updated ✓");
  });

  it("↻ shows an error toast when the template is missing from storage", async () => {
    document.body.innerHTML = "";
    loadFixture("monitoring-edit-filled");
    const entry = template();
    await chrome.storage.local.set({ entries: [] }); // rendered, but not in storage
    const renderHtml = await importRenderHtml();
    await renderHtml([entry]);

    (document.getElementById("tmpl1") as HTMLButtonElement).click();
    document.querySelector<HTMLButtonElement>(".template-chip-update")!.click();

    await vi.waitFor(() => {
      const toast = document.getElementById("SoulcodeExtensionToast");
      expect(toast?.textContent).toBe("Could not update — template not found in storage.");
    });
  });

  it("renders an empty entries container when there are no templates", async () => {
    const renderHtml = await importRenderHtml();
    await renderHtml([]);

    expect(entriesContainer().querySelectorAll("button")).toHaveLength(0);
    expect(document.getElementById("SoulcodeExtensionTemplates")).not.toBeNull();
    expect(document.getElementById("ManageTemplates")).not.toBeNull();
  });
});
