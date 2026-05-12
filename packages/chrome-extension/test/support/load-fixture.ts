import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FIXTURE_DIR = resolve(__dirname, "../fixtures/bexio");

/**
 * Reads a captured bexio HTML fixture and installs it as the current jsdom
 * document body. Returns the global `document` for convenience.
 *
 * @param name fixture file name without extension, e.g. "monitoring-edit"
 */
export function loadFixture(name: string): Document {
  const html = readFileSync(resolve(FIXTURE_DIR, `${name}.html`), "utf8");
  document.body.innerHTML = html;
  return document;
}

/** Reads a fixture's raw HTML without touching the DOM. */
export function readFixture(name: string): string {
  return readFileSync(resolve(FIXTURE_DIR, `${name}.html`), "utf8");
}
