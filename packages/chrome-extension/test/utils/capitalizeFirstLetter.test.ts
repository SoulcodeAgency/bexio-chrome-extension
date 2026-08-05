/**
 * The description transform behind the "Capitalize notes" switch.
 *
 * It is deliberately a *first letter* transform, not a title-case or sentence-case one:
 * only the first non-whitespace code point of the whole string is touched.
 */
import { describe, expect, it } from "vitest";
import capitalizeFirstLetter from "@bexio-chrome-extension/chrome-extension/src/utils/capitalizeFirstLetter";

describe("capitalizeFirstLetter", () => {
  it("uppercases the first letter", () => {
    expect(capitalizeFirstLetter("leister weekly")).toBe("Leister weekly");
  });

  it("leaves the rest of the string alone", () => {
    expect(capitalizeFirstLetter("meeting with ACME AG about iOS")).toBe("Meeting with ACME AG about iOS");
  });

  it("skips leading whitespace instead of no-op'ing on it", () => {
    // handleCsvData trims whole lines, not individual cells, so a padded ManicTime
    // cell reaches this function with its indentation intact.
    expect(capitalizeFirstLetter("  leister weekly")).toBe("  Leister weekly");
    expect(capitalizeFirstLetter("\toperations")).toBe("\tOperations");
  });

  it("returns an already-capitalized string unchanged", () => {
    expect(capitalizeFirstLetter("Leister weekly")).toBe("Leister weekly");
  });

  it("returns an empty or whitespace-only string unchanged", () => {
    expect(capitalizeFirstLetter("")).toBe("");
    expect(capitalizeFirstLetter("   ")).toBe("   ");
  });

  it("leaves a string that starts with a caseless character unchanged", () => {
    expect(capitalizeFirstLetter("42 open tickets")).toBe("42 open tickets");
    expect(capitalizeFirstLetter("#hotfix release")).toBe("#hotfix release");
  });

  it("does not split an astral first character into broken surrogate halves", () => {
    expect(capitalizeFirstLetter("🚀 launch day")).toBe("🚀 launch day");
  });

  it("uppercases non-ASCII letters", () => {
    expect(capitalizeFirstLetter("übergabe an support")).toBe("Übergabe an support");
  });
});
