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

/**
 * Populates an `<iframe>`'s `contentDocument` with a captured fixture.
 *
 * jsdom gives an attached `<iframe>` an empty `about:blank` document — it never
 * loads the fixture's inner document for you, so anything that reaches through
 * `iframe.contentWindow.document` (e.g. `getDescriptionField()` → the TinyMCE
 * `body#tinymce`) finds nothing unless the document is injected by hand.
 *
 * The fixture is parsed with `DOMParser` and swapped in as the iframe
 * document's `documentElement` (rather than `document.write`n) so no navigation
 * is involved. Inline `onload` attributes are stripped first: the captured
 * TinyMCE body carries `onload="window.parent.tinyMCE...."`, and jsdom fires
 * the iframe's load event after the swap, which would throw because the
 * fixtures ship without bexio's JavaScript.
 *
 * @param iframe the iframe element already attached to the main document
 * @param name fixture file name without extension, e.g. "monitoring-edit.tinymce-iframe"
 */
export function loadIframeFixture(iframe: HTMLIFrameElement, name: string): Document {
  const iframeDocument = iframe.contentDocument;
  if (!iframeDocument) {
    throw new Error(`Iframe has no contentDocument — is it attached to the document? (fixture: ${name})`);
  }
  const parsed = new DOMParser().parseFromString(readFixture(name), "text/html");
  parsed.querySelectorAll("[onload]").forEach((element) => element.removeAttribute("onload"));
  iframeDocument.replaceChild(iframeDocument.importNode(parsed.documentElement, true), iframeDocument.documentElement);
  return iframeDocument;
}
