import { describe, expect, it } from "vitest";
import { buildDate } from "./buildDate.ts";

describe("buildDate", () => {
  it("keeps the format the extension has always shown", () => {
    expect(buildDate(new Date("2026-09-17T12:00:00Z"))).toBe("Sep 17, 2026");
  });

  it("uses the Swiss date, not the UTC runner's", () => {
    // 22:30 UTC is already 00:30 the next day in Zurich (CEST, UTC+2).
    expect(buildDate(new Date("2026-09-17T22:30:00Z"))).toBe("Sep 18, 2026");
  });

  it("follows the winter offset too", () => {
    // 23:30 UTC in January is 00:30 the next day in Zurich (CET, UTC+1).
    expect(buildDate(new Date("2026-01-05T23:30:00Z"))).toBe("Jan 6, 2026");
  });
});
