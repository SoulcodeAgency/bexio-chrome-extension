/**
 * Returns the jQuery-UI tab panel that lists a work package's time entries (the "Zeiten" tab on
 * `pr_project/showPackage`), or `null` when the page has no such tab.
 *
 * jQuery UI generates the panel id at runtime (`ui-id-N`, numbered by initialisation order), so
 * the id is not stable — it moved from `#ui-id-5` to `#ui-id-4` between 2026-05 and 2026-09. The
 * panel is therefore resolved through its tab link, whose `<li>` names the panel in `aria-controls`.
 */
export const getPackageTimesPanel = () => {
  const panelId = document
    .querySelector("a[href*='/pr_project/listMonitorings/']")
    ?.closest("li")
    ?.getAttribute("aria-controls");
  return panelId ? document.getElementById(panelId) : null;
};
