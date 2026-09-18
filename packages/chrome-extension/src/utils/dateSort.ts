import { chromeStorageSettings } from "@bexio-chrome-extension/shared";
import {
  getDateSortLinks,
  getListBlock,
  getListKey,
  getTimeEntryDateSortLinks,
  hasSortedColumn,
  isSortedColumn,
} from "../selectors/sortLinks";

/**
 * bexio sorts every column ascending on the first click, which for a date column shows the oldest
 * entries first. This points the link of every **unsorted** date column to descending instead.
 *
 * Rewriting the `href` is enough: bexio's delegated `.ajxl` click handler reads it at click time.
 * A sorted column is left alone — its link is bexio's toggle to the opposite direction, and
 * rewriting it would make ascending unreachable.
 *
 * bexio replaces the whole table block on every sort, paging and filter change, so this has to
 * run again after each of them (see the observers in `apps/bexioProjectList/index.ts`).
 */
export function preferDescendingDateSort(root: ParentNode = document) {
  for (const link of getDateSortLinks(root)) {
    if (!isSortedColumn(link)) {
      link.setAttribute("href", link.getAttribute("href")!.replace(/\/o\/asc$/, "/o/desc"));
    }
  }
}

// bexio answers a sort click by replacing the list's block, which calls autoSortByDate() again
// through the observers. These three keep that from turning into an endless reload loop:
// a block is clicked once, and a list whose answer comes back unsorted is left alone for good.
const clickedBlocks = new WeakSet<Element>();
const awaitingSortedAnswer = new Set<string>();
const gaveUpOn = new Set<string>();

/**
 * Sorts every list of time entries on the page by date, newest first, when `autoDateSortSetting`
 * is on and the list has no sorted column. They arrive unsorted practically always: bexio's menu
 * opens the time tracking list through `monitoring/list/resetListView/1`, which clears the sort of
 * the session; a project's and a work package's time list forget theirs on every page load, the
 * invoice's "Zeiten importieren" modal every time it is opened.
 *
 * The sort is a click on bexio's own link, so bexio's handler does the loading mask, the request
 * and the block replacement. Other date columns (the tasks' due date) are not sorted — "newest
 * first" is about time entries.
 */
export async function autoSortByDate() {
  if (!(await chromeStorageSettings.loadAutoDateSortSetting())) {
    return;
  }
  // No await below this line, so two overlapping calls cannot both click the same block.
  for (const dateLink of getTimeEntryDateSortLinks()) {
    const block = getListBlock(dateLink);
    const list = getListKey(dateLink);
    if (hasSortedColumn(block)) {
      awaitingSortedAnswer.delete(list);
    } else if (gaveUpOn.has(list) || clickedBlocks.has(block)) {
      // nothing to do: given up, or bexio's answer to our click is still on its way
    } else if (awaitingSortedAnswer.has(list)) {
      gaveUpOn.add(list);
      console.warn("[bexio extension] The list came back unsorted after the automatic date sort, giving up", list);
    } else {
      awaitingSortedAnswer.add(list);
      clickedBlocks.add(block);
      preferDescendingDateSort(block);
      dateLink.click();
    }
  }
}
