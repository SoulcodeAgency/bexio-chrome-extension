import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";

// Kept in sync with src/utils/pollUntil.ts. The tests advance fake timers past
// this deadline to assert the rejection, so it stays cheap even at 20 s.
const TIMEOUT_MS = 20_000;

describe("waitFor* helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // waitForSearchBoxField
  // ---------------------------------------------------------------------------

  it("waitForSearchBoxField resolves with the input element when #select2-drop input is already present", async () => {
    loadFixture("monitoring-edit");
    const { default: waitForSearchBoxField } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/waitForSearchBoxField"
    );

    // Inject the drop container before starting
    const drop = document.createElement("div");
    drop.id = "select2-drop";
    const searchInput = document.createElement("input");
    drop.appendChild(searchInput);
    document.body.appendChild(drop);

    const p = waitForSearchBoxField();
    await vi.advanceTimersByTimeAsync(0); // let the first synchronous poll run
    const result = await p;
    expect(result).toBe(searchInput);
  });

  it("waitForSearchBoxField keeps polling until the element appears (resolves on second poll)", async () => {
    loadFixture("monitoring-edit");
    const { default: waitForSearchBoxField } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/waitForSearchBoxField"
    );

    // Element not present yet
    const p = waitForSearchBoxField();

    // After the first poll (0ms) → not found → keeps polling every 250ms
    await vi.advanceTimersByTimeAsync(500);
    // Still not found; inject the element now
    const drop = document.createElement("div");
    drop.id = "select2-drop";
    const searchInput = document.createElement("input");
    drop.appendChild(searchInput);
    document.body.appendChild(drop);

    // Advance past the next poll interval → found → resolves
    await vi.advanceTimersByTimeAsync(1000);
    const result = await p;
    expect(result).toBe(searchInput);
  });

  it("waitForSearchBoxField rejects once the timeout elapses (#83)", async () => {
    loadFixture("monitoring-edit");
    const { default: waitForSearchBoxField } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/waitForSearchBoxField"
    );
    const { WaitForTimeoutError } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/pollUntil"
    );

    // The element never appears — bexio's drop failed to open.
    let error: unknown;
    const p = waitForSearchBoxField().catch((e: unknown) => { error = e; });

    // Still polling shortly before the deadline
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS - 1000);
    expect(error).toBeUndefined();

    await vi.advanceTimersByTimeAsync(2000);
    await p;
    expect(error).toBeInstanceOf(WaitForTimeoutError);
    expect((error as Error).message).toMatch(/#select2-drop input/);
  });

  // ---------------------------------------------------------------------------
  // waitForSearchBoxFieldToBeRemoved
  // ---------------------------------------------------------------------------

  it("waitForSearchBoxFieldToBeRemoved resolves immediately when #select2-drop input is absent", async () => {
    loadFixture("monitoring-edit"); // fixture has no #select2-drop
    const { default: waitForSearchBoxFieldToBeRemoved } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/waitForSearchBoxFieldToBeRemoved"
    );

    const p = waitForSearchBoxFieldToBeRemoved();
    await vi.advanceTimersByTimeAsync(0);
    await expect(p).resolves.toBeUndefined();
  });

  it("waitForSearchBoxFieldToBeRemoved keeps polling until the element is removed", async () => {
    loadFixture("monitoring-edit");
    const { default: waitForSearchBoxFieldToBeRemoved } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/waitForSearchBoxFieldToBeRemoved"
    );

    // Inject the drop so the first poll sees it
    const drop = document.createElement("div");
    drop.id = "select2-drop";
    drop.appendChild(document.createElement("input"));
    document.body.appendChild(drop);

    const p = waitForSearchBoxFieldToBeRemoved();
    await vi.advanceTimersByTimeAsync(0); // first poll: element present → schedule next

    // Remove the element and let the next poll run
    drop.remove();
    await vi.advanceTimersByTimeAsync(1000);
    await expect(p).resolves.toBeUndefined();
  });

  it("waitForSearchBoxFieldToBeRemoved rejects once the timeout elapses (#83)", async () => {
    loadFixture("monitoring-edit");
    const { default: waitForSearchBoxFieldToBeRemoved } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/waitForSearchBoxFieldToBeRemoved"
    );
    const { WaitForTimeoutError } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/pollUntil"
    );

    // Keep the element in the DOM — this is what a select2 search with no matching
    // result looks like: the drop stays open and nothing ever closes it.
    const drop = document.createElement("div");
    drop.id = "select2-drop";
    drop.appendChild(document.createElement("input"));
    document.body.appendChild(drop);

    let error: unknown;
    const p = waitForSearchBoxFieldToBeRemoved().catch((e: unknown) => { error = e; });

    await vi.advanceTimersByTimeAsync(TIMEOUT_MS - 1000);
    expect(error).toBeUndefined();

    await vi.advanceTimersByTimeAsync(2000);
    await p;
    expect(error).toBeInstanceOf(WaitForTimeoutError);
    expect((error as Error).message).toMatch(/disappear/);
  });

  // ---------------------------------------------------------------------------
  // waitForSelectOptions
  // ---------------------------------------------------------------------------

  it("waitForSelectOptions resolves immediately when the sibling select already has >1 options", async () => {
    loadFixture("monitoring-edit");
    const { default: waitForSelectOptions } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/waitForSelectOptions"
    );

    // status select has 6 options (empty + 5 statuses) — resolves on first poll
    const p = waitForSelectOptions("#s2id_monitoring_monitoring_status_id");
    await vi.advanceTimersByTimeAsync(0);
    await expect(p).resolves.toBeUndefined();
  });

  it("waitForSelectOptions keeps polling when the sibling select has ≤1 options, resolves when more arrive", async () => {
    loadFixture("monitoring-edit");
    const { default: waitForSelectOptions } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/waitForSelectOptions"
    );

    // project select has 0 options initially
    const p = waitForSelectOptions("#s2id_monitoring_pr_project_id");
    await vi.advanceTimersByTimeAsync(500); // still 0 options

    // Inject options into the sibling select
    const projectSelect = document.querySelector("#monitoring_pr_project_id") as HTMLSelectElement;
    const opt1 = document.createElement("option");
    opt1.value = "";
    const opt2 = document.createElement("option");
    opt2.value = "1";
    opt2.text = "Project Falcon";
    projectSelect.appendChild(opt1);
    projectSelect.appendChild(opt2);

    await vi.advanceTimersByTimeAsync(1000); // poll fires → now 2 options → resolves
    await expect(p).resolves.toBeUndefined();
  });

  it("waitForSelectOptions rejects once the timeout elapses, naming the selector (#83)", async () => {
    loadFixture("monitoring-edit");
    const { default: waitForSelectOptions } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/waitForSelectOptions"
    );
    const { WaitForTimeoutError } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/pollUntil"
    );

    // package select has only 1 option (the empty one) — the AJAX load never lands
    let error: unknown;
    const p = waitForSelectOptions("#s2id_monitoring_pr_package_id").catch((e: unknown) => { error = e; });

    await vi.advanceTimersByTimeAsync(TIMEOUT_MS - 1000);
    expect(error).toBeUndefined();

    await vi.advanceTimersByTimeAsync(2000);
    await p;
    expect(error).toBeInstanceOf(WaitForTimeoutError);
    expect((error as Error).message).toMatch(/#s2id_monitoring_pr_package_id/);
  });

  it("waitForSelectOptions honours a custom timeout", async () => {
    loadFixture("monitoring-edit");
    const { default: waitForSelectOptions } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/waitForSelectOptions"
    );

    let error: unknown;
    // interval 100 ms, deadline 500 ms
    const p = waitForSelectOptions("#s2id_monitoring_pr_package_id", 100, 500).catch((e: unknown) => { error = e; });

    await vi.advanceTimersByTimeAsync(400);
    expect(error).toBeUndefined();

    await vi.advanceTimersByTimeAsync(200);
    await p;
    expect((error as Error).message).toContain("500ms");
  });

  // ---------------------------------------------------------------------------
  // waitForSelectOptions — expectedValue (#84)
  // ---------------------------------------------------------------------------

  it("waitForSelectOptions resolves immediately when the expected value is already among the options", async () => {
    loadFixture("monitoring-edit");
    const { default: waitForSelectOptions } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/waitForSelectOptions"
    );

    const p = waitForSelectOptions("#s2id_monitoring_monitoring_status_id", undefined, "In Arbeit");
    await vi.advanceTimersByTimeAsync(0);
    await expect(p).resolves.toBeUndefined();
  });

  it("waitForSelectOptions matches the expected value case-insensitively and ignores surrounding whitespace", async () => {
    // fillForm always searches the literal "work" while bexio labels the option "Work".
    loadFixture("monitoring-edit");
    const { default: waitForSelectOptions } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/waitForSelectOptions"
    );

    const p = waitForSelectOptions("#s2id_monitoring_client_service_id", undefined, "  work ");
    await vi.advanceTimersByTimeAsync(0);
    await expect(p).resolves.toBeUndefined();
  });

  it("waitForSelectOptions keeps polling while the select only holds stale options, resolves when the expected value arrives", async () => {
    loadFixture("monitoring-edit");
    const { default: waitForSelectOptions } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/waitForSelectOptions"
    );

    // Stale list from a previous selection: length > 1, but not the value we want.
    const pkgSelect = document.querySelector("#monitoring_pr_package_id") as HTMLSelectElement;
    const stale = document.createElement("option");
    stale.value = "1";
    stale.text = "Package Alpha";
    pkgSelect.appendChild(stale);

    let settled = false;
    const p = waitForSelectOptions("#s2id_monitoring_pr_package_id", undefined, "Package Beta").then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(2000); // several polls — still the stale list
    expect(settled).toBe(false);

    // The AJAX response lands: the option list is replaced with the fresh one.
    stale.remove();
    const fresh = document.createElement("option");
    fresh.value = "2";
    fresh.text = "Package Beta";
    pkgSelect.appendChild(fresh);

    await vi.advanceTimersByTimeAsync(1000);
    await p;
    expect(settled).toBe(true);
  });

  it("waitForSelectOptions gives up waiting for a value that never appears once the value budget elapses", async () => {
    // Termination path: the searched value is genuinely not in the list (deleted
    // project, template that no longer matches the contact). The helper must not fail
    // the whole fill for that — it degrades to the plain "options are loaded" resolve.
    loadFixture("monitoring-edit");
    const { default: waitForSelectOptions } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/waitForSelectOptions"
    );

    const pkgSelect = document.querySelector("#monitoring_pr_package_id") as HTMLSelectElement;
    const other = document.createElement("option");
    other.value = "1";
    other.text = "Package Alpha";
    pkgSelect.appendChild(other);

    let settled = false;
    // Budget of 2000ms, counted from the first poll (where the options are already
    // loaded): the polls at 0ms and 1000ms still wait, the 2000ms poll resolves anyway.
    const p = waitForSelectOptions("#s2id_monitoring_pr_package_id", 1000, "Nothing Like This", 2000).then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(1000);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1000);
    await p;
    expect(settled).toBe(true);
  });

  it("waitForSelectOptions still waits for the options to load at all before the value budget starts", async () => {
    // The value budget only counts once the base condition holds: an empty select
    // must not burn the budget and resolve early. (The base wait itself rejects
    // after the 20s deadline, #83 — well beyond this test's horizon.)
    loadFixture("monitoring-edit");
    const { default: waitForSelectOptions } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/waitForSelectOptions"
    );

    let settled = false;
    // project select has 0 options in the fixture
    const p = waitForSelectOptions("#s2id_monitoring_pr_project_id", 1000, "Project Falcon", 2000).then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(10_000);
    expect(settled).toBe(false);

    // Cleanup: let the options arrive so the promise settles
    const projectSelect = document.querySelector("#monitoring_pr_project_id") as HTMLSelectElement;
    for (const [value, text] of [["", ""], ["1", "Project Falcon"]]) {
      const option = document.createElement("option");
      option.value = value;
      option.text = text;
      projectSelect.appendChild(option);
    }
    await vi.advanceTimersByTimeAsync(1000);
    await p;
  });

  // ---------------------------------------------------------------------------
  // waitForContacts
  // ---------------------------------------------------------------------------

  it("waitForContacts resolves when .ac_results is present and visible (display !== 'none')", async () => {
    loadFixture("monitoring-edit");
    const { default: waitForContacts } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/waitForContacts"
    );

    // Inject a visible .ac_results element
    const acResults = document.createElement("ul");
    acResults.className = "ac_results";
    acResults.style.display = "block";
    document.body.appendChild(acResults);

    const p = waitForContacts();
    await vi.advanceTimersByTimeAsync(0);
    await expect(p).resolves.toBeUndefined();
  });

  it("waitForContacts keeps polling when .ac_results is absent, resolves when it appears", async () => {
    loadFixture("monitoring-edit");
    const { default: waitForContacts } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/waitForContacts"
    );

    const p = waitForContacts();
    await vi.advanceTimersByTimeAsync(500); // not found yet

    // Inject visible .ac_results
    const acResults = document.createElement("ul");
    acResults.className = "ac_results";
    acResults.style.display = "block";
    document.body.appendChild(acResults);

    await vi.advanceTimersByTimeAsync(1000); // poll fires → found + visible → resolves
    await expect(p).resolves.toBeUndefined();
  });

  it("waitForContacts keeps polling when .ac_results is present but display:none", async () => {
    loadFixture("monitoring-edit");
    const { default: waitForContacts } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/waitForContacts"
    );

    // Inject a hidden .ac_results
    const acResults = document.createElement("ul");
    acResults.className = "ac_results";
    acResults.style.display = "none";
    document.body.appendChild(acResults);

    let settled = false;
    const p = waitForContacts().then(() => { settled = true; });

    await vi.advanceTimersByTimeAsync(3000); // several polls — still hidden
    expect(settled).toBe(false);

    // Make it visible
    acResults.style.display = "block";
    await vi.advanceTimersByTimeAsync(1000);
    await p;
    expect(settled).toBe(true);
  });

  it("waitForContacts rejects once the timeout elapses (#83)", async () => {
    loadFixture("monitoring-edit");
    const { default: waitForContacts } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/waitForContacts"
    );
    const { WaitForTimeoutError } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/pollUntil"
    );

    // No .ac_results anywhere — the contact lookup matched nothing or failed.
    let error: unknown;
    const p = waitForContacts().catch((e: unknown) => { error = e; });

    await vi.advanceTimersByTimeAsync(TIMEOUT_MS - 1000);
    expect(error).toBeUndefined();

    await vi.advanceTimersByTimeAsync(2000);
    await p;
    expect(error).toBeInstanceOf(WaitForTimeoutError);
    expect((error as Error).message).toMatch(/\.ac_results/);
  });
});
