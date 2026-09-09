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

  // Regression: fillForm applies an entry without `billable` as billable
  // (`billable = true` default), so a plain truthiness test here would promise
  // "Nein" and then tick the box.
  it("previews a missing billable flag the way applying it behaves: Ja", async () => {
    const legacy = template();
    delete (legacy as Partial<TemplateEntry>).billable;
    await render([legacy]);

    hover(document.getElementById("tmpl1")!);
    vi.advanceTimersByTime(350);

    const values = Array.from(tooltip()!.querySelectorAll("dd")).map((dd) => dd.textContent);
    expect(values[5]).toBe("Ja");
  });

  // Regression: the panel does not re-render after ↻, so the chip's entry — the
  // very object this closure previews — has to be refreshed in place, or the
  // preview keeps showing what the template held before the update.
  it("previews the new values after ↻ overwrote the template", async () => {
    vi.useRealTimers(); // storage round-trips first, timers only for the hover below
    document.body.innerHTML = "";
    loadFixture("monitoring-edit-filled");
    const entry = template({ work: "Stale Work", project: "Stale Project" });
    await chrome.storage.local.set({ entries: [entry] });
    await render([entry]);

    (document.getElementById("tmpl1") as HTMLButtonElement).click();
    const update = document.querySelector<HTMLButtonElement>(".template-chip-update")!;
    await vi.waitFor(() => expect(update.disabled).toBe(false));
    update.click();
    await vi.waitFor(async () => {
      const stored = (await chrome.storage.local.get("entries")).entries as TemplateEntry[];
      expect(stored[0].work).toBe("Work");
    });

    vi.useFakeTimers();
    hover(document.getElementById("tmpl1")!);
    vi.advanceTimersByTime(350);

    const values = Array.from(tooltip()!.querySelectorAll("dd")).map((dd) => dd.textContent);
    expect(values[0]).toBe("Work"); // Tätigkeit — was "Stale Work"
    expect(values[1]).toBe("Acme - Back Office"); // Projekt — was "Stale Project"
  });

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
