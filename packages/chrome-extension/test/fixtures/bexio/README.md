# bexio DOM fixtures

Captured HTML from real bexio pages, used by the jsdom-based tests for the
tooltip-replacement (topic 4) and form-manipulation (topic 5) code, and served to
the Playwright specs in `e2e/`.

- **Cleaned fixtures** live directly in this folder (`*.html`), are committed, and
  must be anonymised. **The repository is public.**
- **Raw captures** go in `_raw/` (git-ignored) **of the main checkout**, together with
  `anonymise.local.json`, the list of real names the anonymiser replaces and then
  searches for. `npm run fixtures:build` reads them from there even when it runs in a
  worktree, and writes the fixtures into the checkout it runs in.
- Each cleaned fixture has a sibling `<name>.md` recording: source URL, capture
  date, what was trimmed, and what was anonymised.
- `scripts/bexio-fixtures/committed-fixtures.test.ts` fails when any committed
  fixture contains an access token, a CSRF token, an e-mail address, a UUID or an
  extension id. It cannot check names — those only exist in `anonymise.local.json`.

| Fixture                               | Page                                                                                          | Captured with                |
| ------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------- |
| `monitoring-list.html`                | `monitoring/list`                                                                             | capture script (below)       |
| `pr_project-listMonitoring.html`      | a project → "Zeiten" tab                                                                      | capture script               |
| `pr_project-showPackage.html`         | a work package, with its lower "Zeiten" tab opened                                            | capture script               |
| `kb_invoice-show.html`                | a draft invoice → Positionen → "Weitere Positionen" → "Zeit/Leistung" (modal open, populated) | capture script, `keepDialog` |
| `monitoring-edit.html`                | `monitoring/edit` (new time entry)                                                            | `copy()` snippet (below)     |
| `monitoring-edit-filled.html`         | `monitoring/edit/id/<id>` (existing entry)                                                    | `copy()` snippet             |
| `monitoring-edit.tinymce-iframe.html` | the description field's TinyMCE iframe on `monitoring/edit`                                   | `copy()` snippet             |

## Capturing the tooltip pages (full body)

Why a script instead of `copy(document.body.outerHTML)`:

- The extension is active in the tab and changes exactly the markup under test
  (converted popovers, the injected toggle). The script undoes that on a clone.
- bexio sends `X-Frame-Options: DENY`, so the pages cannot be loaded into a clean iframe.
- The full body carries account data the tests never need (the Angular header and
  sidebar, chat widgets) and bexio's hidden support form, which holds **a live access
  token**. The script empties or drops those parts; the anonymiser handles the rest.

1. Log into bexio in Chrome and open DevTools → Console on any `office.bexio.com` tab.
2. For each page in the table: open it, wait until it is fully rendered (open the tab
   or modal the table names), paste the snippet once per page, then run
   `captureBexioFixture("<fixture name>")` — for the invoice
   `captureBexioFixture("kb_invoice-show", { keepDialog: true })`. The capture is kept
   in the tab's `sessionStorage`, so all pages must be captured in the same tab.
3. Run `downloadBexioCaptures()` on the last page. It downloads
   `bexio-raw-captures-<date>.json` and clears the stored captures.
4. Move the file into the main checkout's `_raw/`. Keep `_raw/anonymise.local.json` up to date with any new
   names of people, clients and projects that appear in the captures.
5. `npm run fixtures:build` writes the `*.html` and `*.md` files. A fixture whose scrubbed
   markup still contains something `findLeaks` recognises is **not written**; the script
   prints what it found. Check any file with
   `node scripts/bexio-fixtures/build.ts --check <file>`.
6. Read through the remaining text of the new fixtures before committing: `findLeaks`
   only knows the names listed in `anonymise.local.json`.

