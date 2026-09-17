/**
 * Scrubbing and leak detection for the bexio DOM fixtures in
 * `packages/chrome-extension/test/fixtures/bexio/`. The repository is public, so every
 * fixture goes through `scrubDom` + `scrubText` and must come out of `findLeaks` empty.
 *
 * The names of real people and clients are not in this file: they are passed in from the
 * git-ignored `_raw/anonymise.local.json` (see `build.ts`). What lives here is everything
 * that can be recognised by shape.
 */

export type Replacement = [from: string, to: string];

export interface Leak {
  label: string;
  /** Which view of the markup the leak was found in. */
  variant: "raw" | "url-decoded" | "base64-param";
  context: string;
}

const EMAIL = /[\w.+-]+@(?!example\.com)[\w-]+\.[\w.-]+/g;

/**
 * DOM-level scrub: free text that carries names in unpredictable forms is replaced wholesale
 * instead of name by name.
 */
export function scrubDom(document: Document): void {
  const popovers = Array.from(document.querySelectorAll("i[rel='popover'][data-content]"));
  popovers.forEach((icon, index) => {
    const entry = index + 1;
    // #1 carries an entity and #2 markup, so convertPopover's decode and sanitise steps stay exercised.
    const text =
      entry === 1
        ? "Sample time entry 1 & QA"
        : entry === 2
          ? "Sample time entry 2<br />second line"
          : `Sample time entry ${entry}`;
    icon.setAttribute("data-content", text);
  });

  // e.g. the project sidebar's team cards, whose data-content holds mailto markup
  for (const element of Array.from(document.querySelectorAll("[data-content]:not(i[rel='popover'])"))) {
    const value = element.getAttribute("data-content") ?? "";
    element.setAttribute("data-content", value.replace(EMAIL, "team.member@example.com"));
  }

  // Inline event handlers are bexio's JavaScript, which the fixtures do not ship (its <script>
  // blocks are dropped at capture). They also carried CSRF tokens, and GitHub's CodeQL analyses
  // them as this repository's code (js/xss-through-dom on `f.action = selectedDropdown.val()`).
  for (const element of Array.from(document.querySelectorAll("*"))) {
    for (const attribute of Array.from(element.attributes)) {
      if (/^on/i.test(attribute.name)) element.removeAttribute(attribute.name);
    }
  }

  // bexio's hidden support form carries the user's name and a live access token (JWT)
  const hiddenFormValues: Record<string, string> = { firstname: "Jane", lastname: "Doe", token: "TEST_ACCESS_TOKEN" };
  for (const [name, value] of Object.entries(hiddenFormValues)) {
    for (const input of Array.from(document.querySelectorAll(`input[name='${name}']`))) {
      input.setAttribute("value", value);
    }
  }
}

/** String-level scrub of the serialised markup: literal replacements first, then shapes. */
export function scrubText(html: string, replacements: Replacement[]): string {
  for (const [from, to] of replacements) html = html.split(from).join(to);
  let itemId = 90000;
  return (
    html
      .replace(/eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]+/g, "TEST_ACCESS_TOKEN")
      .replace(EMAIL, "person@example.com")
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "00000000-0000-0000-0000-000000000000")
      .replace(/\b[0-9a-f]{32}\b/g, "TEST_CSRF_TOKEN")
      // inside URL-encoded markup the token is glued to "%27", so \b does not apply
      .replace(/(%27|%22)[0-9a-f]{32}(?=%27|%22)/g, "$1TEST_CSRF_TOKEN")
      .replace(/csrf_token\/[\w-]{20,}/g, "csrf_token/TEST_CSRF_TOKEN")
      .replace(/chrome-extension:\/\/[a-p]{32}/g, "chrome-extension://EXTENSION_ID_PLACEHOLDER")
      .replace(/id="item\d+"/g, () => `id="item${++itemId}"`)
      .replace(/\/(id|projectId|packageId|fieldId|pr_project_id|contact_id)\/\d+/g, "/$1/99999")
      .replace(/(%2F(?:id|projectId|packageId)%2F)\d+/g, "$199999")
      .replace(/IN-\d{5}/g, "IN-00001")
  );
}

const LEAK_PATTERNS: [label: string, pattern: RegExp][] = [
  ["jwt", /eyJ[\w-]{10,}\.[\w-]{10,}/g],
  ["email", EMAIL],
  ["uuid", /(?!00000000-)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g],
  // exactly 32 hex characters: template ids are 64; the url-decoded view catches %27<token>%27
  ["hex-token", /(?<![0-9a-f])[0-9a-f]{32}(?![0-9a-f])/g],
  ["csrf-path-token", /csrf_token\/(?!TEST_CSRF_TOKEN)/g],
  ["extension-id", /chrome-extension:\/\/(?!EXTENSION_ID_PLACEHOLDER)/g],
];

/**
 * Looks for credentials and personal data in the markup as written, URL-decoded, and in its
 * base64 path parameters — bexio embeds names in encoded onclick handlers and lookup URLs.
 *
 * `sensitive` tokens of 5+ characters match as case-insensitive substrings, shorter ones as
 * case-sensitive whole words (so "Ben" does not hit "Benutzer"). `SoulcodeExtension…` element
 * ids belong to this extension's own injected UI and are not reported.
 */
export function findLeaks(html: string, sensitive: string[]): Leak[] {
  const urlDecoded = html.replace(/%[0-9A-Fa-f]{2}/g, (sequence) => {
    try {
      return decodeURIComponent(sequence);
    } catch {
      return sequence;
    }
  });
  const base64Params = Array.from(html.matchAll(/\/(?:addOptions|params)\/([A-Za-z0-9+/=%]{8,})/g))
    .map((match) => Buffer.from(decodeURIComponent(match[1]), "base64").toString("utf8"))
    .join("\n");

  const leaks: Leak[] = [];
  const views: [Leak["variant"], string][] = [
    ["raw", html],
    ["url-decoded", urlDecoded],
    ["base64-param", base64Params],
  ];
  for (const [variant, text] of views) {
    const report = (label: string, index: number) =>
      leaks.push({ label, variant, context: text.slice(Math.max(0, index - 60), index + 60).replace(/\s+/g, " ") });

    for (const token of sensitive) {
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern =
        token.length >= 5
          ? new RegExp(`${escaped}(?!Extension)`, "gi")
          : new RegExp(`(?<![\\w-])${escaped}(?![\\w])`, "g");
      for (const match of text.matchAll(pattern)) report(token, match.index);
    }
    for (const [label, pattern] of LEAK_PATTERNS) {
      for (const match of text.matchAll(pattern)) report(label, match.index);
    }
  }
  return leaks;
}
