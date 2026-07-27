import { beforeEach, describe, expect, it, vi } from "vitest";
import confirmTemplateDeletion from "../confirmTemplateDeletion";
import * as te from "../chromeStorageTemplateEntries";
import type { TemplateEntry } from "../types";

const sample = (over: Partial<TemplateEntry> = {}): TemplateEntry => ({
  templateName: "T",
  keywords: "",
  billable: true,
  contact: "",
  contactPerson: "",
  id: "id1",
  package: "",
  project: "",
  status: "Offen",
  work: "",
  ...over,
});

describe("confirmTemplateDeletion", () => {
  beforeEach(() => {
    // confirm and alert are not defined in node — stub them on globalThis
    vi.stubGlobal("confirm", vi.fn());
    vi.stubGlobal("alert", vi.fn());
  });

  it("calls confirm with the template name in the message", async () => {
    const confirmSpy = vi.mocked(globalThis.confirm);
    confirmSpy.mockReturnValue(false);

    await confirmTemplateDeletion("id1", "MyTemplate");

    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(confirmSpy.mock.calls[0][0]).toContain("MyTemplate");
  });

  it("deletes the template from storage when user confirms", async () => {
    const confirmSpy = vi.mocked(globalThis.confirm);
    confirmSpy.mockReturnValue(true);

    const entry = sample({ id: "del", templateName: "ToDelete" });
    await te.saveTemplates([entry, sample({ id: "keep" })]);

    await confirmTemplateDeletion("del", "ToDelete");

    // Give the async deleteTemplate().then(loadTemplates()) chain time to finish
    await new Promise((resolve) => setTimeout(resolve, 50));

    const remaining = await te.loadTemplates();
    expect(remaining).toEqual([sample({ id: "keep" })]);
  });

  it("does not delete anything when user cancels", async () => {
    const confirmSpy = vi.mocked(globalThis.confirm);
    confirmSpy.mockReturnValue(false);

    const entry = sample({ id: "stay", templateName: "Stay" });
    await te.saveTemplates([entry]);

    await confirmTemplateDeletion("stay", "Stay");

    const remaining = await te.loadTemplates();
    expect(remaining).toEqual([entry]);
  });

  it("calls alert (not confirm) when templateId is undefined", async () => {
    const alertSpy = vi.mocked(globalThis.alert);
    const confirmSpy = vi.mocked(globalThis.confirm);

    await confirmTemplateDeletion(undefined as any, "AnyName");

    expect(alertSpy).toHaveBeenCalledOnce();
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
