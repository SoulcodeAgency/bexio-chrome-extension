import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";

const importModule = async () =>
  await import("@bexio-chrome-extension/chrome-extension/src/utils/createTemplateFromForm");

describe("createTemplateFromForm", () => {
  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = "";
    await chrome.storage.local.set({ entries: [] });
  });

  it("saves a new entry with the form values and a stable 64-hex-char hash id", async () => {
    loadFixture("monitoring-edit-filled");
    const { createTemplateFromForm } = await importModule();
    const { default: generateHash } = await import("@bexio-chrome-extension/chrome-extension/src/utils/generateHash");

    const result = await createTemplateFromForm("My Template");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.entry.templateName).toBe("My Template");
    expect(result.entry.work).toBe("Work");
    expect(result.entry.status).toBe("Erledigt");
    expect(result.entry.project).toBe("Acme - Back Office");
    expect(result.entry.package).toBe("Misc");
    expect(/^[0-9a-f]{64}$/.test(result.entry.id)).toBe(true);

    // Hash stability: id === SHA-256 of the entry without id, in insertion order
    // (work, status, contact, project, package, billable, contactPerson, templateName).
    const { id, ...withoutId } = result.entry;
    expect(id).toBe(await generateHash(JSON.stringify(withoutId)));

    const stored = await chrome.storage.local.get("entries");
    expect((stored.entries as unknown[]).length).toBe(1);
  });

  it("returns duplicate for a second save with identical values and name", async () => {
    loadFixture("monitoring-edit-filled");
    const { createTemplateFromForm } = await importModule();

    expect((await createTemplateFromForm("Twice")).ok).toBe(true);
    const second = await createTemplateFromForm("Twice");
    expect(second).toEqual({ ok: false, reason: "duplicate" });

    const stored = await chrome.storage.local.get("entries");
    expect((stored.entries as unknown[]).length).toBe(1);
  });

  it("a different name produces a different id and saves alongside", async () => {
    loadFixture("monitoring-edit-filled");
    const { createTemplateFromForm } = await importModule();

    const first = await createTemplateFromForm("Name A");
    const second = await createTemplateFromForm("Name B");
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.entry.id).not.toBe(second.entry.id);

    const stored = await chrome.storage.local.get("entries");
    expect((stored.entries as unknown[]).length).toBe(2);
  });
});
