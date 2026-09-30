import { describe, expect, it } from "vitest";
import { findBestOption, matchOption, normalizeOptionText } from "../../src/utils/optionMatch";

describe("normalizeOptionText", () => {
  it("collapses whitespace, trims and lower-cases", () => {
    expect(normalizeOptionText("  Muster \n AG  ")).toBe("muster ag");
  });
});

describe("matchOption", () => {
  it("ranks exact, then substring (select2's rule), then the word set", () => {
    expect(matchOption("Muster AG", "muster ag")).toBe("exact");
    expect(matchOption("Muster AG - Website", "Muster AG")).toBe("substring");
    // bexio's new dialog lists people as "Lastname Firstname", the old form (and templates) as
    // "Firstname Lastname" (#168).
    expect(matchOption("Muster Max", "Max Muster")).toBe("words");
  });

  it("matches words only as whole words", () => {
    expect(matchOption("Mustermann Max", "Max Muster")).toBeNull();
  });

  it("never matches an empty option or an empty value", () => {
    expect(matchOption("", "x")).toBeNull();
    expect(matchOption("x", "  ")).toBeNull();
  });
});

describe("findBestOption", () => {
  const text = (option: string) => option;

  it("prefers an exact match over an earlier substring match", () => {
    expect(findBestOption(["Muster AG Zürich", "Muster AG"], "Muster AG", text)).toBe("Muster AG");
  });

  it("takes the first of equally good matches, as select2 highlighted the first hit", () => {
    expect(findBestOption(["Client - Project A", "Client - Project B"], "Client", text)).toBe("Client - Project A");
  });

  it("prefers a substring match over a word match", () => {
    expect(findBestOption(["Muster Max", "Max Muster (extern)"], "Max Muster", text)).toBe("Max Muster (extern)");
  });

  it("returns null when nothing matches", () => {
    expect(findBestOption(["A", "B"], "C", text)).toBeNull();
  });
});
