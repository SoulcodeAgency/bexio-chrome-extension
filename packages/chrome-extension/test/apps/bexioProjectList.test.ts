import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";

const importRenderHtml = () =>
  import("@bexio-chrome-extension/chrome-extension/src/apps/bexioProjectList/renderHtml").then((m) => m.default);
const importEntry = () => import("@bexio-chrome-extension/chrome-extension/src/apps/bexioProjectList/index");

// renderHtml, convertPopover and the observers are async (storage reads, MutationObserver
// microtasks); a short tick lets all of it settle.
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

const stubPathname = (pathname: string) => vi.stubGlobal("location", { ...window.location, pathname } as Location);

const getToggle = () => document.getElementById("PopoverTextSwitcher");
const getOption = (mode: "text" | "tooltip") =>
  document.querySelector<HTMLButtonElement>(`#PopoverTextSwitcher button[data-mode='${mode}']`);

// One entry per page the bexioProjectList content script runs on (manifest.json).
const TOOLTIP_PAGES = [
  { fixture: "monitoring-list", primaryAction: "Neue Zeiterfassung" },
  { fixture: "pr_project-listMonitoring", primaryAction: "Neues Projekt" },
  { fixture: "pr_project-showPackage", primaryAction: "Neues Projekt" },
  { fixture: "kb_invoice-show", primaryAction: "Neue Rechnung" },
];

