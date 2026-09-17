import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { findLeaks } from "./anonymise.ts";

const FIXTURE_DIR = resolve(import.meta.dirname, "../../packages/chrome-extension/test/fixtures/bexio");
const fixtures = readdirSync(FIXTURE_DIR).filter((file) => file.endsWith(".html"));

// The repository is public. The names of real people and clients live only in the git-ignored
// _raw/anonymise.local.json, so this guard checks the generic patterns: access tokens, CSRF
// tokens, e-mail addresses, UUIDs and extension ids.
describe("committed bexio fixtures", () => {
  it("exist", () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  it.each(fixtures)("%s contains no credentials or personal identifiers", (file) => {
    const leaks = findLeaks(readFileSync(resolve(FIXTURE_DIR, file), "utf8"), []);
    expect(leaks.map((leak) => `${leak.label}: …${leak.context}…`)).toEqual([]);
  });
});
