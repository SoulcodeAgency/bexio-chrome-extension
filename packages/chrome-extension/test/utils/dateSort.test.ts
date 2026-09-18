import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";

const importDateSort = () => import("@bexio-chrome-extension/chrome-extension/src/utils/dateSort");

const sortHrefs = () =>
  Array.from(document.querySelectorAll("thead th a[href*='/filter/sort/']")).map((link) => link.getAttribute("href")!);
const getSortLink = (column: string) => document.querySelector<HTMLAnchorElement>(`thead th a[href*='/v/${column}/']`)!;

// How bexio renders a sorted column (live page, 2026-09-18): a `span.caret` inside the link, which
// then points to the opposite direction; ascending additionally puts `dropup` on the `th`.
const markSortedDescending = (link: HTMLAnchorElement) => {
  link.insertAdjacentHTML("beforeend", '<span class="caret"></span>');
};

const stubPathname = (pathname: string) => vi.stubGlobal("location", { ...window.location, pathname } as Location);

describe("dateSort", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("preferDescendingDateSort", () => {
    // All fixtures were captured unsorted, i.e. with every sort link on `/o/asc`.
    it.each([
      {
        fixture: "monitoring-list",
        descending: ["/index.php/filter/sort/f/MonitoringFilter/m/monitoring/a/list/v/monitoring.DATE/o/desc"],
      },
      {
        fixture: "pr_project-listMonitoring",
        descending: [
          "/index.php/filter/sort/f/PrMonitoringFilter/m/pr_project/a/listMonitoring_197/v/monitoring.DATE/o/desc",
        ],
      },
      {
        fixture: "pr_project-showPackage",
        descending: [
          "/index.php/filter/sort/f/PrTaskFilter/m/pr_project/a/listTasks_164/v/task.FINISH_DATE/o/desc",
          "/index.php/filter/sort/f/PrMonitoringFilter/m/pr_project/a/listMonitorings_164/v/monitoring.DATE/o/desc",
        ],
      },
      {
        fixture: "kb_invoice-show",
        descending: [
          "/index.php/filter/sort/f/KbInvoiceMonitoringFilter/m/kb_invoice/a/importMonitorings/v/monitoring.DATE/o/desc",
        ],
      },
    ])(
      "points the unsorted date columns of $fixture to descending, and no other column",
      async ({ fixture, descending }) => {
        loadFixture(fixture);
        const linkCount = sortHrefs().length;
        const { preferDescendingDateSort } = await importDateSort();

        preferDescendingDateSort();

        expect(sortHrefs().filter((href) => href.endsWith("/o/desc"))).toEqual(descending);
        expect(sortHrefs().filter((href) => href.endsWith("/o/asc"))).toHaveLength(linkCount - descending.length);
      },
    );

    it("leaves a date column that is sorted descending on its link to ascending", async () => {
      loadFixture("monitoring-list");
      markSortedDescending(getSortLink("monitoring.DATE"));
      const { preferDescendingDateSort } = await importDateSort();

      preferDescendingDateSort();

      expect(getSortLink("monitoring.DATE").getAttribute("href")).toBe(
        "/index.php/filter/sort/f/MonitoringFilter/m/monitoring/a/list/v/monitoring.DATE/o/asc",
      );
    });

    it("still rewrites the date column while another column is the sorted one", async () => {
      loadFixture("monitoring-list");
      markSortedDescending(getSortLink("monitoring.TEXT"));
      const { preferDescendingDateSort } = await importDateSort();

      preferDescendingDateSort();

      expect(getSortLink("monitoring.DATE").getAttribute("href")).toBe(
        "/index.php/filter/sort/f/MonitoringFilter/m/monitoring/a/list/v/monitoring.DATE/o/desc",
      );
    });
  });

  describe("autoSortByDate", () => {
    const DATE_DESCENDING = "/index.php/filter/sort/f/MonitoringFilter/m/monitoring/a/list/v/monitoring.DATE/o/desc";

    // Stands in for bexio's delegated `.ajxl` click handler, which takes the click over (no
    // navigation) and loads the link's `href` — read at click time — through `$.get`.
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

    it("clicks the date column, pointed to descending, when the list is unsorted and the setting is on", async () => {
      await chrome.storage.local.set({ autoDateSortSetting: true });
      loadFixture("monitoring-list");
      const { autoSortByDate } = await importDateSort();

      await autoSortByDate();

      expect(requestedByClick).toEqual([DATE_DESCENDING]);
    });

    it("does nothing while the setting is off (the default)", async () => {
      loadFixture("monitoring-list");
      const { autoSortByDate } = await importDateSort();

      await autoSortByDate();

      expect(requestedByClick).toEqual([]);
    });

    it("does nothing when the user already sorted by another column", async () => {
      await chrome.storage.local.set({ autoDateSortSetting: true });
      loadFixture("monitoring-list");
      markSortedDescending(getSortLink("monitoring.TEXT"));
      const { autoSortByDate } = await importDateSort();

      await autoSortByDate();

      expect(requestedByClick).toEqual([]);
    });

    it("does not click again in a list block it already clicked in (bexio's answer is still on its way)", async () => {
      await chrome.storage.local.set({ autoDateSortSetting: true });
      loadFixture("monitoring-list");
      const { autoSortByDate } = await importDateSort();

      await autoSortByDate();
      await autoSortByDate();

      expect(requestedByClick).toEqual([DATE_DESCENDING]);
    });

    // bexio answers a sort click by replacing the whole `.lf_content` block.
    const bexioReplacesTheList = (html: string, sortedByDate: boolean) => {
      document.getElementById("monitoring_content")!.innerHTML = html;
      if (sortedByDate) {
        markSortedDescending(getSortLink("monitoring.DATE"));
      }
    };

    it("gives up on a list that comes back unsorted after its click, instead of reloading it forever", async () => {
      await chrome.storage.local.set({ autoDateSortSetting: true });
      loadFixture("monitoring-list");
      const unsortedList = document.getElementById("monitoring_content")!.innerHTML;
      const { autoSortByDate } = await importDateSort();

      await autoSortByDate();
      bexioReplacesTheList(unsortedList, false);
      await autoSortByDate();
      bexioReplacesTheList(unsortedList, false);
      await autoSortByDate();

      expect(requestedByClick).toEqual([DATE_DESCENDING]);
    });

    it("does not take a second look at a block, while its answer is on its way, for a failed sort", async () => {
      await chrome.storage.local.set({ autoDateSortSetting: true });
      loadFixture("monitoring-list");
      const unsortedList = document.getElementById("monitoring_content")!.innerHTML;
      const { autoSortByDate } = await importDateSort();

      await autoSortByDate();
      await autoSortByDate(); // e.g. the observer firing while bexio still loads
      bexioReplacesTheList(unsortedList, true);
      await autoSortByDate();
      bexioReplacesTheList(unsortedList, false);
      await autoSortByDate();

      expect(requestedByClick).toEqual([DATE_DESCENDING, DATE_DESCENDING]);
    });

    // The invoice's "Zeiten importieren" modal: bexio forgets the sort each time it is opened.
    it("sorts again when the list arrives unsorted once more after a sorted answer", async () => {
      await chrome.storage.local.set({ autoDateSortSetting: true });
      loadFixture("monitoring-list");
      const unsortedList = document.getElementById("monitoring_content")!.innerHTML;
      const { autoSortByDate } = await importDateSort();

      await autoSortByDate();
      bexioReplacesTheList(unsortedList, true);
      await autoSortByDate();
      bexioReplacesTheList(unsortedList, false);
      await autoSortByDate();

      expect(requestedByClick).toEqual([DATE_DESCENDING, DATE_DESCENDING]);
    });

    it("clicks once when two calls overlap (initial run and observer firing together)", async () => {
      await chrome.storage.local.set({ autoDateSortSetting: true });
      loadFixture("monitoring-list");
      const { autoSortByDate } = await importDateSort();

      await Promise.all([autoSortByDate(), autoSortByDate()]);

      expect(requestedByClick).toEqual([DATE_DESCENDING]);
    });

    it("does nothing, without throwing, on a list without a date column", async () => {
      await chrome.storage.local.set({ autoDateSortSetting: true });
      loadFixture("monitoring-list");
      getSortLink("monitoring.DATE").closest("th")!.remove();
      const { autoSortByDate } = await importDateSort();

      await expect(autoSortByDate()).resolves.toBeUndefined();

      expect(requestedByClick).toEqual([]);
    });

    it("clicks the date column of a project's time list (pr_project/listMonitoring)", async () => {
      await chrome.storage.local.set({ autoDateSortSetting: true });
      stubPathname("/index.php/pr_project/listMonitoring/projectId/99999");
      loadFixture("pr_project-listMonitoring");
      const { autoSortByDate } = await importDateSort();

      await autoSortByDate();

      expect(requestedByClick).toEqual([
        "/index.php/filter/sort/f/PrMonitoringFilter/m/pr_project/a/listMonitoring_197/v/monitoring.DATE/o/desc",
      ]);
    });

    // "Newest first" is about time entries: the tasks' due date column is only pointed to descending.
    it("clicks the time entries' date column of a work package, not the tasks' due date", async () => {
      await chrome.storage.local.set({ autoDateSortSetting: true });
      stubPathname("/index.php/pr_project/showPackage/packageId/99999");
      loadFixture("pr_project-showPackage");
      const { autoSortByDate } = await importDateSort();

      await autoSortByDate();

      expect(requestedByClick).toEqual([
        "/index.php/filter/sort/f/PrMonitoringFilter/m/pr_project/a/listMonitorings_164/v/monitoring.DATE/o/desc",
      ]);
    });

    it("clicks the date column of the invoice's 'Zeiten importieren' list", async () => {
      await chrome.storage.local.set({ autoDateSortSetting: true });
      stubPathname("/index.php/kb_invoice/show/id/99999");
      loadFixture("kb_invoice-show");
      const { autoSortByDate } = await importDateSort();

      await autoSortByDate();

      expect(requestedByClick).toEqual([
        "/index.php/filter/sort/f/KbInvoiceMonitoringFilter/m/kb_invoice/a/importMonitorings/v/monitoring.DATE/o/desc",
      ]);
    });
  });
});