describe("bexioProjectList content script", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("Text | Tooltip toggle", () => {
    it.each(TOOLTIP_PAGES)(
      "sits in the page title bar of $fixture, left of the '$primaryAction' button",
      async ({ fixture, primaryAction }) => {
        loadFixture(fixture);
        const renderHtml = await importRenderHtml();

        await renderHtml();

        const toggle = getToggle();
        expect(toggle).not.toBeNull();
        expect(toggle!.closest(".bx-breadcrumb-container .bx-card-title")).not.toBeNull();
        // bexio's sidebar layout hides the legacy top navigation
        // (`.use-new-nav .lgcy-topbar-nav-office { display: none }`), where the toggle used to live.
        expect(toggle!.closest(".lgcy-topbar-nav-office")).toBeNull();
        const nextBlock = toggle!.closest(".bx-flex-block")!.nextElementSibling;
        expect(nextBlock?.querySelector(".js-first-btn")?.textContent?.trim()).toBe(primaryAction);
      },
    );

    it("is injected by the content script entry point on /monitoring/list", async () => {
      stubPathname("/index.php/monitoring/list");
      loadFixture("monitoring-list");

      await importEntry();
      await settle();

      expect(getToggle()?.closest(".bx-breadcrumb-container")).not.toBeNull();
    });

    it("renders only once when called again", async () => {
      loadFixture("monitoring-list");
      const renderHtml = await importRenderHtml();

      await renderHtml();
      await renderHtml();

      expect(document.querySelectorAll("#PopoverTextSwitcher")).toHaveLength(1);
    });

    it("marks 'Tooltip' as active while the setting is off (the default)", async () => {
      loadFixture("monitoring-list");
      const renderHtml = await importRenderHtml();

      await renderHtml();

      expect(getOption("tooltip")?.getAttribute("aria-pressed")).toBe("true");
      expect(getOption("text")?.getAttribute("aria-pressed")).toBe("false");
    });

    it("marks 'Text' as active while the setting is on", async () => {
      await chrome.storage.local.set({ removePopoversSetting: true });
      loadFixture("monitoring-list");
      const renderHtml = await importRenderHtml();

      await renderHtml();

      expect(getOption("text")?.getAttribute("aria-pressed")).toBe("true");
      expect(getOption("tooltip")?.getAttribute("aria-pressed")).toBe("false");
    });

    it("clicking 'Text' stores the setting and replaces the tooltip icons with their text", async () => {
      loadFixture("monitoring-list");
      const renderHtml = await importRenderHtml();
      await renderHtml();
      const icons = document.querySelectorAll("i[rel='popover']");

      getOption("text")!.click();
      await settle();

      expect(await chrome.storage.local.get("removePopoversSetting")).toEqual({ removePopoversSetting: true });
      expect(document.querySelectorAll(".new-popover-text")).toHaveLength(icons.length);
      expect(getOption("text")?.getAttribute("aria-pressed")).toBe("true");
      expect(getOption("tooltip")?.getAttribute("aria-pressed")).toBe("false");
    });

    it("clicking 'Tooltip' stores the setting and restores the tooltip icons", async () => {
      await chrome.storage.local.set({ removePopoversSetting: true });
      loadFixture("monitoring-list");
      const renderHtml = await importRenderHtml();
      await renderHtml();

      getOption("tooltip")!.click();
      await settle();

      expect(await chrome.storage.local.get("removePopoversSetting")).toEqual({ removePopoversSetting: false });
      expect(document.querySelectorAll(".new-popover-text")).toHaveLength(0);
      expect(getOption("tooltip")?.getAttribute("aria-pressed")).toBe("true");
    });

    it("skips the toggle with a warning, instead of throwing, when the page has no title bar", async () => {
      loadFixture("monitoring-list");
      document.querySelectorAll(".bx-breadcrumb-container").forEach((el) => el.remove());
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const renderHtml = await importRenderHtml();

      await expect(renderHtml()).resolves.toBeUndefined();

      expect(getToggle()).toBeNull();
      expect(warn).toHaveBeenCalled();
    });
  });

  describe("date column sorting", () => {
    const getDateLinks = () =>
      Array.from(document.querySelectorAll("thead th a[href*='DATE/o/']")).map((link) => link.getAttribute("href")!);

    // Stands in for bexio's delegated `.ajxl` click handler (see test/utils/dateSort.test.ts).
    let requestedByClick: string[];
    const bexioAjaxLinkHandler = (event: MouseEvent) => {
      const link = (event.target as Element).closest("a.ajxl");
      if (link) {
        event.preventDefault();
        requestedByClick.push(link.getAttribute("href")!);
      }
    };
    beforeEach(() => {
      requestedByClick = [];
      document.addEventListener("click", bexioAjaxLinkHandler);
    });
    afterEach(() => {
      document.removeEventListener("click", bexioAjaxLinkHandler);
    });

    it.each([
      { fixture: "monitoring-list", pathname: "/index.php/monitoring/list", dateColumns: 1 },
      {
        fixture: "pr_project-listMonitoring",
        pathname: "/index.php/pr_project/listMonitoring/id/99999",
        dateColumns: 1,
      },
      {
        fixture: "pr_project-showPackage",
        pathname: "/index.php/pr_project/showPackage/packageId/99999",
        dateColumns: 2,
      },
      { fixture: "kb_invoice-show", pathname: "/index.php/kb_invoice/show/id/99999", dateColumns: 1 },
    ])("points the date columns of $fixture to descending on load", async ({ fixture, pathname, dateColumns }) => {
      stubPathname(pathname);
      loadFixture(fixture);

      await importEntry();
      await settle();

      expect(getDateLinks()).toHaveLength(dateColumns);
      expect(getDateLinks().filter((href) => !href.endsWith("/o/desc"))).toEqual([]);
    });

    it("points the date column to descending again when bexio replaces the time tracking list", async () => {
      stubPathname("/index.php/monitoring/list");
      loadFixture("monitoring-list");
      const list = document.getElementById("monitoring_content")!;
      const freshListHtml = list.innerHTML;

      await importEntry();
      await settle();
      // bexio's `.ajxl` handler: `$.get(href, (html) => $lfContent.replaceWith(html))`
      list.innerHTML = freshListHtml;
      await settle();

      expect(getDateLinks()).toEqual([
        "/index.php/filter/sort/f/MonitoringFilter/m/monitoring/a/list/v/monitoring.DATE/o/desc",
      ]);
    });

    it("sorts the time tracking list by date, newest first, while the setting is on", async () => {
      await chrome.storage.local.set({ autoDateSortSetting: true });
      stubPathname("/index.php/monitoring/list");
      loadFixture("monitoring-list");

      await importEntry();
      await settle();

      expect(requestedByClick).toEqual([
        "/index.php/filter/sort/f/MonitoringFilter/m/monitoring/a/list/v/monitoring.DATE/o/desc",
      ]);
    });

    it("never sorts on its own while the setting is off (the default)", async () => {
      stubPathname("/index.php/monitoring/list");
      loadFixture("monitoring-list");

      await importEntry();
      await settle();

      expect(requestedByClick).toEqual([]);
    });

    // Unlike the time tracking list, bexio forgets this list's sort on every page load.
    it("sorts a project's time list by date, newest first, while the setting is on", async () => {
      await chrome.storage.local.set({ autoDateSortSetting: true });
      stubPathname("/index.php/pr_project/listMonitoring/projectId/99999");
      loadFixture("pr_project-listMonitoring");

      await importEntry();
      await settle();

      expect(requestedByClick).toEqual([
        "/index.php/filter/sort/f/PrMonitoringFilter/m/pr_project/a/listMonitoring_197/v/monitoring.DATE/o/desc",
      ]);
    });

    it("sorts a work package's time entries, and leaves its tasks alone", async () => {
      await chrome.storage.local.set({ autoDateSortSetting: true });
      stubPathname("/index.php/pr_project/showPackage/packageId/99999");
      loadFixture("pr_project-showPackage");

      await importEntry();
      await settle();

      expect(requestedByClick).toEqual([
        "/index.php/filter/sort/f/PrMonitoringFilter/m/pr_project/a/listMonitorings_164/v/monitoring.DATE/o/desc",
      ]);
    });

    // Live bexio (2026-09-18): the 'Aufgaben' panel is filled by AJAX after the content script ran.
    it("points the tasks' due date to descending when bexio fills the work package's 'Aufgaben' panel", async () => {
      stubPathname("/index.php/pr_project/showPackage/packageId/99999");
      loadFixture("pr_project-showPackage");
      const tasksPanel = document.getElementById("ui-id-2")!;
      const freshPanelHtml = tasksPanel.innerHTML;
      tasksPanel.innerHTML = "";

      await importEntry();
      await settle();
      tasksPanel.innerHTML = freshPanelHtml;
      await settle();

      expect(tasksPanel.querySelector("thead th a[href*='/v/task.FINISH_DATE/']")?.getAttribute("href")).toBe(
        "/index.php/filter/sort/f/PrTaskFilter/m/pr_project/a/listTasks_164/v/task.FINISH_DATE/o/desc",
      );
    });

    it("sorts the invoice's 'Zeiten importieren' list", async () => {
      await chrome.storage.local.set({ autoDateSortSetting: true });
      stubPathname("/index.php/kb_invoice/show/id/99999");
      loadFixture("kb_invoice-show");

      await importEntry();
      await settle();

      expect(requestedByClick).toEqual([
        "/index.php/filter/sort/f/KbInvoiceMonitoringFilter/m/kb_invoice/a/importMonitorings/v/monitoring.DATE/o/desc",
      ]);
    });

    describe("'Newest first' toggle", () => {
      const DATE_DESCENDING = "/index.php/filter/sort/f/MonitoringFilter/m/monitoring/a/list/v/monitoring.DATE/o/desc";
      const getDateSortToggle = () => document.getElementById("AutoDateSortToggle");
      const openTimeTrackingList = async () => {
        stubPathname("/index.php/monitoring/list");
        loadFixture("monitoring-list");
        await importEntry();
        await settle();
      };

      it.each([
        { fixture: "monitoring-list", pathname: "/index.php/monitoring/list", primaryAction: "Neue Zeiterfassung" },
        {
          fixture: "pr_project-listMonitoring",
          pathname: "/index.php/pr_project/listMonitoring/projectId/99999",
          primaryAction: "Neues Projekt",
        },
        {
          fixture: "pr_project-showPackage",
          pathname: "/index.php/pr_project/showPackage/packageId/99999",
          primaryAction: "Neues Projekt",
        },
        { fixture: "kb_invoice-show", pathname: "/index.php/kb_invoice/show/id/99999", primaryAction: "Neue Rechnung" },
      ])(
        "sits in the title bar of $fixture, between 'Text | Tooltip' and '$primaryAction'",
        async ({ fixture, pathname, primaryAction }) => {
          stubPathname(pathname);
          loadFixture(fixture);

          await importEntry();
          await settle();

          expect(getDateSortToggle()).not.toBeNull();
          const block = getDateSortToggle()!.closest(".bx-flex-block");
          expect(block?.closest(".bx-breadcrumb-container .bx-card-title")).toBeInstanceOf(HTMLElement);
          expect(block?.previousElementSibling?.querySelector("#PopoverTextSwitcher")).not.toBeNull();
          expect(block?.nextElementSibling?.querySelector(".js-first-btn")?.textContent?.trim()).toBe(primaryAction);
        },
      );

      it("renders only once when the content script runs its setup again", async () => {
        await openTimeTrackingList();
        const { initializeExtension } = await importEntry();

        await initializeExtension();
        await settle();

        expect(document.querySelectorAll("#AutoDateSortToggle")).toHaveLength(1);
      });

      it("is not pressed while the setting is off (the default)", async () => {
        await openTimeTrackingList();

        expect(getDateSortToggle()?.getAttribute("aria-pressed")).toBe("false");
      });

      it("is pressed while the setting is on", async () => {
        await chrome.storage.local.set({ autoDateSortSetting: true });

        await openTimeTrackingList();

        expect(getDateSortToggle()?.getAttribute("aria-pressed")).toBe("true");
      });

      it("switching it on stores the setting and sorts the unsorted list right away", async () => {
        await openTimeTrackingList();

        getDateSortToggle()!.click();
        await settle();

        expect(await chrome.storage.local.get("autoDateSortSetting")).toEqual({ autoDateSortSetting: true });
        expect(getDateSortToggle()?.getAttribute("aria-pressed")).toBe("true");
        expect(requestedByClick).toEqual([DATE_DESCENDING]);
      });

      it("switching it off stores the setting and leaves the list as it is", async () => {
        await chrome.storage.local.set({ autoDateSortSetting: true });
        await openTimeTrackingList();
        requestedByClick.length = 0; // the automatic sort of the page load

        getDateSortToggle()!.click();
        await settle();

        expect(await chrome.storage.local.get("autoDateSortSetting")).toEqual({ autoDateSortSetting: false });
        expect(getDateSortToggle()?.getAttribute("aria-pressed")).toBe("false");
        expect(requestedByClick).toEqual([]);
      });
    });
  });

  describe("work package page (pr_project/showPackage)", () => {
    // Verified on the live page: opening the 'Zeiten' tab and sorting/paging inside it both
    // replace the children of the jQuery-UI tab panel.
    const reloadTimesPanel = (panel: HTMLElement, html: string) => {
      panel.innerHTML = html;
    };

    it("converts the time entries again when bexio reloads the 'Zeiten' tab panel", async () => {
      await chrome.storage.local.set({ removePopoversSetting: true });
      stubPathname("/index.php/pr_project/showPackage/packageId/99999");
      loadFixture("pr_project-showPackage");
      const panel = document.getElementById("ui-id-4")!;
      const freshPanelHtml = panel.innerHTML;

      await importEntry();
      await settle();
      reloadTimesPanel(panel, freshPanelHtml);
      await settle();

      const icons = panel.querySelectorAll("i[rel='popover']");
      expect(icons.length).toBeGreaterThan(0);
      expect(panel.querySelectorAll(".new-popover-text")).toHaveLength(icons.length);
    });

    it("finds the panel through its tab link, whatever id jQuery UI generated for it", async () => {
      await chrome.storage.local.set({ removePopoversSetting: true });
      stubPathname("/index.php/pr_project/showPackage/packageId/99999");
      loadFixture("pr_project-showPackage");
      // jQuery UI numbers tab panels at runtime: the May 2026 capture had this panel at #ui-id-5.
      const panel = document.getElementById("ui-id-4")!;
      panel.id = "ui-id-17";
      document.querySelector("li[aria-controls='ui-id-4']")!.setAttribute("aria-controls", "ui-id-17");
      const freshPanelHtml = panel.innerHTML;

      await importEntry();
      await settle();
      reloadTimesPanel(panel, freshPanelHtml);
      await settle();

      const icons = panel.querySelectorAll("i[rel='popover']");
      expect(panel.querySelectorAll(".new-popover-text")).toHaveLength(icons.length);
    });

    it("loads without error when the page has no 'Zeiten' tab", async () => {
      stubPathname("/index.php/pr_project/showPackage/packageId/99999");
      loadFixture("pr_project-showPackage");
      document.querySelector("a[href*='/pr_project/listMonitorings/']")!.closest("li")!.remove();

      await expect(importEntry()).resolves.toBeDefined();
    });
  });
});
