/**
 * Returns the block that holds the time tracking list on `monitoring/list`, or `null` elsewhere.
 * bexio replaces its only child (`.lf_content`) on every sort, paging and filter change; the block
 * itself stays.
 */
export const getTimeTrackingList = () => document.getElementById("monitoring_content");
