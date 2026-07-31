/**
 * Bexio monitoring-edit form selectors.
 *
 * IMPORTANT – module-load quirk: every `document.querySelector(...)` call
 * below executes **at import time** (module top level). The returned elements
 * are captured in `const` bindings and never re-queried.
 *
 * In the real content-script context this is safe because the browser injects
 * the script only after the page DOM has fully rendered.
 *
 * In tests you MUST load the fixture into `document.body` **before** importing
 * this module, and you MUST call `vi.resetModules()` in `beforeEach` so the
 * module is re-evaluated with a fresh DOM on every test.  See
 * `docs/architecture/form-layer.md` § "Module-load quirk" for details.
 */

// Selectors
export const workFieldID = "#s2id_monitoring_client_service_id";
export const workField = document.querySelector(`${workFieldID} input`) as HTMLInputElement;

export const statusFieldID = "#s2id_monitoring_monitoring_status_id";
export const statusField = document.querySelector(`${statusFieldID} input`) as HTMLInputElement;

export const projectFieldID = "#s2id_monitoring_pr_project_id";
export const projectField = document.querySelector(`${projectFieldID} input`) as HTMLInputElement;

export const packageFieldID = "#s2id_monitoring_pr_package_id";
export const packageField = document.querySelector(`${packageFieldID} input`) as HTMLInputElement;

export const contactPersonID = "#s2id_monitoring_sub_contact_id";
export const contactPersonField = document.querySelector(`${contactPersonID} input`) as HTMLInputElement;

export const loaderId = "SoulcodeExtensionLoader";
export const getLoader = () => document.getElementById(loaderId);