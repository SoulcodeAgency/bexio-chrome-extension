/**
 * jQuery UI generates the ids of a work package's tab panels at runtime (`ui-id-N`, numbered by
 * initialisation order), so they are not stable — the "Zeiten" panel moved from `#ui-id-5` to
 * `#ui-id-4` between 2026-05 and 2026-09. A panel is therefore resolved through its tab link, whose
 * `<li>` names the panel in `aria-controls`.
 */
const getPackageTabPanel = (tabLinkSelector: string) => {
  const panelId = document.querySelector(tabLinkSelector)?.closest("li")?.getAttribute("aria-controls");
  return panelId ? document.getElementById(panelId) : null;
};

/**
 * Returns the jQuery-UI tab panel that lists a work package's time entries (the "Zeiten" tab on
 * `pr_project/showPackage`), or `null` when the page has no such tab. bexio fills it when the tab
 * is opened for the first time.
 */
export const getPackageTimesPanel = () => getPackageTabPanel("a[href*='/pr_project/listMonitorings/']");

/**
 * Returns the panel of the "Aufgaben" tab, or `null` when the page has no such tab. It is the
 * active tab on load, but bexio fills it by AJAX — after the content script has run.
 */
export const getPackageTasksPanel = () => getPackageTabPanel("a[href*='/pr_project/listTasks/']");
