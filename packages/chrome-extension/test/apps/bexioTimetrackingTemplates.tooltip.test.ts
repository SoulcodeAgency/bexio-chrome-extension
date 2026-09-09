import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";
import type { TemplateEntry } from "@bexio-chrome-extension/shared/types";

vi.mock("@bexio-chrome-extension/chrome-extension/src/apps/bexioTimetrackingTemplates/index", () => ({
  initializeExtension: vi.fn(async () => {}),
}));
vi.mock("@bexio-chrome-extension/chrome-extension/src/utils/fillForm", () => ({ default: vi.fn(async () => {}) }));

const template = (over: Partial<TemplateEntry> = {}): TemplateEntry => ({
  templateName: "Project Falcon",
  keywords: "",
  billable: true,
  contact: "Acme AG",
  contactPerson: "Doe Jane",
  id: "tmpl1",
  package: "Package Alpha",
  project: "Project Falcon",
  status: "In Arbeit",
  work: "Consulting",
  ...over,
});

const hover = (el: Element) => el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
const unhover = (el: Element) => el.dispatchEvent(new MouseEvent("mouseleave", { bubbles: false }));
const tooltip = () => document.getElementById("SoulcodeTemplateTooltip");

describe("template tooltip", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    document.body.innerHTML = "";
    loadFixture("monitoring-edit");
  });
  afterEach(() => vi.useRealTimers());

  const render = async (entries: TemplateEntry[]) => {
    const { default: renderHtml } =
      await import("@bexio-chrome-extension/chrome-extension/src/apps/bexioTimetrackingTemplates/renderHtml");
    await renderHtml(entries);
  };

  it("shows the field preview after the hover delay, values as literal text", async () => {
    await render([template()]);
    hover(document.getElementById("tmpl1")!);
    expect(tooltip()?.hidden ?? true).toBe(true); // not yet — delay pending
    vi.advanceTimersByTime(350);

    const el = tooltip()!;
    expect(el.hidden).toBe(false);
    expect(el.querySelector(".tooltip-name")!.textContent).toBe("Project Falcon");
    const rows = Array.from(el.querySelectorAll("dt")).map((dt) => dt.textContent);
    expect(rows).toEqual(["Tätigkeit", "Projekt", "Arbeitspaket", "Kontakt", "Status", "Abrechenbar"]);
    const values = Array.from(el.querySelectorAll("dd")).map((dd) => dd.textContent);
    expect(values).toEqual(["Consulting", "Project Falcon", "Package Alpha", "Acme AG", "In Arbeit", "Ja"]);
  });

  it("renders markup in template fields as literal text (no injection)", async () => {
    const evil = '<img src=x onerror="alert(1)">';
    await render([template({ templateName: evil, project: evil })]);
    hover(document.querySelector("button.template-button")!);
    vi.advanceTimersByTime(350);

    expect(tooltip()!.querySelector("img")).toBeNull();
    expect(tooltip()!.querySelector(".tooltip-name")!.textContent).toBe(evil);
  });

  it("hides on mouseleave and on click", async () => {
    await render([template()]);
    const button = document.getElementById("tmpl1")!;
    hover(button);
    vi.advanceTimersByTime(350);
    expect(tooltip()!.hidden).toBe(false);

    unhover(button);
    expect(tooltip()!.hidden).toBe(true);

    hover(button);
    vi.advanceTimersByTime(350);
    (button as HTMLButtonElement).click();
    expect(tooltip()!.hidden).toBe(true);
  });

  it("does not show while the panel is in manage mode", async () => {
    await render([template()]);
    document.getElementById("SoulcodeExtensionTemplates")!.classList.add("manage-mode");
    hover(document.getElementById("tmpl1")!);
    vi.advanceTimersByTime(350);
    expect(tooltip()?.hidden ?? true).toBe(true);
  });
});
