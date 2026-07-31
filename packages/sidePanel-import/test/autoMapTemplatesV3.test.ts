/**
 * `autoMapTemplatesV3` — the ManicTime tag → template auto-mapper (issue #91).
 *
 * The function is pure (input rows + templates in, an array of template ids out),
 * so these tests need no mocking beyond silencing its console diagnostics.
 *
 * Covered:
 * - legacy (pre-v0.5) templates without `templateName` do not throw and still match
 *   through the `getTemplateName` fallback (`id` was the name in v0.4.x)
 * - two templates sharing a name are scored independently (buckets are keyed by `id`)
 * - the exact-word / substring / per-field weighting still picks the same winners
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { autoMapTemplatesV3 } from "~/components/ImportEntries/AutoMapTemplatesV3";
import type { TemplateEntry } from "@bexio-chrome-extension/shared/types";

const importHeader = ["Tag 1", "01.07.2026"];
const tagColumnIndexes = [0];

/** A fully populated (v0.5+) template; every field defaults to a non-matching value. */
function template(overrides: Partial<TemplateEntry> & { id: string }): TemplateEntry {
  return {
    templateName: "",
    keywords: "",
    billable: false,
    contact: "",
    contactPerson: "",
    package: "",
    project: "",
    status: "Offen",
    work: "",
    ...overrides,
  };
}

/**
 * A v0.4.x template as it still sits in `chrome.storage.local`: no `templateName`
 * (and none of the fields added later), `id` doubles as the human-readable name.
 * The cast is deliberate — the stored shape predates the current type.
 */
function legacyTemplate(id: string): TemplateEntry {
  return { id } as unknown as TemplateEntry;
}

function map(rows: string[][], templates: TemplateEntry[]) {
  return autoMapTemplatesV3(rows, templates, importHeader, tagColumnIndexes);
}

describe("autoMapTemplatesV3", () => {
  beforeEach(() => {
    // The mapper logs a collapsed group + score table per row; keep the run quiet.
    vi.spyOn(console, "groupCollapsed").mockImplementation(() => {});
    vi.spyOn(console, "groupEnd").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "table").mockImplementation(() => {});
  });

  describe("legacy templates without templateName", () => {
    it("does not throw and matches the legacy template through its id fallback name", () => {
      const templates = [legacyTemplate("Legacy Falcon"), template({ id: "modern", templateName: "Unrelated" })];

      const result = map([["Falcon work", "1:30:00"]], templates);

      expect(result[0]).toBe("Legacy Falcon");
    });

    it("keeps mapping the remaining rows and templates when a legacy template is present", () => {
      const templates = [legacyTemplate("Legacy Falcon"), template({ id: "modern", templateName: "Internal Meeting" })];

      const result = map(
        [
          ["Falcon work", "1:30:00"],
          ["Meeting notes", "0:30:00"],
          ["Nothing matches here", "0:15:00"],
        ],
        templates,
      );

      expect(result[0]).toBe("Legacy Falcon");
      expect(result[1]).toBe("modern");
      // No match at all → the row is left for the user to decide.
      expect(result[2]).toBeUndefined();
    });
  });

  describe("templates sharing a name", () => {
    it("scores them independently instead of merging their points into one bucket", () => {
      // Both templates match the tag word "shared" equally well, so there is no
      // clear winner and the mapper must leave the decision to the user.
      const templates = [
        template({ id: "first", templateName: "Shared Name" }),
        template({ id: "second", templateName: "Shared Name" }),
      ];

      const result = map([["Shared", "1:00:00"]], templates);

      expect(result[0]).toBeUndefined();
    });

    it("still picks the better-matching one of two same-named templates", () => {
      const templates = [
        template({ id: "first", templateName: "Shared Name", contact: "Acme AG" }),
        template({ id: "second", templateName: "Shared Name" }),
      ];

      const result = map([["Shared Acme", "1:00:00"]], templates);

      expect(result[0]).toBe("first");
    });
  });

  describe("scoring weights (regression)", () => {
    it("prefers an exact word match over a substring match", () => {
      const templates = [
        template({ id: "exact", templateName: "Falcon" }),
        template({ id: "substring", templateName: "Falconry Extra" }),
      ];

      const result = map([["Falcon", "1:00:00"]], templates);

      expect(result[0]).toBe("exact");
    });

    it("prefers a contact match (high) over a project match (low)", () => {
      const templates = [
        template({ id: "byContact", templateName: "Alpha", contact: "Acme AG" }),
        template({ id: "byProject", templateName: "Beta", project: "Acme" }),
      ];

      const result = map([["Acme", "1:00:00"]], templates);

      expect(result[0]).toBe("byContact");
    });

    it("matches on template keywords too", () => {
      const templates = [
        template({ id: "withKeyword", templateName: "Alpha", keywords: "standup" }),
        template({ id: "other", templateName: "Beta" }),
      ];

      const result = map([["Standup", "1:00:00"]], templates);

      expect(result[0]).toBe("withKeyword");
    });

    it("ignores single characters and matches case-insensitively", () => {
      const templates = [template({ id: "alpha", templateName: "Alpha" }), template({ id: "a", templateName: "A" })];

      const result = map([["a ALPHA", "1:00:00"]], templates);

      expect(result[0]).toBe("alpha");
    });

    it("returns an empty assignment when nothing matches", () => {
      const templates = [template({ id: "alpha", templateName: "Alpha" })];

      const result = map([["Zzz", "1:00:00"]], templates);

      expect(result[0]).toBeUndefined();
    });
  });
});
