/**
 * Returns the block that holds a project's time list ("Zeiten" tab) on `pr_project/listMonitoring`,
 * or `null` elsewhere. bexio replaces its only child (`.lf_content`) on every sort, paging and
 * filter change; the block itself stays.
 *
 * Gated by the path because `.listBlock` alone is not unique to this page: a work package
 * (`pr_project/showPackage`) has one too, holding its tab widget.
 */
export const getProjectTimesList = () =>
  location.pathname.startsWith("/index.php/pr_project/listMonitoring")
    ? document.querySelector<HTMLElement>(".listBlock")
    : null;
