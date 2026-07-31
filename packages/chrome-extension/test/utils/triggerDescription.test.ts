import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture, loadIframeFixture } from "../support/load-fixture";

/**
 * `triggerDescription` writes into bexio's TinyMCE editor, which lives in the
 * `#monitoring_text_ifr` iframe. jsdom does not populate an iframe's
 * contentDocument, so every test injects the captured iframe fixture first
 * (see `loadIframeFixture`).
 */
function loadEditFormWithTinyMce(): HTMLElement {
  loadFixture("monitoring-edit");
  const iframe = document.querySelector("#monitoring_text_ifr") as HTMLIFrameElement;
  const iframeDocument = loadIframeFixture(iframe, "monitoring-edit.tinymce-iframe");
  return iframeDocument.querySelector("#tinymce") as HTMLElement;
}

describe("triggerDescription", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
  });

  it("writes the value into the tinymce iframe body and dispatches no events", async () => {
    const tinymceBody = loadEditFormWithTinyMce();
    const { default: triggerDescription } =
      await import("@bexio-chrome-extension/chrome-extension/src/utils/triggerDescription");

    // The captured body is TinyMCE's "empty" state: a single bogus <br>
    expect(tinymceBody.innerHTML).toContain("data-mce-bogus");

    const onInput = vi.fn();
    const onChange = vi.fn();
    tinymceBody.addEventListener("input", onInput);
    tinymceBody.addEventListener("change", onChange);

    await triggerDescription("Wrote the release notes");

    expect(tinymceBody.textContent).toBe("Wrote the release notes");
    expect(tinymceBody.querySelector("br")).toBeNull(); // textContent replaced the bogus <br>
    // KNOWN ISSUE: unlike triggerDate / triggerDuration, triggerDescription dispatches no
    // synthetic events at all — it only assigns textContent, so TinyMCE is never told the
    // content changed.
    expect(onInput).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("leaves the backing <textarea id='monitoring_text'> untouched", async () => {
    loadEditFormWithTinyMce();
    const { default: triggerDescription } =
      await import("@bexio-chrome-extension/chrome-extension/src/utils/triggerDescription");

    const textarea = document.querySelector("#monitoring_text") as HTMLTextAreaElement;
    await triggerDescription("Notes from ManicTime");

    // KNOWN ISSUE: only the iframe body is written. The form field bexio actually submits
    // is the hidden textarea, which TinyMCE syncs from the iframe on its own triggers —
    // nothing in the extension forces that sync.
    expect(textarea.value).toBe("");
  });

  it("stores markup as literal text (textContent, not innerHTML)", async () => {
    const tinymceBody = loadEditFormWithTinyMce();
    const { default: triggerDescription } =
      await import("@bexio-chrome-extension/chrome-extension/src/utils/triggerDescription");

    await triggerDescription("<b>bold</b> & <i>italic</i>");

    expect(tinymceBody.querySelector("b")).toBeNull();
    expect(tinymceBody.textContent).toBe("<b>bold</b> & <i>italic</i>");
    expect(tinymceBody.innerHTML).toBe("&lt;b&gt;bold&lt;/b&gt; &amp; &lt;i&gt;italic&lt;/i&gt;");
  });

  it("overwrites previous content, and an empty string clears the field", async () => {
    const tinymceBody = loadEditFormWithTinyMce();
    const { default: triggerDescription } =
      await import("@bexio-chrome-extension/chrome-extension/src/utils/triggerDescription");

    await triggerDescription("first");
    await triggerDescription("second");
    expect(tinymceBody.textContent).toBe("second");

    // No early-return guard for empty values (triggerField has one) — "" wipes the field
    await triggerDescription("");
    expect(tinymceBody.textContent).toBe("");
  });

  it("rejects when the tinymce iframe document isn't populated", async () => {
    loadFixture("monitoring-edit"); // iframe element present, but no inner #tinymce
    const { default: triggerDescription } =
      await import("@bexio-chrome-extension/chrome-extension/src/utils/triggerDescription");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    // KNOWN ISSUE: the `if (descriptionField)` guard in triggerDescription is dead code —
    // getDescriptionField throws instead of returning a falsy value, so the call rejects
    // rather than silently no-op'ing. onMessage calls triggerDescription without awaiting
    // or catching it, so this surfaces as an unhandled rejection.
    await expect(triggerDescription("anything")).rejects.toThrow("Description field not found");
    expect(consoleError).toHaveBeenCalled();
  });
});
