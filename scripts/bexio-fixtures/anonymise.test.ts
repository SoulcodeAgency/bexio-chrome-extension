import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { findLeaks, scrubDom, scrubText } from "./anonymise.ts";

// Every case below is a shape found in a real bexio capture (2026-09-17). The fixtures are
// committed to a public repository, so a scrub that misses one of them publishes it.
const HEX_TOKEN = "922d23d8b482b2c2944eefee21c519b2";
const JWT =
  "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIn0.eyJleHAiOjE3ODk2NjM1MDQsImlhdCI6MTc4OTY0OTEwNH0.c2lnbmF0dXJlLXZhbHVl";

describe("scrubText", () => {
  it("replaces a CSRF token inside a URL-encoded onclick handler", () => {
    const html = `onclick="m.setAttribute%28%27value%27%2C%20%27${HEX_TOKEN}%27%29"`;
    expect(scrubText(html, [])).toBe(`onclick="m.setAttribute%28%27value%27%2C%20%27TEST_CSRF_TOKEN%27%29"`);
  });

  it("replaces a CSRF token in a URL path", () => {
    expect(scrubText("/kb/deletePosition/id/1/csrf_token/tepJq-UBKKFDY7D5pkkx3IClCnpW6dTdQuz7RBzTb8c", [])).toBe(
      "/kb/deletePosition/id/99999/csrf_token/TEST_CSRF_TOKEN",
    );
  });

  it("replaces access tokens, e-mail addresses, UUIDs and extension ids", () => {
    const html = [
      `value="${JWT}"`,
      "mailto:someone@company.ch",
      "profile/images/a630d2be-e864-4a97-b8c8-95e6661fcf79.png",
      "chrome-extension://flkgdpjlakpehjdahgfmikdiikkgmaej/logo.png",
    ].join(" ");

    expect(scrubText(html, [])).toBe(
      [
        `value="TEST_ACCESS_TOKEN"`,
        "mailto:person@example.com",
        "profile/images/00000000-0000-0000-0000-000000000000.png",
        "chrome-extension://EXTENSION_ID_PLACEHOLDER/logo.png",
      ].join(" "),
    );
  });

  it("replaces record ids in paths and item row ids", () => {
    expect(scrubText(`<tr id="item27484"><a href="/pr_project/show/id/197/projectId/197">`, [])).toBe(
      `<tr id="item90001"><a href="/pr_project/show/id/99999/projectId/99999">`,
    );
  });

  it("replaces invoice numbers", () => {
    expect(scrubText("<h2>Rechnung IN-00884</h2>", [])).toBe("<h2>Rechnung IN-00001</h2>");
  });

  it("applies the literal replacements in order", () => {
    expect(
      scrubText("Leister AG / Leister", [
        ["Leister AG", "Globex GmbH"],
        ["Leister", "Globex"],
      ]),
    ).toBe("Globex GmbH / Globex");
  });
});

describe("scrubDom", () => {
  const scrub = (body: string) => {
    const { document } = new JSDOM(`<!doctype html><body>${body}</body>`).window;
    scrubDom(document);
    return document;
  };

  it("replaces every popover text, the first one with an entity and the second one with markup", () => {
    const document = scrub(
      `<i rel="popover" data-content="real note"></i><i rel="popover" data-content="other"></i><i rel="popover" data-content="x"></i>`,
    );
    expect([...document.querySelectorAll("i")].map((icon) => icon.getAttribute("data-content"))).toEqual([
      "Sample time entry 1 & QA",
      "Sample time entry 2<br />second line",
      "Sample time entry 3",
    ]);
  });

  it("replaces e-mail addresses in other data-content markup, such as the team cards", () => {
    const document = scrub(`<a rel="sticky" data-content='<a href="mailto:a.b@company.ch">a.b@company.ch</a>'></a>`);
    expect(document.querySelector("a")!.getAttribute("data-content")).toBe(
      '<a href="mailto:team.member@example.com">team.member@example.com</a>',
    );
  });

  it("drops bexio's inline event handlers, which CodeQL analyses as code of this repository", () => {
    const document = scrub(
      `<button onclick="f.action = selectedDropdown.val(); f.submit()" class="btn">Go</button><select onchange="toggle()"></select>`,
    );
    expect(document.body.innerHTML).toBe(`<button class="btn">Go</button><select></select>`);
  });

  it("blanks the name and the access token in bexio's hidden support form", () => {
    const document = scrub(
      `<input name="firstname" value="Real"><input name="lastname" value="Person"><input name="token" value="${JWT}">`,
    );
    expect([...document.querySelectorAll("input")].map((input) => input.getAttribute("value"))).toEqual([
      "Jane",
      "Doe",
      "TEST_ACCESS_TOKEN",
    ]);
  });
});

describe("findLeaks", () => {
  it("finds credentials and personal data a scrub missed", () => {
    const html = [
      `value="${JWT}"`,
      `%27${HEX_TOKEN}%27`,
      "csrf_token/tepJq-UBKKFDY7D5pkkx3IClCnpW6dTdQuz7RBzTb8c",
      "someone@company.ch",
      "a630d2be-e864-4a97-b8c8-95e6661fcf79",
      "chrome-extension://flkgdpjlakpehjdahgfmikdiikkgmaej",
    ].join(" ");

    expect(findLeaks(html, []).map((leak) => leak.label)).toEqual(
      expect.arrayContaining(["jwt", "hex-token", "csrf-path-token", "email", "uuid", "extension-id"]),
    );
  });

  it("finds a sensitive name inside URL-encoded markup and inside a base64 path parameter", () => {
    const encoded = "jq_load_small_confirm('Projekt%20Leister%20l%C3%B6schen')";
    const base64 = `/lookup/index/params/${encodeURIComponent(Buffer.from("contact=Leister AG").toString("base64"))}/x`;

    expect(findLeaks(encoded, ["Leister"])).not.toEqual([]);
    expect(findLeaks(base64, ["Leister"])).not.toEqual([]);
  });

  it("matches short sensitive tokens as whole words only", () => {
    expect(findLeaks("Benutzer", ["Ben"])).toEqual([]);
    expect(findLeaks("Alignment with Ben", ["Ben"])).not.toEqual([]);
  });

  it("accepts the placeholders, 64-character template ids and this extension's own element ids", () => {
    const html = [
      "TEST_CSRF_TOKEN TEST_ACCESS_TOKEN person@example.com 00000000-0000-0000-0000-000000000000",
      "chrome-extension://EXTENSION_ID_PLACEHOLDER csrf_token/TEST_CSRF_TOKEN",
      `<button id="3da297d5fa9116df9d5fe5326f81df83d5727e91950598aadb608fe6fb5c2ebb">`,
      `<div id="SoulcodeExtensionTemplates">`,
    ].join(" ");

    expect(findLeaks(html, ["Soulcode"])).toEqual([]);
  });
});
