# Date column sorting

## Overview

bexio sorts every list column **ascending on the first click**. For a date column that shows the
oldest entries first (2019 on the time tracking list), and a second click is needed to get to the
newest ones. The `bexioProjectList` content script changes that in two steps:

1. **Link rewrite (always on, all four pages):** the sort link of every _unsorted_ date column
   points to descending, so the first click shows the newest entries.
2. **"Newest first" toggle (opt-in, all four pages):** when on, every list of time entries is sorted
   by date descending on its own whenever it arrives unsorted — the time tracking list, a project's
   and a work package's "Zeiten" tab, and the invoice's "Zeiten importieren" modal.

Code: `src/utils/dateSort.ts` (`preferDescendingDateSort`, `autoSortByDate`),
`src/selectors/sortLinks.ts`, `src/apps/bexioProjectList/renderDateSortToggle.ts`; the observers
that re-run both are in `src/apps/bexioProjectList/index.ts`. Issue #159 has the analysis.

---

## How bexio sorts (verified on live bexio, 2026-09-18)

**The links.** Column headers are plain links:

```html
<th>
  <a class="ajxl" href="/index.php/filter/sort/f/MonitoringFilter/m/monitoring/a/list/v/monitoring.DATE/o/asc">Datum</a>
</th>
```

`v` names the column, `o` the direction the click sorts to. The same pattern is on all four pages
of this content script: `monitoring.DATE` on `monitoring/list`, `pr_project/listMonitoring` and the
"Zeiten importieren" modal of `kb_invoice/show`; `task.FINISH_DATE` and `monitoring.DATE` on
`pr_project/showPackage`. A date column is recognised by `DATE` in the column name
(`DATE_SORT_HREF` in `selectors/sortLinks.ts`).

**The click.** One delegated jQuery handler on `document` serves all of them:

```js
$(document).on("click", ".lf_content.ajxon .ajxl", function (e) {
  // masks .dataTableHolder with "loading", then:
  e.preventDefault();
  $.get($(this).attr("href"), (html) => $lfContent.replaceWith(html));
});
```

Two consequences. The `href` is read **at click time**, so rewriting the attribute is all it takes —
no click handler of our own. And the whole `.lf_content` block is **replaced** on every sort, paging
and filter change, so whatever the extension did to the header is gone afterwards and has to be
redone. `.lf_content` is a direct child of the elements the existing observers watch
(`#monitoring_content`, `.listBlock`, the work package's tab panels, the modal's `.block.list` — see
`tooltip-replacement.md`), so they fire once per replacement; `onTableRendered()` in
`apps/bexioProjectList/index.ts` is the one callback for the initial render and all observers.

**The three header states.**

| State    | `span.caret` inside the link | `th` class | link points to |
| -------- | ---------------------------- | ---------- | -------------- |
| unsorted | no                           | `""`       | `/o/asc`       |
| ASC      | yes                          | `dropup`   | `/o/desc`      |
| DESC     | yes                          | `""`       | `/o/asc`       |

The caret is the only reliable "sorted" marker — and it must be looked up **inside the header
links** (`thead th a span.caret`): the rows carry carets of their own (action dropdowns, 203 of them
on a full list).

**Where the sort lives, and why it gets lost.** The sort is server-side state — nothing in
JS-visible cookies or `localStorage` — but the lists keep it for very different spans:

| List                                                     | the sort survives        | and is lost through                          | sort request (measured) |
| -------------------------------------------------------- | ------------------------ | -------------------------------------------- | ----------------------- |
| time tracking list (`monitoring/list`)                   | page loads (the session) | bexio's menu link `…/list/resetListView/1`   | 1.4 s, 653 KB, 200 rows |
| project's "Zeiten" tab (`pr_project/listMonitoring`)     | the loaded page          | every page load                              | 0.26 s, 76 KB, 15 rows  |
| work package's "Zeiten" tab (`pr_project/showPackage`)   | the loaded page          | every page load                              | not measured            |
| invoice's "Zeiten importieren" modal (`kb_invoice/show`) | the open modal           | every opening of the modal, same page or not | not measured            |

On `monitoring/list` a plain request after sorting comes back sorted; it gets lost because bexio's
menu does not link to `/monitoring/list` but to `/index.php/monitoring/list/resetListView/1` (same
for every module), and that request clears it for good. On the project and work package tabs the
sort only lives inside the loaded page: the sort response is sorted, the very next plain page load
is not. (A work package's tab panel is filled when the tab is first opened and then kept, so
switching tabs back and forth keeps the sort.) The modal is filled anew each time it is opened, and
always unsorted. Within a page, a list keeps its sort across its other AJAX links — filter tabs
(`filter/useFilter/…`), page size (`filter/setPagination/…`) and paging (`filter/setPage/…`);
checked on the first two lists. So every one of these lists arrives unsorted practically always —
which is what the toggle is for.

------------------------------------------------- | ------------------------------- | ------------------------------------------- | ----------------------- |
| time tracking list (`monitoring/list`) | yes, for the session | bexio's menu link `…/list/resetListView/1` | 1.4 s, 653 KB, 200 rows |
| project's time list (`pr_project/listMonitoring`) | **no** | every page load (the tab link has no reset) | 0.26 s, 76 KB, 15 rows |