```js
function captureBexioFixture(name, { keepDialog = false } = {}) {
  const clone = document.body.cloneNode(true);
  const remove = (selector) => clone.querySelectorAll(selector).forEach((element) => element.remove());
  // 1. undo the extension
  remove(".new-popover-text");
  clone
    .querySelectorAll("#PopoverTextSwitcher")
    .forEach((toggle) => (toggle.closest(".bx-flex-block, li.nav-item") ?? toggle).remove());
  clone.querySelectorAll("i[rel='popover']").forEach((icon) => {
    icon.removeAttribute("style");
    const cell = icon.parentElement;
    const style = (cell?.getAttribute("style") ?? "").replace(/background-color:[^;]*;?/g, "").trim();
    if (cell?.hasAttribute("style") && style === "") cell.removeAttribute("style");
  });
  // 2. drop what the tests do not need and what carries account data
  remove("script, noscript, iframe, style, link");
  [
    "bexio-application-header-root",
    "bexio-application-navigation-root",
    "bexio-application-footer-root",
    "application-wrapper-root",
    ".cdk-overlay-container",
  ].forEach((selector) => clone.querySelectorAll(selector).forEach((element) => (element.innerHTML = "")));
  remove(
    "#GuuruMain, #chmln-dom, [class*='guuru'], #jqDialogConfirm, #jqSmallDialogConfirm, #chooserDialog, #fileSelectDialog, #searchChDialog, #loading-spinner",
  );
  if (!keepDialog) remove("#jqDialog");
  // 3. trim
  clone.querySelectorAll("tbody").forEach((tbody) =>
    [...tbody.children]
      .filter((row) => row.tagName === "TR" && !row.classList.contains("footer_row"))
      .slice(12)
      .forEach((row) => row.remove()),
  );
  clone.querySelectorAll("select").forEach((select) => {
    const options = [...select.querySelectorAll("option")];
    if (options.length > 5)
      options
        .slice(3)
        .filter((option) => !option.hasAttribute("selected"))
        .forEach((option) => option.remove());
  });
  clone.querySelectorAll("optgroup").forEach((group) => group.querySelector("option") || group.remove());
  const html = clone.outerHTML;
  sessionStorage.setItem(
    `__fx_${name}`,
    JSON.stringify({ name, url: location.pathname, captured: new Date().toISOString(), html }),
  );
  return {
    name,
    kilobytes: Math.round(html.length / 1024),
    popovers: clone.querySelectorAll("i[rel='popover']").length,
  };
}

function downloadBexioCaptures() {
  const keys = Object.keys(sessionStorage).filter((key) => key.startsWith("__fx_"));
  const bundle = Object.fromEntries(keys.map((key) => [key.slice(5), JSON.parse(sessionStorage.getItem(key))]));
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(bundle)], { type: "application/json" }));
  link.download = `bexio-raw-captures-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  keys.forEach((key) => sessionStorage.removeItem(key));
  return Object.keys(bundle);
}
```

## Capturing the form fixtures (`monitoring/edit`)

These are captures of `#MonitoringForm` only, still cleaned by the older one-off
pipeline (inline scripts removed, names replaced). On 2026-09-17 the live form was
compared with them element by element (tag, id, classes, `name`, `type`, `role`, `for`
of all 303 elements, select2 counters normalised) and was identical, so they were kept.
If the form changes, recapture with:

| Fixture                               | Console snippet                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `monitoring-edit.html`                | `copy(document.getElementById('MonitoringForm').outerHTML)`                                             |
| `monitoring-edit-filled.html`         | `copy(document.getElementById('MonitoringForm').outerHTML)`                                             |
| `monitoring-edit.tinymce-iframe.html` | `copy(document.querySelector('#monitoring_text_ifr').contentWindow.document.documentElement.outerHTML)` |

Paste into `_raw/<name>.html`, then extend `scripts/bexio-fixtures/build.ts` with a job
for them before relying on the leak check. Capture the form with the extension active and
keep its injected Templates block: `test/utils/misc-utils.test.ts` reads
`#SoulcodeExtensionLoader` straight from `monitoring-edit.html` without rendering it first.
