/**
 * Remarks as text in bexio's new time tracking grids (#168): the isolated-world half —
 * `convertGridRemarks` and the grid's own "Text | Tooltip" toggle, driven by the
 * bexioProjectList content script on `/index.php/time-tracking`. The column widths are the MAIN-world
 * half, see bexioGridColumns.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";

const importEntry = () => import("@bexio-chrome-extension/chrome-extension/src/apps/bexioProjectList/index");

// Storage reads, MutationObserver microtasks and the requestAnimationFrame the grid pass waits for.
const settle = () => new Promise((resolve) => setTimeout(resolve, 80));

const stubPathname = (pathname: string) => vi.stubGlobal("location", { ...window.location, pathname } as Location);

const remarkTexts = () =>
  Array.from(document.querySelectorAll<HTMLElement>(".soulcode-grid-remarks")).map((text) => text.textContent);
const icons = () =>
  Array.from(document.querySelectorAll<HTMLElement>("bexio-time-entry-remarks-cell-renderer fa-icon"));
const gridToggle = () => document.getElementById("GridNotesTextSwitcher");
const gridOption = (mode: "text" | "tooltip") =>
  document.querySelector<HTMLButtonElement>(`#GridNotesTextSwitcher button[data-mode='${mode}']`)!;

async function openTimeTrackingList() {
  stubPathname("/index.php/time-tracking");
  loadFixture("time-tracking-grid.synthetic");
  await importEntry();
  await settle();
}

describe("remarks in bexio's new time tracking grid", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
    document.documentElement.removeAttribute("data-soulcode-remarks");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("leaves the icons alone while the setting is off (the default) and tells the MAIN world", async () => {
    await openTimeTrackingList();

    expect(remarkTexts()).toEqual([]);
    expect(icons().every((icon) => icon.style.display === "")).toBe(true);
    expect(document.documentElement.getAttribute("data-soulcode-remarks")).toBe("tooltip");
  });

  it("prints each remark from its icon's aria-label, as text, and hides the icon", async () => {
    await chrome.storage.local.set({ removePopoversSetting: true });
    await openTimeTrackingList();

    expect(remarkTexts()).toEqual([
      "Kickoff vorbereitet & Agenda verschickt",
      "Workshop Teil 1\nWorkshop Teil 2\nProtokoll <b>nicht</b> HTML",
    ]);
    expect(document.querySelector(".soulcode-grid-remarks b")).toBeNull();
    expect(icons().every((icon) => icon.style.display === "none")).toBe(true);
    expect(document.documentElement.getAttribute("data-soulcode-remarks")).toBe("text");
  });

  it("follows a recycled row whose icon now carries another remark", async () => {
    await chrome.storage.local.set({ removePopoversSetting: true });
    await openTimeTrackingList();

    icons()[0].setAttribute("aria-label", "Andere Zeile");
    await settle();

    expect(remarkTexts()[0]).toBe("Andere Zeile");
    expect(document.querySelectorAll(".soulcode-grid-remarks")).toHaveLength(2);
  });

  it("converts rows ag-grid renders later", async () => {
    await chrome.storage.local.set({ removePopoversSetting: true });
    await openTimeTrackingList();

    const container = document.querySelector(".ag-center-cols-container")!;
    container.insertAdjacentHTML(
      "beforeend",
      `<div class="ag-row"><div class="ag-cell" col-id="text"><bexio-time-entry-remarks-cell-renderer>
        <fa-icon aria-label="Neue Zeile"></fa-icon></bexio-time-entry-remarks-cell-renderer></div></div>`,
    );
    await settle();

    expect(remarkTexts()).toContain("Neue Zeile");
  });

  it("puts no old title-bar toggles on the page", async () => {
    await openTimeTrackingList();

    expect(document.getElementById("PopoverTextSwitcher")).toBeNull();
    expect(document.getElementById("AutoDateSortToggle")).toBeNull();
  });

  describe("the grid's Text | Tooltip toggle", () => {
    it("sits left of the grid's 'Spalten' menu trigger and shows the stored mode", async () => {
      await openTimeTrackingList();

      expect(gridToggle()!.nextElementSibling!.matches(".mat-mdc-menu-trigger")).toBe(true);
      expect(gridToggle()!.nextElementSibling!.textContent!.trim()).toBe("Spalten (8/9)");
      expect(gridOption("tooltip").getAttribute("aria-pressed")).toBe("true");
      expect(gridOption("text").getAttribute("aria-pressed")).toBe("false");
    });

    it("does not open the column menu: its clicks never reach bexio's menu trigger", async () => {
      await openTimeTrackingList();
      const trigger = document.querySelector(".time-tracking-grid__columns-trigger")!;
      const menuClicks = vi.fn();
      trigger.addEventListener("click", menuClicks);

      gridOption("text").click();
      gridOption("tooltip").click();
      await settle();

      expect(trigger.contains(gridToggle())).toBe(false);
      expect(menuClicks).not.toHaveBeenCalled();
    });

    it("switches to text and back, storing the shared setting", async () => {
      await openTimeTrackingList();

      gridOption("text").click();
      await settle();
      expect(remarkTexts()).toHaveLength(2);
      await expect(chrome.storage.local.get("removePopoversSetting")).resolves.toEqual({ removePopoversSetting: true });

      gridOption("tooltip").click();
      await settle();
      expect(remarkTexts()).toEqual([]);
      expect(icons().every((icon) => icon.style.display === "")).toBe(true);
      expect(document.documentElement.getAttribute("data-soulcode-remarks")).toBe("tooltip");
    });

    it("appears once the grid renders, if it was not there when the script ran", async () => {
      stubPathname("/index.php/time-tracking");
      document.body.innerHTML = "<div class='bexio-page'></div>";
      await importEntry();
      await settle();
      expect(gridToggle()).toBeNull();

      loadFixture("time-tracking-grid.synthetic");
      await settle();

      expect(document.querySelectorAll("#GridNotesTextSwitcher")).toHaveLength(1);
    });
  });
});