On `monitoring/list` a plain request after sorting comes back sorted; it gets lost because bexio's
menu does not link to `/monitoring/list` but to `/index.php/monitoring/list/resetListView/1` (same
for every module), and that request clears it for good. On a project's time list the sort only
lives inside the loaded page: the sort response is sorted, the very next plain page load is not.
Within a page both keep the sort across their other AJAX links — filter tabs
(`filter/useFilter/…`), page size (`filter/setPagination/…`) and paging (`filter/setPage/…`). So
either list arrives unsorted practically every time — which is what the toggle is for.

---

## Link rewrite — `preferDescendingDateSort()`

For every date sort link that is **not** the sorted column (no caret), `/o/asc` becomes `/o/desc`.
A sorted column is left alone on purpose: its link is bexio's toggle to the opposite direction, and
in the DESC state that link says `/o/asc` — rewriting it would make ascending unreachable.

## Automatic sort — `autoSortByDate()`

When `autoDateSortSetting` is on, it looks at every list of time entries on the page — every
`.lf_content` block with a `monitoring.DATE` sort link — and, where no column is sorted, points the
date link to descending and calls `click()` on it. bexio's own handler does the loading mask, the
request and the block replacement.

- **Time entries only.** The tasks' due date (`task.FINISH_DATE`, work package) gets the link
  rewrite but is never sorted automatically — "newest first" says nothing sensible about due dates.
- **Isolated world → page.** The content script lives in an isolated world, bexio's jQuery in the
  page's. DOM events cross that boundary; pinned by the e2e test "date column points to descending,
  and 'Newest first' sorts through bexio's own click handler", whose stand-in handler runs in the
  page world.
- **No endless reload.** bexio answers the click by replacing the block, which calls
  `autoSortByDate()` again through the observers; should that block ever come back without a caret,
  clicking again would never stop. Three module-level sets prevent it. `clickedBlocks` (a `WeakSet`):
  a block is clicked once, however often it is looked at while bexio's answer is on its way — that
  also covers the initial run and an observer firing at the same time, since nothing is awaited
  between the check and the click. `awaitingSortedAnswer`: the lists (sort link without its
  direction) we clicked for; a sorted block takes its list off again. `gaveUpOn`: a _new_ unsorted
  block of a list we are still waiting for means bexio answered unsorted — that list is left alone
  until the page reloads, with a `console.warn`.
- **Again for every fresh arrival.** Because a sorted answer clears the wait, a list that arrives
  unsorted later on the same page — the invoice modal, opened a second time — is sorted again. A
  once-per-page-load flag (the first version) would have sorted only the first opening.
- **It never overrides the user.** Any sorted column — by date ascending, by text, … — counts as
  "something else chosen".
- **Cost.** One extra request per arrival, with bexio's loading mask. On the time tracking list:
  1.4 s for the request and up to 4.5 s until the new table stood, on top of a 3.3 s page load. On a
  project's time list: 0.26 s. That is why it is opt-in.

## The "Newest first" toggle

`renderDateSortToggle()` renders one `button#AutoDateSortToggle.btn` (icon
`halflings-sort-by-attributes-alt`) into the page title bar, between the "Text | Tooltip" toggle and
the primary action button — same wrapper block and same placement rules as that toggle
(`tooltip-replacement.md`). `aria-pressed` reflects `autoDateSortSetting` (default `false`);
`public/bexioProjectList.css` paints the pressed state in bexio's link blue. A click flips and
stores the setting; switching it **on** sorts the list right away, switching it off leaves the list
as it is. The click listener is attached after the stored state is shown, so a click always flips
what the user sees.

Rendered on all four pages, like "Text | Tooltip", and one setting serves them all. On the invoice
page the list only exists once the modal is open, and the modal's overlay covers the title bar — so
the toggle has to be switched before opening it (same limitation as "Text | Tooltip").

---

## Tests

- `test/utils/dateSort.test.ts` — the rewrite on all four fixtures (literal hrefs), the sorted-column
  guard, and every condition of the automatic sort: the loop guard (in-flight block, unsorted
  answer, a fresh arrival after a sorted answer), overlapping calls, tasks left alone.
- `test/apps/bexioProjectList.test.ts` ("date column sorting") — the wiring on all four pages:
  rewrite on load and after bexio replaces a list or fills the work package's "Aufgaben" panel, the
  automatic sort, the toggle.
- `e2e/extension-behaviour.spec.ts` — real Chrome: rewrite, toggle styling, the click crossing into
  the page world, the automatic sort after a reload.

All fixtures were captured **unsorted**. The sorted states are built in the tests by adding the
`span.caret` from the table above; a test stands in for bexio's delegated handler with a `document`
click listener that calls `preventDefault()` and records the `href`.

## Known limits

- **Closing the invoice modal before bexio answered the automatic click** leaves that list in
  `awaitingSortedAnswer`; the next opening then looks like an unsorted answer and the list is given
  up on until the page reloads. Harmless — the first click on "Datum" still sorts newest first.
- **A date column is recognised by its name.** A bexio date column without `DATE` in the column id
  would keep sorting ascending first.
- **The toggle's label is English** ("Newest first"), like "Text | Tooltip"; bexio's UI language is
  not followed.
