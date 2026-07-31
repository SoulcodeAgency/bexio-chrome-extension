import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";
import type { TemplateEntry } from "@bexio-chrome-extension/shared/types";

// Use vi.hoisted so the calls array is available in the vi.mock factory bodies
// (vi.mock factories are hoisted before module-level code executes)
const { calls } = vi.hoisted(() => ({ calls: [] as string[] }));

vi.mock(
  "@bexio-chrome-extension/chrome-extension/src/utils/triggerField",
  () => ({
    default: vi.fn(async (sel: string, val: unknown) => {
      calls.push(`field:${sel}:${String(val)}`);
    }),
  }),
);

vi.mock(
  "@bexio-chrome-extension/chrome-extension/src/utils/triggerContactField",
  () => ({
    default: vi.fn(async (_el: unknown, val: unknown) => {
      calls.push(`contact:${String(val)}`);
    }),
  }),
);

vi.mock(
  "@bexio-chrome-extension/chrome-extension/src/utils/triggerCheckbox",
  () => ({
    default: vi.fn(async (_el: unknown, val: unknown) => {
      calls.push(`billable:${String(val)}`);
    }),
  }),
);

vi.mock(
  "@bexio-chrome-extension/chrome-extension/src/utils/loader",
  () => ({
    toggleDisplayLoader: vi.fn((show?: boolean) => {
      calls.push(`loader:${show === false ? "off" : "on"}`);
    }),
  }),
);

// Mocked because the real module re-renders the whole template UI (and calls
// initializeExtension() at module load, which would need chrome.runtime.getURL).
vi.mock(
  "@bexio-chrome-extension/chrome-extension/src/apps/bexioTimetrackingTemplates/index",
  () => ({
    initializeExtension: vi.fn(async () => {
      calls.push("reinit");
    }),
  }),
);

const template = (over: Partial<TemplateEntry> = {}): TemplateEntry => ({
  templateName: "T",
  keywords: "",
  billable: false,
  contact: "Acme AG",
  contactPerson: "Doe Jane",
  id: "tmpl1",
  package: "Package Alpha",
  project: "Project Falcon",
  status: "In Arbeit",
  work: "",
  ...over,
});

describe("fillForm", () => {
  beforeEach(() => {
    vi.resetModules();
    calls.length = 0;
    document.body.innerHTML = "";
  });

  it("applies all template fields in the correct order, toggles the loader, and focuses the save button", async () => {
    await chrome.storage.local.set({ entries: [template()] });
    loadFixture("monitoring-edit");
    const { default: fillForm } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/fillForm"
    );
    await fillForm("tmpl1");

    // The exact call order from fillForm.ts:
    // toggleDisplayLoader() → triggerField(workFieldID, "work") → triggerField(statusFieldID, status)
    // → triggerContactField(contactField, contact) → triggerField(contactPersonID, contactPerson)
    // → triggerField(projectFieldID, project) → triggerField(packageFieldID, packageValue)
    // → triggerCheckbox(billableCheckbox, billable) → toggleDisplayLoader(false) → .save.focus()
    const expected = [
      "loader:on",
      "field:#s2id_monitoring_client_service_id:work",
      "field:#s2id_monitoring_monitoring_status_id:In Arbeit",
      "contact:Acme AG",
      "field:#s2id_monitoring_sub_contact_id:Doe Jane",
      "field:#s2id_monitoring_pr_project_id:Project Falcon",
      "field:#s2id_monitoring_pr_package_id:Package Alpha",
      "billable:false",
      "loader:off",
    ];
    expect(calls).toEqual(expected);

    // Focus is placed on the save button after loader hides
    const form = document.getElementById("MonitoringForm") as HTMLFormElement;
    const saveBtn = form.getElementsByClassName("save")[0] as HTMLElement;
    expect(document.activeElement).toBe(saveBtn);
  });

  it("timeEntryBillable overrides the template's billable flag", async () => {
    await chrome.storage.local.set({ entries: [template({ billable: false })] });
    loadFixture("monitoring-edit");
    const { default: fillForm } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/fillForm"
    );
    await fillForm("tmpl1", true);
    expect(calls).toContain("billable:true");
    expect(calls).not.toContain("billable:false");
  });

  it("defaults billable to true when the template has no billable field", async () => {
    const t = template();
    // Remove the billable property to trigger the default in the destructure
    delete (t as Partial<TemplateEntry>).billable;
    await chrome.storage.local.set({ entries: [t] });
    loadFixture("monitoring-edit");
    const { default: fillForm } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/fillForm"
    );
    await fillForm("tmpl1");
    // `const { ..., billable = true } = entry` defaults to true when absent
    expect(calls).toContain("billable:true");
  });

  it("hides the loader, tells the user and refreshes the list when no template matches the id", async () => {
    await chrome.storage.local.set({ entries: [template()] });
    loadFixture("monitoring-edit");
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const { default: fillForm } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/fillForm"
    );

    await expect(fillForm("deleted-template")).resolves.toBeUndefined();

    // No form field is touched; the loader is closed again and the injected
    // template list is re-rendered so the stale button disappears.
    expect(calls).toEqual(["loader:on", "loader:off", "reinit"]);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(String(alertSpy.mock.calls[0][0])).toMatch(/template/i);
  });

  it("passes null to triggerField for absent project/package/status/contactPerson", async () => {
    await chrome.storage.local.set({
      entries: [
        template({
          project: undefined as unknown as string,
          package: undefined as unknown as string,
          status: undefined as unknown as string,
          contactPerson: undefined as unknown as string,
        }),
      ],
    });
    loadFixture("monitoring-edit");
    const { default: fillForm } = await import(
      "@bexio-chrome-extension/chrome-extension/src/utils/fillForm"
    );
    await fillForm("tmpl1");
    // project and package fall through to `?? null`; status and contactPerson default to null
    expect(calls).toContain("field:#s2id_monitoring_pr_project_id:null");
    expect(calls).toContain("field:#s2id_monitoring_pr_package_id:null");
    expect(calls).toContain("field:#s2id_monitoring_monitoring_status_id:null");
    expect(calls).toContain("field:#s2id_monitoring_sub_contact_id:null");
  });
});
