# Template Area UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the injected Templates panel on bexio `monitoring/edit*`: chips with a field-preview tooltip, a keyword-aware filter, an inline add form, an update action, and a manage-mode delete with undo — removing every native `alert`/`prompt`/`confirm` dialog.

**Architecture:** The content-script panel (`renderHtml.ts`) becomes an orchestrator that renders chip wrappers and delegates behaviour to small sibling modules (tooltip, filter, inline add, manage mode, toast). Form reading is extracted out of `readFormData.ts` into reusable utils so add and update share it. Storage stays `chrome.storage.local` via the shared package; one defensive `restoreTemplate` helper is added for undo.

**Tech Stack:** Plain TypeScript (strict, no framework) in `packages/chrome-extension`; Vitest + jsdom + anonymised bexio fixtures for unit tests; Playwright for e2e; plain CSS in `public/bexioTimetrackingTemplates.css`.

**Spec:** `docs/superpowers/specs/2026-09-09-template-area-ux-redesign-design.md`

## Global Constraints

- **Worktree setup first:** run `npm run npm:ciProject` in the worktree before anything else (fresh checkouts silently borrow the main checkout's `node_modules` otherwise).
- Plain TypeScript, strict mode, no framework in `packages/chrome-extension`. All three packages must pass `npm run typecheck`.
- **Security rule (pinned by tests):** every template-derived string (names, ids, keywords, field values) is rendered via `textContent` / property setters / `setAttribute` — never interpolated into an HTML string. See the comment block in `renderHtml.ts`.
- **Hash stability:** a new template's `id` is the SHA-256 of `JSON.stringify` over the entry object *without* `id`, with the exact key order `work, status, contact, project, package, billable, contactPerson, templateName`. Do not reorder keys — identical form values must keep producing identical ids across versions.
- **Module-load quirk:** `src/selectors/*` run `document.querySelector` at import time. In tests, load the fixture **before** importing the module under test and call `vi.resetModules()` in `beforeEach` (see `docs/architecture/form-layer.md`).
- Unit tests: `npx vitest run --project chrome-extension <filename-substring>` from the repo root (project `shared` for the shared package). Full suites: `npm run test:fast`, `npm test`.
- In unit tests, seed storage explicitly in `beforeEach` (`await chrome.storage.local.set({ entries: [...] })`) — don't rely on implicit fake resets.
- Prettier: 2-space indent, `printWidth` 120; CI enforces `prettier --check`. Format touched files before committing.
- Conventional commits (release-please parses them); no AI attribution lines.
- All UI copy in English. Tooltip field labels are deliberately German (they mirror the bexio form): `Tätigkeit`, `Projekt`, `Arbeitspaket`, `Kontakt`, `Status`, `Abrechenbar` (values `Ja`/`Nein`).
- Do not edit `manifest.json`'s `version` or commit version bumps from dev builds.
- The full-screen loader and the side panel are **out of scope** — do not touch them.

## File Structure

**Created:**

| File | Responsibility |
| --- | --- |
| `packages/chrome-extension/src/utils/readCurrentFormValues.ts` | Read the bexio form into a `TemplateFormValues` object; suggest a template name |
| `packages/chrome-extension/src/utils/createTemplateFromForm.ts` | Build entry + hash id + duplicate check + save (no dialogs) |
| `packages/chrome-extension/src/utils/updateActiveTemplate.ts` | Overwrite a stored template's fields from the form, keeping `id`/`templateName`/`keywords` |
| `packages/chrome-extension/src/apps/bexioTimetrackingTemplates/tooltip.ts` | Field-preview tooltip (singleton) |
| `packages/chrome-extension/src/apps/bexioTimetrackingTemplates/filter.ts` | Filter behaviour (keywords, Enter, Esc, empty state) |
| `packages/chrome-extension/src/apps/bexioTimetrackingTemplates/panelToast.ts` | In-panel toast (undo + errors) |
| `packages/chrome-extension/src/apps/bexioTimetrackingTemplates/inlineAddForm.ts` | Inline add form (replaces `prompt()`) |
| `packages/chrome-extension/src/apps/bexioTimetrackingTemplates/manageMode.ts` | Manage mode: toggle, delete, undo |

**Modified:** `renderHtml.ts` (orchestrator + chips), `public/bexioTimetrackingTemplates.css`, `packages/shared/chromeStorageTemplateEntries.ts` (+`restoreTemplate`), `e2e/extension-behaviour.spec.ts`, architecture docs.

**Deleted:** `src/utils/readFormData.ts` (Task 8), `src/utils/confirmTemplateDeletion.ts` (Task 10) and their test files. `packages/shared/confirmTemplateDeletion.ts` stays — it belongs to the side panel scope.

**DOM contract (used by several tasks and e2e):**

```html
<div id="SoulcodeExtensionTemplates" class="row-fluid">          <!-- gets .manage-mode -->
  <h2 title="Soulcode extension v… — last update …">Templates</h2>
  <input id="templateFilter"> <button id="templateFilterReset">
  <button id="AddNewTemplate"> <button id="ManageTemplates">      <!-- Manage replaces Delete in Task 10 -->
  <div id="SoulcodeExtensionAddForm" hidden>
    <input id="templateNameInput"> <button id="templateNameSave"> <button id="templateNameCancel">
    <span id="templateNameError" hidden>
  </div>
  <div id="bexioTimetrackingTemplates-entries">                   <!-- CSS grid, 2 columns -->
    <div class="template-chip" data-filter="<name+keywords lowercased>">
      <button class="entry template-button" id="<entry.id>" aria-pressed="false">Name</button>
      <button class="template-chip-update" hidden>↻</button>
      <button class="template-chip-delete" aria-label="Delete template <name>">×</button>
    </div>
    <div id="templateFilterEmpty" hidden></div>
  </div>
  <div id="SoulcodeExtensionToast">…</div>                        <!-- transient -->
  <div id="SoulcodeTemplateTooltip" hidden>…</div>                <!-- transient -->
</div>
```

---

### Task 1: Extract `readCurrentFormValues` + `suggestTemplateName`

Pure refactor — `readFormData` behaviour is unchanged (its existing tests keep passing).

**Files:**
- Create: `packages/chrome-extension/src/utils/readCurrentFormValues.ts`
- Modify: `packages/chrome-extension/src/utils/readFormData.ts`
- Test: `packages/chrome-extension/test/utils/readCurrentFormValues.test.ts`

**Interfaces:**
- Consumes: `readTextFromSelect2(field)`, selectors (`workField`, `statusField`, `contactPersonField`, `projectField`, `packageField`, `contactField`, `billableCheckbox`), `trimAll`.
- Produces:
  - `type TemplateFormValues = { work: string; status: string; contact: string; contactPerson: string; project: string; package: string; billable: boolean }`
  - `readCurrentFormValues(): Promise<TemplateFormValues>` (named export)
  - `suggestTemplateName(values: TemplateFormValues): string` (named export)

- [ ] **Step 1: Write the failing test**

`packages/chrome-extension/test/utils/readCurrentFormValues.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";
import type { TemplateFormValues } from "@bexio-chrome-extension/chrome-extension/src/utils/readCurrentFormValues";

// Selectors capture their elements at import time — fixture first, then import.
const importModule = async () =>
  await import("@bexio-chrome-extension/chrome-extension/src/utils/readCurrentFormValues");

describe("readCurrentFormValues", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
  });

  it("reads the filled fixture's form values", async () => {
    loadFixture("monitoring-edit-filled");
    const { readCurrentFormValues } = await importModule();
    const values = await readCurrentFormValues();
    expect(values.work).toBe("Work");
    expect(values.status).toBe("Erledigt");
    expect(values.project).toBe("Acme - Back Office");
    expect(values.package).toBe("Misc");
    expect(values.contactPerson).toBe("");
    expect(typeof values.contact).toBe("string");
    expect(typeof values.billable).toBe("boolean");
  });

  it("keeps only the first two words of the contact", async () => {
    loadFixture("monitoring-edit-filled");
    (document.querySelector("#autocomplete_monitoring_contact_id") as HTMLInputElement).value = "Acme AG Zurich";
    const { readCurrentFormValues } = await importModule();
    expect((await readCurrentFormValues()).contact).toBe("Acme AG");
  });
});

describe("suggestTemplateName", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
  });

  const values = (over: Partial<TemplateFormValues> = {}): TemplateFormValues => ({
    work: "",
    status: "",
    contact: "",
    contactPerson: "",
    project: "",
    package: "",
    billable: false,
    ...over,
  });

  it("prefers the package name, whitespace stripped", async () => {
    const { suggestTemplateName } = await importModule();
    expect(suggestTemplateName(values({ package: "Some Package", project: "P" }))).toBe("SomePackage");
  });

  it("falls back project → contact → work → 'New Template'", async () => {
    const { suggestTemplateName } = await importModule();
    expect(suggestTemplateName(values({ project: "Acme - Back Office" }))).toBe("Acme-BackOffice");
    expect(suggestTemplateName(values({ contact: "Acme AG" }))).toBe("AcmeAG");
    expect(suggestTemplateName(values({ work: "Project Management" }))).toBe("ProjectManagement");
    expect(suggestTemplateName(values())).toBe("New Template");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project chrome-extension readCurrentFormValues`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`packages/chrome-extension/src/utils/readCurrentFormValues.ts`:

```ts
import { billableCheckbox } from "../selectors/billableCheckbox";
import { contactField } from "../selectors/contactField";
import { workField, statusField, contactPersonField, projectField, packageField } from "../selectors/selectors";
import readTextFromSelect2 from "./readTextFromSelect2";
import trimAll from "./trimAll";

export type TemplateFormValues = {
  work: string;
  status: string;
  contact: string;
  contactPerson: string;
  project: string;
  package: string;
  billable: boolean;
};

/**
 * Reads the current values of the bexio monitoring/edit form.
 *
 * Same module-load quirk as `src/selectors/*`: the field elements are captured
 * at import time, so tests must load the fixture before importing this module.
 */
export async function readCurrentFormValues(): Promise<TemplateFormValues> {
  const work = await readTextFromSelect2(workField);
  const status = await readTextFromSelect2(statusField);

  // The contact input shows a display string that is not directly searchable —
  // keep only the first two words (same rule readFormData always applied).
  const contact = contactField.value.split(" ").slice(0, 2).join(" ");

  const contactPerson = await readTextFromSelect2(contactPersonField);
  const project = await readTextFromSelect2(projectField);
  const packageValue = await readTextFromSelect2(packageField);
  const billable = billableCheckbox.checked;

  return { work, status, contact, contactPerson, project, package: packageValue, billable };
}

/** Suggested display name: package → project → contact → work → "New Template", whitespace stripped. */
export function suggestTemplateName(values: TemplateFormValues): string {
  return (
    trimAll(values.package) ||
    trimAll(values.project) ||
    trimAll(values.contact) ||
    trimAll(values.work) ||
    "New Template"
  );
}
```

Then refactor `readFormData.ts`: replace its reading block (the lines from `const work = await readTextFromSelect2(workField);` down to the `templateName` fallback chain) with:

```ts
const values = await readCurrentFormValues();
const templateName = suggestTemplateName(values);
```

and build `formEntry` from `values` **in the exact existing key order** (see Global Constraints):

```ts
formEntry = {
  work: values.work,
  status: values.status,
  contact: values.contact,
  project: values.project,
  package: values.package,
  billable: values.billable,
  contactPerson: values.contactPerson,
  templateName,
} as TemplateEntry;
```

Remove the now-unused imports (`readTextFromSelect2`, `trimAll`, selectors, `contactField`, `billableCheckbox`) from `readFormData.ts` and add `import { readCurrentFormValues, suggestTemplateName } from "./readCurrentFormValues";`.

- [ ] **Step 4: Run tests to verify they pass (old + new)**

Run: `npx vitest run --project chrome-extension readCurrentFormValues readFormData`
Expected: PASS — including the untouched `readFormData.test.ts` (suggestion chain + hash tests prove the refactor changed nothing).

- [ ] **Step 5: Commit**

```bash
git add packages/chrome-extension/src/utils/readCurrentFormValues.ts packages/chrome-extension/src/utils/readFormData.ts packages/chrome-extension/test/utils/readCurrentFormValues.test.ts
git commit -m "refactor: extract form reading into readCurrentFormValues"
```

---

### Task 2: `createTemplateFromForm` (dialog-free save path)

**Files:**
- Create: `packages/chrome-extension/src/utils/createTemplateFromForm.ts`
- Modify: `packages/chrome-extension/src/utils/readFormData.ts` (use the new util inside its loop)
- Test: `packages/chrome-extension/test/utils/createTemplateFromForm.test.ts`

**Interfaces:**
- Consumes: `readCurrentFormValues()` (Task 1), `generateHash(s: string): Promise<string>`, `chromeStorageTemplateEntries.loadTemplates/saveTemplates`.
- Produces:
  - `type CreateTemplateResult = { ok: true; entry: TemplateEntry } | { ok: false; reason: "duplicate" }`
  - `createTemplateFromForm(templateName: string): Promise<CreateTemplateResult>` (named export)

- [ ] **Step 1: Write the failing test**

`packages/chrome-extension/test/utils/createTemplateFromForm.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";

const importModule = async () =>
  await import("@bexio-chrome-extension/chrome-extension/src/utils/createTemplateFromForm");

describe("createTemplateFromForm", () => {
  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = "";
    await chrome.storage.local.set({ entries: [] });
  });

  it("saves a new entry with the form values and a stable 64-hex-char hash id", async () => {
    loadFixture("monitoring-edit-filled");
    const { createTemplateFromForm } = await importModule();
    const { default: generateHash } = await import("@bexio-chrome-extension/chrome-extension/src/utils/generateHash");

    const result = await createTemplateFromForm("My Template");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.entry.templateName).toBe("My Template");
    expect(result.entry.work).toBe("Work");
    expect(result.entry.status).toBe("Erledigt");
    expect(result.entry.project).toBe("Acme - Back Office");
    expect(result.entry.package).toBe("Misc");
    expect(/^[0-9a-f]{64}$/.test(result.entry.id)).toBe(true);

    // Hash stability: id === SHA-256 of the entry without id, in insertion order
    // (work, status, contact, project, package, billable, contactPerson, templateName).
    const { id, ...withoutId } = result.entry;
    expect(id).toBe(await generateHash(JSON.stringify(withoutId)));

    const stored = await chrome.storage.local.get("entries");
    expect((stored.entries as unknown[]).length).toBe(1);
  });

  it("returns duplicate for a second save with identical values and name", async () => {
    loadFixture("monitoring-edit-filled");
    const { createTemplateFromForm } = await importModule();

    expect((await createTemplateFromForm("Twice")).ok).toBe(true);
    const second = await createTemplateFromForm("Twice");
    expect(second).toEqual({ ok: false, reason: "duplicate" });

    const stored = await chrome.storage.local.get("entries");
    expect((stored.entries as unknown[]).length).toBe(1);
  });

  it("a different name produces a different id and saves alongside", async () => {
    loadFixture("monitoring-edit-filled");
    const { createTemplateFromForm } = await importModule();

    const first = await createTemplateFromForm("Name A");
    const second = await createTemplateFromForm("Name B");
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.entry.id).not.toBe(second.entry.id);

    const stored = await chrome.storage.local.get("entries");
    expect((stored.entries as unknown[]).length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project chrome-extension createTemplateFromForm`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`packages/chrome-extension/src/utils/createTemplateFromForm.ts`:

```ts
import { chromeStorageTemplateEntries } from "@bexio-chrome-extension/shared";
import { TemplateEntry } from "@bexio-chrome-extension/shared/types";
import generateHash from "./generateHash";
import { readCurrentFormValues } from "./readCurrentFormValues";

export type CreateTemplateResult = { ok: true; entry: TemplateEntry } | { ok: false; reason: "duplicate" };

/**
 * Reads the form, builds a template entry and saves it.
 *
 * The `id` is the SHA-256 of the entry's JSON **without** `id`. The key order of
 * the object literal below is load-bearing: it must match what readFormData
 * produced historically, so identical form values keep hashing to the same id
 * (that is how duplicates are detected across versions).
 */
export async function createTemplateFromForm(templateName: string): Promise<CreateTemplateResult> {
  const values = await readCurrentFormValues();

  const entry = {
    work: values.work,
    status: values.status,
    contact: values.contact,
    project: values.project,
    package: values.package,
    billable: values.billable,
    contactPerson: values.contactPerson,
    templateName,
  } as TemplateEntry;

  entry.id = await generateHash(JSON.stringify(entry));

  const allEntries = await chromeStorageTemplateEntries.loadTemplates();
  if (allEntries.some((existing) => existing.id === entry.id)) {
    return { ok: false, reason: "duplicate" };
  }
  allEntries.push(entry);
  await chromeStorageTemplateEntries.saveTemplates(allEntries);
  return { ok: true, entry };
}
```

Then refactor `readFormData.ts` to use it (keeps the prompt-based UX alive until Task 8): the `do … while` loop becomes

```ts
let saved = false;
do {
  const userInput = prompt("Name of the template:", templateName);
  if (userInput === null) {
    alert("Please enter a name for the template");
    return;
  }
  const result = await createTemplateFromForm(userInput);
  if (result.ok) {
    saved = true;
  } else if (!confirm(`This entry already exists, or there was a hash conflict, Try again?`)) {
    return;
  }
} while (!saved);
initializeExtension();
```

Remove the now-dead `generateHash` / `formEntry` / `allEntries` code and unused imports from `readFormData.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --project chrome-extension createTemplateFromForm readFormData`
Expected: PASS. Note: `readFormData.test.ts`'s "saves a new template entry" and suggestion tests still pass; if an assertion depends on the removed internals, adjust only that assertion, not the behaviour.

- [ ] **Step 5: Commit**

```bash
git add packages/chrome-extension/src/utils/createTemplateFromForm.ts packages/chrome-extension/src/utils/readFormData.ts packages/chrome-extension/test/utils/createTemplateFromForm.test.ts
git commit -m "refactor: extract dialog-free template creation into createTemplateFromForm"
```

---

### Task 3: `restoreTemplate` in the shared storage helpers

**Files:**
- Modify: `packages/shared/chromeStorageTemplateEntries.ts`
- Test: `packages/shared/test/chromeStorageTemplateEntries.test.ts` (extend)

**Interfaces:**
- Produces: `restoreTemplate(entry: TemplateEntry): Promise<boolean>` — `true` = re-inserted, `false` = an entry with that id already exists (no-op).

- [ ] **Step 1: Write the failing tests** (append to the existing describe file, reusing its entry factory if one exists; otherwise inline a minimal `TemplateEntry` literal like the `sample()` factory in `packages/shared/test/confirmTemplateDeletion.test.ts`)

```ts
describe("restoreTemplate", () => {
  it("re-inserts a deleted entry and returns true", async () => {
    await chrome.storage.local.set({ entries: [] });
    const entry = sample({ id: "gone" });
    const { restoreTemplate, loadTemplates } = await import("../chromeStorageTemplateEntries");

    expect(await restoreTemplate(entry)).toBe(true);
    expect((await loadTemplates()).map((e) => e.id)).toEqual(["gone"]);
  });

  it("is a no-op and returns false when the id already exists", async () => {
    const entry = sample({ id: "still-there" });
    await chrome.storage.local.set({ entries: [entry] });
    const { restoreTemplate, loadTemplates } = await import("../chromeStorageTemplateEntries");

    expect(await restoreTemplate(sample({ id: "still-there", templateName: "changed" }))).toBe(false);
    const stored = await loadTemplates();
    expect(stored).toHaveLength(1);
    expect(stored[0].templateName).toBe("T");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project shared chromeStorageTemplateEntries`
Expected: FAIL — `restoreTemplate` is not exported.

- [ ] **Step 3: Write the implementation** (append to `chromeStorageTemplateEntries.ts`)

```ts
/**
 * Re-inserts a previously deleted entry (undo). Defensive against concurrent
 * writers (the side panel writes the same `entries` key): if an entry with the
 * same id is already present, nothing is written and `false` is returned.
 */
export async function restoreTemplate(entry: TemplateEntry): Promise<boolean> {
  const entries = await loadTemplates();
  if (entries.some((existing) => existing.id === entry.id)) {
    return false;
  }
  entries.push(entry);
  await saveTemplates(entries);
  return true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --project shared chromeStorageTemplateEntries`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/chromeStorageTemplateEntries.ts packages/shared/test/chromeStorageTemplateEntries.test.ts
git commit -m "feat: add restoreTemplate storage helper for delete undo"
```

---

### Task 4: Chip rendering, grid layout, header cleanup

Rewrites the panel structure. The old Add (prompt) and Delete (delete mode) flows stay functional in this task — they are replaced in Tasks 8 and 10.

**Files:**
- Modify: `packages/chrome-extension/src/apps/bexioTimetrackingTemplates/renderHtml.ts` (full rewrite below)
- Modify: `packages/chrome-extension/public/bexioTimetrackingTemplates.css` (full rewrite below)
- Test: `packages/chrome-extension/test/apps/bexioTimetrackingTemplates.test.ts` (update assertions)

**Interfaces:**
- Consumes: `getTemplateName(entry)`, `fillForm(id)`, `confirmActiveTemplateDeletion(id?)`, `readFormData()`, `VERSION`, `DATE`.
- Produces (relied on by Tasks 5–10 and e2e):
  - The DOM contract from "File Structure" above (chip wrapper `.template-chip` with `data-filter`; apply button `button.entry.template-button#<id>` with `aria-pressed`; `.template-chip-update` (hidden); `.template-chip-delete`; `#templateFilterEmpty`).
  - `setActiveChip(panel: HTMLElement, button: HTMLButtonElement): void` (module-internal helper, exported for reuse is NOT needed — later tasks call it via the existing click path).

- [ ] **Step 1: Update the failing tests first**

In `test/apps/bexioTimetrackingTemplates.test.ts`, change the existing assertions to the new structure and add the new ones:

```ts
it("renders one chip per template: apply button with name/id inside a .template-chip wrapper", async () => {
  const renderHtml = await importRenderHtml();
  await renderHtml([template(), template({ id: "tmpl2", templateName: "Globex GmbH" })]);

  const chips = entriesContainer().querySelectorAll("div.template-chip");
  expect(chips).toHaveLength(2);
  const buttons = entriesContainer().querySelectorAll("button.entry");
  expect(Array.from(buttons).map((b) => b.id)).toEqual(["tmpl1", "tmpl2"]);
  expect(Array.from(buttons).map((b) => b.textContent)).toEqual(["Project Falcon", "Globex GmbH"]);
  expect(buttons[0].className).toBe("entry template-button");
  expect(buttons[0].getAttribute("aria-pressed")).toBe("false");
  // each chip carries a hidden update button and a delete cross
  expect(chips[0].querySelector<HTMLButtonElement>(".template-chip-update")!.hidden).toBe(true);
  expect(chips[0].querySelector(".template-chip-delete")).not.toBeNull();
  // filter metadata: lowercased name + keywords
  expect((chips[0] as HTMLElement).dataset.filter).toBe("project falcon ");
});

it("puts the version into the heading tooltip, not the heading text", async () => {
  const renderHtml = await importRenderHtml();
  await renderHtml([]);
  const heading = document.querySelector("#SoulcodeExtensionTemplates h2")!;
  expect(heading.textContent!.trim()).toBe("Templates");
  expect(heading.getAttribute("title")).toMatch(/v\d+\.\d+\.\d+/);
});

it("marks the clicked chip active: class, aria-pressed and visible update button", async () => {
  const renderHtml = await importRenderHtml();
  const { default: fillForm } = await import("@bexio-chrome-extension/chrome-extension/src/utils/fillForm");
  await renderHtml([template(), template({ id: "tmpl2", templateName: "Globex GmbH" })]);

  const first = document.getElementById("tmpl1") as HTMLButtonElement;
  const second = document.getElementById("tmpl2") as HTMLButtonElement;
  second.click();
  first.click();

  expect(vi.mocked(fillForm)).toHaveBeenLastCalledWith("tmpl1");
  expect(first.classList.contains("template-button--active")).toBe(true);
  expect(first.getAttribute("aria-pressed")).toBe("true");
  expect(first.parentElement!.querySelector<HTMLButtonElement>(".template-chip-update")!.hidden).toBe(false);
  // the previously active chip is fully reset
  expect(second.classList.contains("template-button--active")).toBe(false);
  expect(second.getAttribute("aria-pressed")).toBe("false");
  expect(second.parentElement!.querySelector<HTMLButtonElement>(".template-chip-update")!.hidden).toBe(true);
});
```

Keep the two XSS regression tests but update the attribute-count assertion in the id-breakout test: the button now carries exactly `type, id, class, aria-pressed`:

```ts
expect(button.attributes.length).toBe(4); // type, id, class, aria-pressed
```

Delete the old assertions that pinned `btn btn-info`, the inline `style` attribute, and `#DeleteTemplate`'s `btn-danger` on apply-click (delete mode no longer arms on apply — but the Delete button itself still exists until Task 10; keep a minimal `expect(document.getElementById("DeleteTemplate")).not.toBeNull()` where useful).

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run --project chrome-extension bexioTimetrackingTemplates`
Expected: new/changed tests FAIL against the old markup.

- [ ] **Step 3: Rewrite `renderHtml.ts`**

```ts
import confirmActiveTemplateDeletion from "../../utils/confirmTemplateDeletion";
import fillForm from "../../utils/fillForm";
import getTemplateName from "@bexio-chrome-extension/shared/getTemplateName";
import { DATE, VERSION } from "../../utils/packageInfo";
import readFormData from "../../utils/readFormData";
import { toggleDisplayLoader } from "../../utils/loader";
import { TemplateEntry } from "@bexio-chrome-extension/shared/types";

/**
 * Builds one template chip as DOM nodes.
 *
 * The id, the display name and the keywords are **never** interpolated into an
 * HTML string: they come from untrusted storage (bexio field values, the add
 * form, the side panel's template modal; for pre-v0.5.x entries the free-form
 * name *is* the id). `textContent`, the `id` property setter, `setAttribute`
 * and `dataset` assignments cannot be escaped out of — the same "sanitise
 * before HTML" rule the tooltip feature follows (see `convertPopover.ts`).
 */
function createTemplateChip(entry: TemplateEntry): HTMLDivElement {
  const name = getTemplateName(entry);

  const chip = document.createElement("div");
  chip.className = "template-chip";
  chip.dataset.filter = `${name} ${entry.keywords ?? ""}`.toLowerCase();

  const button = document.createElement("button");
  button.type = "button";
  button.id = entry.id;
  button.className = "entry template-button";
  button.setAttribute("aria-pressed", "false");
  button.textContent = name;
  chip.appendChild(button);

  const updateButton = document.createElement("button");
  updateButton.type = "button";
  updateButton.className = "template-chip-update";
  updateButton.title = "Overwrite this template with the current form values";
  updateButton.textContent = "↻";
  updateButton.hidden = true; // shown for the active chip only (setActiveChip)
  chip.appendChild(updateButton);

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "template-chip-delete";
  deleteButton.setAttribute("aria-label", `Delete template ${name}`);
  deleteButton.textContent = "×";
  chip.appendChild(deleteButton);

  return chip;
}

function setActiveChip(panel: HTMLElement, button: HTMLButtonElement): void {
  panel.querySelectorAll<HTMLButtonElement>("button.template-button").forEach((other) => {
    other.classList.remove("template-button--active");
    other.setAttribute("aria-pressed", "false");
  });
  panel.querySelectorAll<HTMLButtonElement>(".template-chip-update").forEach((update) => (update.hidden = true));
  button.classList.add("template-button--active");
  button.setAttribute("aria-pressed", "true");
  const update = button.parentElement?.querySelector<HTMLButtonElement>(".template-chip-update");
  if (update) update.hidden = false;
}

// Renders the whole template panel into the monitoring/edit page.
async function renderHtml(templateEntries: TemplateEntry[] | undefined) {
  // Remove the panel if it already exists (re-render after storage changes)
  document.getElementById("SoulcodeExtensionTemplates")?.remove();

  const templatePlacement = document.getElementById("pr_package")?.parentNode?.parentNode?.parentNode as HTMLElement;

  // Static markup only — template-derived strings are appended as DOM nodes below.
  const logoPath = chrome.runtime.getURL("assets/logo_orig.png");
  templatePlacement.insertAdjacentHTML(
    "beforeend",
    `<div id="SoulcodeExtensionTemplates" class="row-fluid">
        <hr>
        <div class="bx-formular-header" style="display: flex; justify-content: space-between">
            <h2 title="Soulcode extension v${VERSION} — last update ${DATE}">Templates</h2>
            <div id="SoulcodeExtensionActions" style="margin-left: 4px; margin-bottom: 5px; display: flex; align-items: center; gap: 5px;">
              <div class="template-search-filter">
                <input type="search" id="templateFilter" class="search-input" placeholder="Filter templates">
                <button id="templateFilterReset" class="template-search-filter-clear-button" type="button">&times;</button>
              </div>
              <button type="button" id="AddNewTemplate" class="btn btn-info">+ Add</button>
              <button type="button" id="DeleteTemplate" class="btn">Delete</button>
            </div>
        </div>
        <div id="bexioTimetrackingTemplates-entries"><div id="templateFilterEmpty" hidden></div></div>
        <div id="SoulcodeExtensionLoader" style="position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #3176b4;
        z-index: 10000000000;
        opacity: 0.6;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 5rem;
        display: none;">
            <div style="color: white"><img src="${logoPath}" style="min-width: 200px; max-width: 10vw; margin-right: 20px;" />Loading...</div>
            <div id="closeModal" style="position: absolute; top: 30px; right: 30px; cursor: pointer;">
                <div style="width: 40px; height: 40px; border-radius: 50%; background-color: #ccc; display: flex; justify-content: center; align-items: center;">
                    <span style="font-size: 2rem;font-weight: normal;">&times;</span>
                </div>
            </div>
        </div>
    </div>`,
  );

  const panel = document.getElementById("SoulcodeExtensionTemplates")!;
  const entriesContainer = document.getElementById("bexioTimetrackingTemplates-entries")!;
  const emptyState = document.getElementById("templateFilterEmpty")!;

  (templateEntries ?? []).forEach((entry) => entriesContainer.insertBefore(createTemplateChip(entry), emptyState));

  // ── Delete mode (legacy — replaced by manage mode in a later change) ──
  const deleteTemplateButton = document.getElementById("DeleteTemplate")!;
  let deleteMode = false;
  const disableDeleteMode = () => {
    deleteMode = false;
    deleteTemplateButton.classList.remove("btn-danger");
  };

  // ── Apply / delete-mode click handling (delegated) ──
  entriesContainer.addEventListener("click", (e) => {
    const applyButton = (e.target as HTMLElement).closest<HTMLButtonElement>("button.template-button");
    if (!applyButton) return;
    e.preventDefault();
    if (deleteMode) {
      confirmActiveTemplateDeletion(applyButton.id);
      disableDeleteMode();
      return;
    }
    fillForm(applyButton.id);
    setActiveChip(panel, applyButton);
  });

  document.getElementById("AddNewTemplate")?.addEventListener("click", (e) => {
    e.preventDefault();
    readFormData();
  });

  deleteTemplateButton.addEventListener("click", (e) => {
    e.preventDefault();
    const activeButton = document.querySelector(".template-button--active") ?? undefined;
    if (activeButton) {
      confirmActiveTemplateDeletion();
    } else if (deleteMode) {
      disableDeleteMode();
      alert("Delete mode deactivated.");
    } else {
      deleteMode = true;
      deleteTemplateButton.classList.add("btn-danger");
      alert("Select a template to delete.");
    }
  });

  document.getElementById("closeModal")?.addEventListener("click", (e) => {
    e.preventDefault();
    toggleDisplayLoader(false);
  });

  // ── Filter (interim: name+keywords via data-filter; replaced by filter.ts later) ──
  const chips = () => Array.from(entriesContainer.querySelectorAll<HTMLElement>(".template-chip"));
  document.getElementById("templateFilter")?.addEventListener("input", (e) => {
    const query = (e.target as HTMLInputElement).value.trim().toLowerCase();
    chips().forEach((chip) => (chip.hidden = !(chip.dataset.filter ?? "").includes(query)));
  });
  document.getElementById("templateFilterReset")?.addEventListener("click", (e) => {
    e.preventDefault();
    (document.getElementById("templateFilter") as HTMLInputElement).value = "";
    chips().forEach((chip) => (chip.hidden = false));
  });
}

export default renderHtml;
```

- [ ] **Step 4: Rewrite the stylesheet**

`packages/chrome-extension/public/bexioTimetrackingTemplates.css`:

```css
:root {
  --soulcodeGreen: #33b7a3;
  --soulcodeBlue: #3276b4;
  --soulcodeDanger: #cf4a4a;
}

#SoulcodeExtensionTemplates {
  position: relative; /* anchors the tooltip and the toast */
}

#bexioTimetrackingTemplates-entries {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
}

/* ── Chips ── */
.template-chip {
  position: relative;
  display: flex;
}

.template-chip[hidden] {
  display: none;
}

button.template-button {
  flex: 1;
  width: 100%;
  text-align: left;
  border: 1px solid #c6d9ea;
  background: #eef4fa;
  color: #1d5c98;
  border-radius: 4px;
  padding: 6px 28px 6px 10px; /* right padding leaves room for the corner buttons */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

button.template-button:hover {
  background: #e1edf8;
  border-color: #9cc0de;
}

button.template-button:focus-visible {
  outline: 2px solid var(--soulcodeBlue);
  outline-offset: 1px;
}

button.template-button.template-button--active {
  background: var(--soulcodeGreen);
  border-color: #2aa392;
  color: #fff;
  font-weight: 600;
}

button.template-button.template-button--active::before {
  content: "✓ ";
  font-weight: 700;
}

/* ── Corner buttons inside a chip ── */
.template-chip-update {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
  font-size: 11px;
  line-height: 1;
  padding: 3px 5px;
  cursor: pointer;
}

.template-chip-update:hover {
  background: rgba(255, 255, 255, 0.45);
}

.template-chip-delete {
  display: none; /* manage mode only (see .manage-mode below) */
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  line-height: 14px;
  text-align: center;
  border: none;
  border-radius: 50%;
  background: var(--soulcodeDanger);
  color: #fff;
  font-size: 11px;
  padding: 0;
  cursor: pointer;
}

/* ── Manage mode ── */
.manage-mode .template-chip-delete {
  display: block;
}

.manage-mode .template-chip-update {
  display: none;
}

.manage-mode button.template-button {
  border-style: dashed;
  border-color: #d9a0a0;
  background: #fdf7f7;
  color: #7a3030;
}

/* ── Filter ── */
.template-search-filter {
  position: relative;
  width: 150px;

  .search-input {
    width: 100%;
    margin: 0;
  }

  button.template-search-filter-clear-button {
    position: absolute;
    border: none;
    display: block;
    width: 15px;
    height: 15px;
    line-height: 10px;
    font-size: 12px;
    border-radius: 50%;
    top: 0;
    bottom: 0;
    right: 5px;
    background: #ddd;
    margin: 7px 0;
    padding: 0;
    outline: none;
    cursor: pointer;
    transition: 0.1s;
  }

  button.template-search-filter-clear-button[hidden] {
    display: none;
  }
}

#templateFilterEmpty {
  grid-column: 1 / -1;
  color: #8a95a0;
  font-size: 12.5px;
  padding: 8px 4px;
}

#templateFilterEmpty[hidden] {
  display: none;
}

/* ── Inline add form ── */
#SoulcodeExtensionAddForm {
  display: flex;
  gap: 6px;
  align-items: center;
  background: #f2f7fb;
  border: 1px solid #cfe0ee;
  border-radius: 4px;
  padding: 8px 10px;
  margin-bottom: 8px;
}

#SoulcodeExtensionAddForm[hidden] {
  display: none;
}

#SoulcodeExtensionAddForm input {
  flex: 1;
  margin: 0;
}

#templateNameError {
  color: var(--soulcodeDanger);
  font-size: 12px;
}

/* ── Toast (undo / errors) ── */
#SoulcodeExtensionToast {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  background: #2c3540;
  color: #f0f4f7;
  border-radius: 4px;
  padding: 7px 12px;
  font-size: 12.5px;
}

#SoulcodeExtensionToast button {
  margin-left: auto;
  border: none;
  background: transparent;
  color: #7fd0c2;
  font-weight: 600;
  cursor: pointer;
  padding: 2px 4px;
}

/* ── Tooltip (field preview) ── */
#SoulcodeTemplateTooltip {
  position: absolute;
  z-index: 30;
  width: 250px;
  background: #ffffff;
  border: 1px solid #c3cdd6;
  border-radius: 5px;
  box-shadow: 0 6px 18px rgba(20, 40, 60, 0.18);
  padding: 10px 12px;
  font-size: 12px;
  pointer-events: none;
}

#SoulcodeTemplateTooltip .tooltip-name {
  font-weight: 600;
  color: #1d5c98;
  margin-bottom: 6px;
}

#SoulcodeTemplateTooltip dl {
  display: grid;
  grid-template-columns: 84px 1fr;
  gap: 2px 8px;
  margin: 0;
}

#SoulcodeTemplateTooltip dt {
  color: #8a95a0;
}

#SoulcodeTemplateTooltip dd {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

(The add form, toast, manage-mode and tooltip rules are inert until their tasks land — shipping them here keeps the CSS a one-file rewrite.)

- [ ] **Step 5: Run the tests**

Run: `npx vitest run --project chrome-extension bexioTimetrackingTemplates`
Expected: PASS, including both XSS regression tests.

- [ ] **Step 6: Commit**

```bash
git add packages/chrome-extension/src/apps/bexioTimetrackingTemplates/renderHtml.ts packages/chrome-extension/public/bexioTimetrackingTemplates.css packages/chrome-extension/test/apps/bexioTimetrackingTemplates.test.ts
git commit -m "feat: rework template panel into chips with grid layout and header cleanup"
```

---

### Task 5: Field-preview tooltip

**Files:**
- Create: `packages/chrome-extension/src/apps/bexioTimetrackingTemplates/tooltip.ts`
- Modify: `renderHtml.ts` (wire per chip + hide on click)
- Test: `packages/chrome-extension/test/apps/bexioTimetrackingTemplates.tooltip.test.ts`

**Interfaces:**
- Produces:
  - `attachTemplateTooltip(chipButton: HTMLButtonElement, entry: TemplateEntry, panel: HTMLElement): void`
  - `hideTemplateTooltip(): void`

- [ ] **Step 1: Write the failing tests**

```ts
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "../support/load-fixture";
import type { TemplateEntry } from "@bexio-chrome-extension/shared/types";

vi.mock("@bexio-chrome-extension/chrome-extension/src/apps/bexioTimetrackingTemplates/index", () => ({
  initializeExtension: vi.fn(async () => {}),
}));
vi.mock("@bexio-chrome-extension/chrome-extension/src/utils/fillForm", () => ({ default: vi.fn(async () => {}) }));

const template = (over: Partial<TemplateEntry> = {}): TemplateEntry => ({
  templateName: "Project Falcon",
  keywords: "",
  billable: true,
  contact: "Acme AG",
  contactPerson: "Doe Jane",
  id: "tmpl1",
  package: "Package Alpha",
  project: "Project Falcon",
  status: "In Arbeit",
  work: "Consulting",
  ...over,
});

const hover = (el: Element) => el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
const unhover = (el: Element) => el.dispatchEvent(new MouseEvent("mouseleave", { bubbles: false }));
const tooltip = () => document.getElementById("SoulcodeTemplateTooltip");

describe("template tooltip", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    document.body.innerHTML = "";
    loadFixture("monitoring-edit");
  });
  afterEach(() => vi.useRealTimers());

  const render = async (entries: TemplateEntry[]) => {
    const { default: renderHtml } = await import(
      "@bexio-chrome-extension/chrome-extension/src/apps/bexioTimetrackingTemplates/renderHtml"
    );
    await renderHtml(entries);
  };

  it("shows the field preview after the hover delay, values as literal text", async () => {
    await render([template()]);
    hover(document.getElementById("tmpl1")!);
    expect(tooltip()?.hidden ?? true).toBe(true); // not yet — delay pending
    vi.advanceTimersByTime(350);

    const el = tooltip()!;
    expect(el.hidden).toBe(false);
    expect(el.querySelector(".tooltip-name")!.textContent).toBe("Project Falcon");
    const rows = Array.from(el.querySelectorAll("dt")).map((dt) => dt.textContent);
    expect(rows).toEqual(["Tätigkeit", "Projekt", "Arbeitspaket", "Kontakt", "Status", "Abrechenbar"]);
    const values = Array.from(el.querySelectorAll("dd")).map((dd) => dd.textContent);
    expect(values).toEqual(["Consulting", "Project Falcon", "Package Alpha", "Acme AG", "In Arbeit", "Ja"]);
  });

  it("renders markup in template fields as literal text (no injection)", async () => {
    const evil = '<img src=x onerror="alert(1)">';
    await render([template({ templateName: evil, project: evil })]);
    hover(document.querySelector("button.template-button")!);
    vi.advanceTimersByTime(350);

    expect(tooltip()!.querySelector("img")).toBeNull();
    expect(tooltip()!.querySelector(".tooltip-name")!.textContent).toBe(evil);
  });

  it("hides on mouseleave and on click", async () => {
    await render([template()]);
    const button = document.getElementById("tmpl1")!;
    hover(button);
    vi.advanceTimersByTime(350);
    expect(tooltip()!.hidden).toBe(false);

    unhover(button);
    expect(tooltip()!.hidden).toBe(true);

    hover(button);
    vi.advanceTimersByTime(350);
    (button as HTMLButtonElement).click();
    expect(tooltip()!.hidden).toBe(true);
  });

  it("does not show while the panel is in manage mode", async () => {
    await render([template()]);
    document.getElementById("SoulcodeExtensionTemplates")!.classList.add("manage-mode");
    hover(document.getElementById("tmpl1")!);
    vi.advanceTimersByTime(350);
    expect(tooltip()?.hidden ?? true).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --project chrome-extension bexioTimetrackingTemplates.tooltip`
Expected: FAIL — tooltip never appears.

- [ ] **Step 3: Write the implementation**

`tooltip.ts`:

```ts
import getTemplateName from "@bexio-chrome-extension/shared/getTemplateName";
import { TemplateEntry } from "@bexio-chrome-extension/shared/types";

const SHOW_DELAY_MS = 350;
const TOOLTIP_WIDTH_PX = 250;

let tooltip: HTMLDivElement | null = null;
let showTimer: number | undefined;

function ensureTooltip(panel: HTMLElement): HTMLDivElement {
  if (tooltip && tooltip.isConnected) return tooltip;
  tooltip = document.createElement("div");
  tooltip.id = "SoulcodeTemplateTooltip";
  tooltip.hidden = true;
  panel.appendChild(tooltip);
  return tooltip;
}

export function hideTemplateTooltip(): void {
  window.clearTimeout(showTimer);
  if (tooltip) tooltip.hidden = true;
}

/** Attaches the delayed field-preview tooltip to one chip's apply button. */
export function attachTemplateTooltip(chipButton: HTMLButtonElement, entry: TemplateEntry, panel: HTMLElement): void {
  chipButton.addEventListener("mouseenter", () => {
    if (panel.classList.contains("manage-mode")) return;
    window.clearTimeout(showTimer);
    showTimer = window.setTimeout(() => showTooltip(chipButton, entry, panel), SHOW_DELAY_MS);
  });
  chipButton.addEventListener("mouseleave", hideTemplateTooltip);
}

function showTooltip(chipButton: HTMLButtonElement, entry: TemplateEntry, panel: HTMLElement): void {
  const el = ensureTooltip(panel);
  el.innerHTML = ""; // clearing only — template values go in via textContent below

  const name = document.createElement("div");
  name.className = "tooltip-name";
  name.textContent = getTemplateName(entry);
  el.appendChild(name);

  const dl = document.createElement("dl");
  const rows: Array<[string, string]> = [
    ["Tätigkeit", entry.work],
    ["Projekt", entry.project],
    ["Arbeitspaket", entry.package],
    ["Kontakt", entry.contact],
    ["Status", entry.status],
    ["Abrechenbar", entry.billable ? "Ja" : "Nein"],
  ];
  for (const [label, value] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value ?? "";
    dl.append(dt, dd);
  }
  el.appendChild(dl);

  // Position below the chip, clamped inside the panel (rects are 0 in jsdom — harmless).
  const chipRect = chipButton.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const left = Math.max(0, Math.min(chipRect.left - panelRect.left, panelRect.width - TOOLTIP_WIDTH_PX));
  el.style.left = `${left}px`;
  el.style.top = `${chipRect.bottom - panelRect.top + 6}px`;
  el.hidden = false;
}
```

In `renderHtml.ts`: import `{ attachTemplateTooltip, hideTemplateTooltip } from "./tooltip";`, call `attachTemplateTooltip(button, entry, panel)` — since `createTemplateChip` doesn't see the panel, do the wiring in the render loop:

```ts
(templateEntries ?? []).forEach((entry) => {
  const chip = createTemplateChip(entry);
  entriesContainer.insertBefore(chip, emptyState);
  attachTemplateTooltip(chip.querySelector<HTMLButtonElement>("button.template-button")!, entry, panel);
});
```

and add `hideTemplateTooltip();` as the first line of the apply branch in the delegated click handler.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --project chrome-extension bexioTimetrackingTemplates`
Expected: PASS (both files).

- [ ] **Step 5: Commit**

```bash
git add packages/chrome-extension/src/apps/bexioTimetrackingTemplates/tooltip.ts packages/chrome-extension/src/apps/bexioTimetrackingTemplates/renderHtml.ts packages/chrome-extension/test/apps/bexioTimetrackingTemplates.tooltip.test.ts
git commit -m "feat: add field-preview tooltip to template chips"
```

---

### Task 6: Filter v2 (keywords, Enter, Esc, empty state)

**Files:**
- Create: `packages/chrome-extension/src/apps/bexioTimetrackingTemplates/filter.ts`
- Modify: `renderHtml.ts` (replace the interim filter listeners with `setupTemplateFilter(panel)`)
- Test: `packages/chrome-extension/test/apps/bexioTimetrackingTemplates.filter.test.ts`

**Interfaces:**
- Produces: `setupTemplateFilter(panel: HTMLElement): void` — queries `#templateFilter`, `#templateFilterReset`, `#templateFilterEmpty` and `.template-chip[data-filter]` inside `panel`.

- [ ] **Step 1: Write the failing tests** (same mock/fixture boilerplate as the tooltip test file; `render` helper identical)

```ts
const input = () => document.getElementById("templateFilter") as HTMLInputElement;
const reset = () => document.getElementById("templateFilterReset") as HTMLButtonElement;
const empty = () => document.getElementById("templateFilterEmpty") as HTMLElement;
const chipFor = (id: string) => document.getElementById(id)!.closest(".template-chip") as HTMLElement;
const type = (value: string) => {
  input().value = value;
  input().dispatchEvent(new Event("input", { bubbles: true }));
};
const key = (k: string) => input().dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

it("matches against keywords, not only the name", async () => {
  await render([template(), template({ id: "tmpl2", templateName: "Globex GmbH", keywords: "zebra invoicing" })]);
  type("zebra");
  expect(chipFor("tmpl1").hidden).toBe(true);
  expect(chipFor("tmpl2").hidden).toBe(false);
});

it("shows the empty state with the query when nothing matches, and hides it again", async () => {
  await render([template()]);
  type("nomatch");
  expect(empty().hidden).toBe(false);
  expect(empty().textContent).toBe('No templates match "nomatch"');
  type("falcon");
  expect(empty().hidden).toBe(true);
});

it("Escape clears the filter", async () => {
  await render([template(), template({ id: "tmpl2", templateName: "Globex GmbH" })]);
  type("falcon");
  expect(chipFor("tmpl2").hidden).toBe(true);
  key("Escape");
  expect(input().value).toBe("");
  expect(chipFor("tmpl2").hidden).toBe(false);
});

it("Enter applies the single visible match — and does nothing with several", async () => {
  const { default: fillForm } = await import("@bexio-chrome-extension/chrome-extension/src/utils/fillForm");
  await render([template(), template({ id: "tmpl2", templateName: "Globex GmbH" })]);
  type("template"); // matches neither → 0 visible
  key("Enter");
  type(""); // both visible
  key("Enter");
  expect(vi.mocked(fillForm)).not.toHaveBeenCalled();

  type("globex"); // exactly one
  key("Enter");
  expect(vi.mocked(fillForm)).toHaveBeenCalledWith("tmpl2");
  expect(document.getElementById("tmpl2")!.classList.contains("template-button--active")).toBe(true);
});

it("clear button resets and is only visible while filtering", async () => {
  await render([template()]);
  expect(reset().hidden).toBe(true);
  type("fal");
  expect(reset().hidden).toBe(false);
  reset().click();
  expect(input().value).toBe("");
  expect(reset().hidden).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --project chrome-extension bexioTimetrackingTemplates.filter`
Expected: FAIL (keywords/empty-state/keyboard behaviours missing).

- [ ] **Step 3: Write the implementation**

`filter.ts`:

```ts
/**
 * Filter behaviour for the template panel. Matching runs against each chip's
 * `data-filter` (lowercased name + keywords, set at render time), so this
 * module never touches template strings itself.
 */
export function setupTemplateFilter(panel: HTMLElement): void {
  const input = panel.querySelector<HTMLInputElement>("#templateFilter");
  const reset = panel.querySelector<HTMLButtonElement>("#templateFilterReset");
  const emptyState = panel.querySelector<HTMLElement>("#templateFilterEmpty");
  if (!input || !reset || !emptyState) return;

  const chips = () => Array.from(panel.querySelectorAll<HTMLElement>(".template-chip"));

  const applyFilter = (): HTMLElement[] => {
    const query = input.value.trim().toLowerCase();
    const visible: HTMLElement[] = [];
    for (const chip of chips()) {
      const match = (chip.dataset.filter ?? "").includes(query);
      chip.hidden = !match;
      if (match) visible.push(chip);
    }
    emptyState.textContent = `No templates match "${input.value.trim()}"`;
    emptyState.hidden = visible.length > 0;
    reset.hidden = query === "";
    return visible;
  };

  input.addEventListener("input", applyFilter);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input.value = "";
      applyFilter();
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const visible = applyFilter();
      if (visible.length === 1) visible[0].querySelector<HTMLButtonElement>("button.template-button")?.click();
    }
  });
  reset.addEventListener("click", (e) => {
    e.preventDefault();
    input.value = "";
    applyFilter();
    input.focus();
  });

  applyFilter(); // initial state: clear button hidden, empty state correct for zero templates
}
```

In `renderHtml.ts`: delete the interim "── Filter ──" block and replace it with `setupTemplateFilter(panel);` (import from `./filter`).

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --project chrome-extension bexioTimetrackingTemplates`
Expected: PASS (all three files).

- [ ] **Step 5: Commit**

```bash
git add packages/chrome-extension/src/apps/bexioTimetrackingTemplates/filter.ts packages/chrome-extension/src/apps/bexioTimetrackingTemplates/renderHtml.ts packages/chrome-extension/test/apps/bexioTimetrackingTemplates.filter.test.ts
git commit -m "feat: keyword-aware template filter with keyboard support and empty state"
```

---

### Task 7: `panelToast`

**Files:**
- Create: `packages/chrome-extension/src/apps/bexioTimetrackingTemplates/panelToast.ts`
- Test: `packages/chrome-extension/test/apps/bexioTimetrackingTemplates.panelToast.test.ts`

**Interfaces:**
- Produces:
  - `type PanelToastOptions = { text: string; actionLabel?: string; onAction?: () => void; durationMs?: number }`
  - `showPanelToast(panel: HTMLElement, options: PanelToastOptions): void`
  - `hidePanelToast(): void`

- [ ] **Step 1: Write the failing tests**

```ts
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const importModule = async () =>
  await import("@bexio-chrome-extension/chrome-extension/src/apps/bexioTimetrackingTemplates/panelToast");
const toast = () => document.getElementById("SoulcodeExtensionToast");

describe("panelToast", () => {
  let panel: HTMLElement;
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="panel"></div>';
    panel = document.getElementById("panel")!;
  });
  afterEach(() => vi.useRealTimers());

  it("renders text (as literal text) and auto-hides after 5 seconds", async () => {
    const { showPanelToast } = await importModule();
    showPanelToast(panel, { text: 'Deleted "<b>x</b>"' });
    expect(toast()!.textContent).toBe('Deleted "<b>x</b>"');
    expect(toast()!.querySelector("b")).toBeNull();
    vi.advanceTimersByTime(5000);
    expect(toast()).toBeNull();
  });

  it("fires the action once and hides immediately", async () => {
    const { showPanelToast } = await importModule();
    const onAction = vi.fn();
    showPanelToast(panel, { text: "Deleted", actionLabel: "Undo", onAction });
    const button = toast()!.querySelector("button")!;
    expect(button.textContent).toBe("Undo");
    button.click();
    expect(onAction).toHaveBeenCalledOnce();
    expect(toast()).toBeNull();
  });

  it("a second toast replaces the first, hidePanelToast removes it", async () => {
    const { showPanelToast, hidePanelToast } = await importModule();
    showPanelToast(panel, { text: "first" });
    showPanelToast(panel, { text: "second" });
    expect(document.querySelectorAll("#SoulcodeExtensionToast")).toHaveLength(1);
    expect(toast()!.textContent).toBe("second");
    hidePanelToast();
    expect(toast()).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --project chrome-extension panelToast`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
const DEFAULT_DURATION_MS = 5000;

let hideTimer: number | undefined;

export type PanelToastOptions = {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
};

/** Shows the panel's single toast (replacing any current one). Text only — never HTML. */
export function showPanelToast(panel: HTMLElement, options: PanelToastOptions): void {
  hidePanelToast();

  const toast = document.createElement("div");
  toast.id = "SoulcodeExtensionToast";

  const text = document.createElement("span");
  text.textContent = options.text;
  toast.appendChild(text);

  if (options.actionLabel && options.onAction) {
    const action = document.createElement("button");
    action.type = "button";
    action.textContent = options.actionLabel;
    action.addEventListener("click", () => {
      hidePanelToast();
      options.onAction!();
    });
    toast.appendChild(action);
  }

  panel.appendChild(toast);
  hideTimer = window.setTimeout(hidePanelToast, options.durationMs ?? DEFAULT_DURATION_MS);
}

export function hidePanelToast(): void {
  window.clearTimeout(hideTimer);
  document.getElementById("SoulcodeExtensionToast")?.remove();
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --project chrome-extension panelToast`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/chrome-extension/src/apps/bexioTimetrackingTemplates/panelToast.ts packages/chrome-extension/test/apps/bexioTimetrackingTemplates.panelToast.test.ts
git commit -m "feat: add in-panel toast for undo and error feedback"
```

---

### Task 8: Inline add form (replaces `prompt()`)

**Files:**
- Create: `packages/chrome-extension/src/apps/bexioTimetrackingTemplates/inlineAddForm.ts`
- Modify: `renderHtml.ts` (add the form markup; wire `setupInlineAddForm`; drop `readFormData`)
- Delete: `packages/chrome-extension/src/utils/readFormData.ts`, `packages/chrome-extension/test/utils/readFormData.test.ts`
- Test: `packages/chrome-extension/test/apps/bexioTimetrackingTemplates.addForm.test.ts`

**Interfaces:**
- Consumes: `readCurrentFormValues`/`suggestTemplateName` (Task 1), `createTemplateFromForm` (Task 2), `initializeExtension` from `./index` (same import cycle `readFormData` had — it is safe).
- Produces: `setupInlineAddForm(panel: HTMLElement): void` — queries `#AddNewTemplate`, `#SoulcodeExtensionAddForm`, `#templateNameInput`, `#templateNameSave`, `#templateNameCancel`, `#templateNameError`.

- [ ] **Step 1: Write the failing tests** (same boilerplate as the tooltip test file; use the **filled** fixture so the suggestion has values; seed `entries: []` in `beforeEach`)

```ts
const openForm = async () => {
  (document.getElementById("AddNewTemplate") as HTMLButtonElement).click();
  await vi.waitFor(() => expect((document.getElementById("SoulcodeExtensionAddForm") as HTMLElement).hidden).toBe(false));
};
const nameInput = () => document.getElementById("templateNameInput") as HTMLInputElement;
const errorEl = () => document.getElementById("templateNameError") as HTMLElement;
const save = () => (document.getElementById("templateNameSave") as HTMLButtonElement).click();

it("opens with the suggested name pre-filled ('Misc' from the filled fixture's package)", async () => {
  await render([]); // uses loadFixture("monitoring-edit-filled") in beforeEach for THIS file
  await openForm();
  expect(nameInput().value).toBe("Misc");
});

it("saves a template and re-renders; no prompt() involved", async () => {
  const { initializeExtension } = await import(
    "@bexio-chrome-extension/chrome-extension/src/apps/bexioTimetrackingTemplates/index"
  );
  await render([]);
  await openForm();
  nameInput().value = "My Inline Template";
  save();
  await vi.waitFor(async () => {
    const stored = await chrome.storage.local.get("entries");
    expect((stored.entries as Array<{ templateName: string }>).map((e) => e.templateName)).toEqual([
      "My Inline Template",
    ]);
  });
  expect(vi.mocked(initializeExtension)).toHaveBeenCalled();
});

it("shows an inline error on empty name and on duplicate", async () => {
  await render([]);
  await openForm();
  nameInput().value = "   ";
  save();
  await vi.waitFor(() => expect(errorEl().hidden).toBe(false));
  expect(errorEl().textContent).toBe("Please enter a name for the template.");

  nameInput().value = "Twice";
  save();
  await vi.waitFor(async () => expect(((await chrome.storage.local.get("entries")).entries as unknown[]).length).toBe(1));
  await openForm(); // re-open (save closed it)
  nameInput().value = "Twice"; // same name + same form values → same hash
  save();
  await vi.waitFor(() => expect(errorEl().hidden).toBe(false));
  expect(errorEl().textContent).toBe("A template with identical values already exists.");
});

it("Escape closes the form without saving", async () => {
  await render([]);
  await openForm();
  nameInput().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  expect((document.getElementById("SoulcodeExtensionAddForm") as HTMLElement).hidden).toBe(true);
  expect(((await chrome.storage.local.get("entries")).entries as unknown[] | undefined) ?? []).toHaveLength(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --project chrome-extension bexioTimetrackingTemplates.addForm`
Expected: FAIL — no add form in the DOM.

- [ ] **Step 3: Write the implementation**

`inlineAddForm.ts`:

```ts
import { createTemplateFromForm } from "../../utils/createTemplateFromForm";
import { readCurrentFormValues, suggestTemplateName } from "../../utils/readCurrentFormValues";
import { initializeExtension } from "./index";

/** Inline replacement for the old prompt()-based add flow. */
export function setupInlineAddForm(panel: HTMLElement): void {
  const addButton = panel.querySelector<HTMLButtonElement>("#AddNewTemplate");
  const form = panel.querySelector<HTMLElement>("#SoulcodeExtensionAddForm");
  const input = panel.querySelector<HTMLInputElement>("#templateNameInput");
  const saveButton = panel.querySelector<HTMLButtonElement>("#templateNameSave");
  const cancelButton = panel.querySelector<HTMLButtonElement>("#templateNameCancel");
  const error = panel.querySelector<HTMLElement>("#templateNameError");
  if (!addButton || !form || !input || !saveButton || !cancelButton || !error) return;

  const close = () => {
    form.hidden = true;
    error.hidden = true;
  };

  const showError = (message: string) => {
    error.textContent = message;
    error.hidden = false;
  };

  const submit = async () => {
    const name = input.value.trim();
    if (!name) {
      showError("Please enter a name for the template.");
      return;
    }
    let result;
    try {
      result = await createTemplateFromForm(name);
    } catch {
      showError("Could not save the template — storage error.");
      return;
    }
    if (!result.ok) {
      showError("A template with identical values already exists.");
      return;
    }
    close();
    await initializeExtension(); // re-renders the panel with the new template
  };

  addButton.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!form.hidden) {
      close();
      return;
    }
    input.value = suggestTemplateName(await readCurrentFormValues());
    error.hidden = true;
    form.hidden = false;
    input.select();
    input.focus();
  });

  cancelButton.addEventListener("click", (e) => {
    e.preventDefault();
    close();
  });
  saveButton.addEventListener("click", (e) => {
    e.preventDefault();
    void submit();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void submit();
    }
    if (e.key === "Escape") close();
  });
}
```

In `renderHtml.ts`:
- Add the form markup directly after the closing `</div>` of `.bx-formular-header` (before the entries container):

```html
<div id="SoulcodeExtensionAddForm" hidden>
  <label for="templateNameInput">Name</label>
  <input type="text" id="templateNameInput">
  <button type="button" id="templateNameSave" class="btn btn-info">Save</button>
  <button type="button" id="templateNameCancel" class="btn">Cancel</button>
  <span id="templateNameError" hidden></span>
</div>
```

- Replace the `#AddNewTemplate` → `readFormData()` listener with `setupInlineAddForm(panel);` and remove the `readFormData` import.
- Verify nothing else imports it, then delete the file and its test:

```bash
grep -rn "readFormData" packages/ --include="*.ts" --include="*.tsx"
```

Expected: no hits outside the two files being deleted. Then `git rm packages/chrome-extension/src/utils/readFormData.ts packages/chrome-extension/test/utils/readFormData.test.ts`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --project chrome-extension bexioTimetrackingTemplates createTemplateFromForm readCurrentFormValues`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A packages/chrome-extension
git commit -m "feat: replace prompt-based template add with inline form"
```

---

### Task 9: Update action on the active chip

**Files:**
- Create: `packages/chrome-extension/src/utils/updateActiveTemplate.ts`
- Modify: `renderHtml.ts` (wire the `↻` button)
- Test: `packages/chrome-extension/test/utils/updateActiveTemplate.test.ts` and extend `test/apps/bexioTimetrackingTemplates.test.ts`

**Interfaces:**
- Consumes: `readCurrentFormValues` (Task 1), `chromeStorageTemplateEntries.loadTemplates/updateTemplate`, `showPanelToast` (Task 7).
- Produces: `updateActiveTemplate(templateId: string): Promise<boolean>` — `false` when the id is not in storage (nothing written).

- [ ] **Step 1: Write the failing util tests**

`test/utils/updateActiveTemplate.test.ts` (filled fixture; seed storage):

```ts
it("overwrites the stored fields with the form values, keeping id, templateName and keywords", async () => {
  loadFixture("monitoring-edit-filled");
  const existing = template({ id: "keep-me", templateName: "Keep Name", keywords: "kw stays", work: "Old" });
  await chrome.storage.local.set({ entries: [existing] });

  const { updateActiveTemplate } = await import(
    "@bexio-chrome-extension/chrome-extension/src/utils/updateActiveTemplate"
  );
  expect(await updateActiveTemplate("keep-me")).toBe(true);

  const stored = (await chrome.storage.local.get("entries")).entries as TemplateEntry[];
  expect(stored).toHaveLength(1);
  expect(stored[0].id).toBe("keep-me");
  expect(stored[0].templateName).toBe("Keep Name");
  expect(stored[0].keywords).toBe("kw stays");
  expect(stored[0].work).toBe("Work"); // from the filled fixture
  expect(stored[0].project).toBe("Acme - Back Office");
});

it("returns false and writes nothing for an unknown id", async () => {
  loadFixture("monitoring-edit-filled");
  await chrome.storage.local.set({ entries: [template({ id: "other" })] });
  const { updateActiveTemplate } = await import(
    "@bexio-chrome-extension/chrome-extension/src/utils/updateActiveTemplate"
  );
  expect(await updateActiveTemplate("missing")).toBe(false);
  const stored = (await chrome.storage.local.get("entries")).entries as TemplateEntry[];
  expect(stored.map((e) => e.id)).toEqual(["other"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --project chrome-extension updateActiveTemplate`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation and wire it**

`updateActiveTemplate.ts`:

```ts
import { chromeStorageTemplateEntries } from "@bexio-chrome-extension/shared";
import { readCurrentFormValues } from "./readCurrentFormValues";

/**
 * Overwrites the stored template's form fields with the current form values.
 * Keeps `id`, `templateName` and `keywords`: the id is an identifier (the side
 * panel references it via TemplateExchangeData.templateId), not a content
 * checksum — it is only ever hashed at creation time.
 *
 * Guarded against the update() unknown-id quirk (see chromeStorage.ts): if the
 * id is not in storage, nothing is written and `false` is returned.
 */
export async function updateActiveTemplate(templateId: string): Promise<boolean> {
  const entries = await chromeStorageTemplateEntries.loadTemplates();
  const existing = entries.find((entry) => entry.id === templateId);
  if (!existing) return false;

  const values = await readCurrentFormValues();
  await chromeStorageTemplateEntries.updateTemplate({ ...existing, ...values });
  return true;
}
```

In `renderHtml.ts`'s delegated click handler, before the apply-button branch:

```ts
const updateButton = (e.target as HTMLElement).closest<HTMLButtonElement>(".template-chip-update");
if (updateButton) {
  e.preventDefault();
  const applyButton = updateButton.parentElement?.querySelector<HTMLButtonElement>("button.template-button");
  if (!applyButton) return;
  void updateActiveTemplate(applyButton.id).then((updated) => {
    if (!updated) {
      showPanelToast(panel, { text: "Could not update — template not found in storage." });
      return;
    }
    updateButton.textContent = "Updated ✓";
    window.setTimeout(() => (updateButton.textContent = "↻"), 1500);
  });
  return;
}
```

(imports: `updateActiveTemplate` from `../../utils/updateActiveTemplate`, `showPanelToast` from `./panelToast`).

Add these UI tests to `bexioTimetrackingTemplates.test.ts`:

```ts
it("↻ on the active chip overwrites the template from the form and flashes 'Updated ✓'", async () => {
  document.body.innerHTML = "";
  loadFixture("monitoring-edit-filled"); // this test needs form values, not the empty fixture
  const entry = template({ work: "Old Work" });
  await chrome.storage.local.set({ entries: [entry] });
  const renderHtml = await importRenderHtml();
  await renderHtml([entry]);

  (document.getElementById("tmpl1") as HTMLButtonElement).click(); // activate
  const update = document.querySelector<HTMLButtonElement>(".template-chip-update")!;
  expect(update.hidden).toBe(false);
  update.click();

  await vi.waitFor(async () => {
    const stored = (await chrome.storage.local.get("entries")).entries as TemplateEntry[];
    expect(stored[0].work).toBe("Work"); // fixture value replaced "Old Work"
    expect(stored[0].id).toBe("tmpl1");
    expect(stored[0].templateName).toBe("Project Falcon");
  });
  expect(update.textContent).toBe("Updated ✓");
});

it("↻ shows an error toast when the template is missing from storage", async () => {
  document.body.innerHTML = "";
  loadFixture("monitoring-edit-filled");
  const entry = template();
  await chrome.storage.local.set({ entries: [] }); // rendered, but not in storage
  const renderHtml = await importRenderHtml();
  await renderHtml([entry]);

  (document.getElementById("tmpl1") as HTMLButtonElement).click();
  document.querySelector<HTMLButtonElement>(".template-chip-update")!.click();

  await vi.waitFor(() => {
    const toast = document.getElementById("SoulcodeExtensionToast");
    expect(toast?.textContent).toBe("Could not update — template not found in storage.");
  });
});
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --project chrome-extension updateActiveTemplate bexioTimetrackingTemplates`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/chrome-extension/src/utils/updateActiveTemplate.ts packages/chrome-extension/src/apps/bexioTimetrackingTemplates/renderHtml.ts packages/chrome-extension/test/utils/updateActiveTemplate.test.ts packages/chrome-extension/test/apps/bexioTimetrackingTemplates.test.ts
git commit -m "feat: add update action that overwrites the active template from the form"
```

---

### Task 10: Manage mode with undo (removes the old delete flow)

**Files:**
- Create: `packages/chrome-extension/src/apps/bexioTimetrackingTemplates/manageMode.ts`
- Modify: `renderHtml.ts` (Manage button replaces Delete; remove delete-mode code)
- Delete: `packages/chrome-extension/src/utils/confirmTemplateDeletion.ts`
- Test: `packages/chrome-extension/test/apps/bexioTimetrackingTemplates.manageMode.test.ts`

**Interfaces:**
- Consumes: `chromeStorageTemplateEntries.deleteTemplate/restoreTemplate` (Task 3), `showPanelToast`/`hidePanelToast` (Task 7), `hideTemplateTooltip` (Task 5), `initializeExtension` from `./index`.
- Produces: `setupManageMode(panel: HTMLElement, templateEntries: TemplateEntry[]): void` — queries `#ManageTemplates`, `#bexioTimetrackingTemplates-entries`, `#AddNewTemplate`, `#SoulcodeExtensionAddForm`; toggles the `manage-mode` class on `panel`.

- [ ] **Step 1: Write the failing tests** (same boilerplate; plain `monitoring-edit` fixture; seed storage to match the rendered entries)

```ts
const manageButton = () => document.getElementById("ManageTemplates") as HTMLButtonElement;
const panelEl = () => document.getElementById("SoulcodeExtensionTemplates")!;
const deleteCross = (id: string) =>
  document.getElementById(id)!.closest(".template-chip")!.querySelector<HTMLButtonElement>(".template-chip-delete")!;

it("Manage toggles the mode: class, label, Add disabled, toast cleared on exit", async () => {
  await render([template()]);
  manageButton().click();
  expect(panelEl().classList.contains("manage-mode")).toBe(true);
  expect(manageButton().textContent).toBe("Done");
  expect((document.getElementById("AddNewTemplate") as HTMLButtonElement).disabled).toBe(true);

  manageButton().click();
  expect(panelEl().classList.contains("manage-mode")).toBe(false);
  expect(manageButton().textContent).toBe("Manage");
  expect((document.getElementById("AddNewTemplate") as HTMLButtonElement).disabled).toBe(false);
});

it("clicking × in manage mode deletes from storage, removes the chip and offers Undo", async () => {
  const entry = template();
  await chrome.storage.local.set({ entries: [entry] });
  await render([entry]);
  manageButton().click();
  deleteCross("tmpl1").click();

  await vi.waitFor(async () => {
    expect(((await chrome.storage.local.get("entries")).entries as unknown[]).length).toBe(0);
  });
  expect(document.getElementById("tmpl1")).toBeNull();
  const toast = document.getElementById("SoulcodeExtensionToast")!;
  expect(toast.textContent).toContain('Deleted "Project Falcon"');
  expect(toast.querySelector("button")!.textContent).toBe("Undo");
});

it("Undo restores the entry and re-renders", async () => {
  const { initializeExtension } = await import(
    "@bexio-chrome-extension/chrome-extension/src/apps/bexioTimetrackingTemplates/index"
  );
  const entry = template();
  await chrome.storage.local.set({ entries: [entry] });
  await render([entry]);
  manageButton().click();
  deleteCross("tmpl1").click();
  await vi.waitFor(() => expect(document.getElementById("SoulcodeExtensionToast")).not.toBeNull());

  document.getElementById("SoulcodeExtensionToast")!.querySelector("button")!.click();
  await vi.waitFor(async () => {
    const stored = (await chrome.storage.local.get("entries")).entries as TemplateEntry[];
    expect(stored.map((e) => e.id)).toEqual(["tmpl1"]);
  });
  expect(vi.mocked(initializeExtension)).toHaveBeenCalled();
});

it("apply-clicks are inert in manage mode; leaving the mode hides the toast", async () => {
  const { default: fillForm } = await import("@bexio-chrome-extension/chrome-extension/src/utils/fillForm");
  const entries = [template(), template({ id: "tmpl2", templateName: "Globex GmbH" })];
  await chrome.storage.local.set({ entries });
  await render(entries);
  manageButton().click();

  (document.getElementById("tmpl2") as HTMLButtonElement).click();
  expect(vi.mocked(fillForm)).not.toHaveBeenCalled();

  deleteCross("tmpl1").click();
  await vi.waitFor(() => expect(document.getElementById("SoulcodeExtensionToast")).not.toBeNull());
  manageButton().click(); // Done → undo window ends
  expect(document.getElementById("SoulcodeExtensionToast")).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --project chrome-extension bexioTimetrackingTemplates.manageMode`
Expected: FAIL — `#ManageTemplates` does not exist.

- [ ] **Step 3: Write the implementation**

`manageMode.ts`:

```ts
import { chromeStorageTemplateEntries } from "@bexio-chrome-extension/shared";
import { TemplateEntry } from "@bexio-chrome-extension/shared/types";
import { hidePanelToast, showPanelToast } from "./panelToast";
import { hideTemplateTooltip } from "./tooltip";
import { initializeExtension } from "./index";

/**
 * Manage mode: the explicit, visible replacement for the old hidden delete
 * mode. Deleting is instant with a 5-second Undo toast instead of confirm().
 */
export function setupManageMode(panel: HTMLElement, templateEntries: TemplateEntry[]): void {
  const manageButton = panel.querySelector<HTMLButtonElement>("#ManageTemplates");
  const entriesContainer = panel.querySelector<HTMLElement>("#bexioTimetrackingTemplates-entries");
  const addButton = panel.querySelector<HTMLButtonElement>("#AddNewTemplate");
  const addForm = panel.querySelector<HTMLElement>("#SoulcodeExtensionAddForm");
  if (!manageButton || !entriesContainer) return;

  const entriesById = new Map(templateEntries.map((entry) => [entry.id, entry]));

  manageButton.addEventListener("click", (e) => {
    e.preventDefault();
    const managing = panel.classList.toggle("manage-mode");
    manageButton.textContent = managing ? "Done" : "Manage";
    hideTemplateTooltip();
    if (addButton) addButton.disabled = managing;
    if (addForm) addForm.hidden = true;
    if (!managing) hidePanelToast(); // leaving the mode ends the undo window
  });

  entriesContainer.addEventListener("click", (e) => {
    const deleteButton = (e.target as HTMLElement).closest<HTMLButtonElement>(".template-chip-delete");
    if (!deleteButton || !panel.classList.contains("manage-mode")) return;
    e.preventDefault();

    const chip = deleteButton.closest<HTMLElement>(".template-chip");
    const applyButton = chip?.querySelector<HTMLButtonElement>("button.template-button");
    if (!chip || !applyButton) return;

    const entry = entriesById.get(applyButton.id);
    const name = applyButton.textContent ?? "";
    void chromeStorageTemplateEntries
      .deleteTemplate(applyButton.id)
      .then(() => {
        chip.remove();
        showPanelToast(panel, {
          text: `Deleted "${name}"`,
          actionLabel: "Undo",
          onAction: () => void undoDelete(entry, panel),
        });
      })
      .catch(() => showPanelToast(panel, { text: "Could not delete the template — storage error." }));
  });
}

async function undoDelete(entry: TemplateEntry | undefined, panel: HTMLElement): Promise<void> {
  if (!entry) return;
  try {
    // Defensive against concurrent writers: restoreTemplate is a no-op when the
    // id re-appeared in the meantime (e.g. re-added through the side panel).
    await chromeStorageTemplateEntries.restoreTemplate(entry);
  } catch {
    showPanelToast(panel, { text: "Could not restore the template — storage error." });
    return;
  }
  await initializeExtension();
}
```

In `renderHtml.ts`:
- In the header markup, replace `<button type="button" id="DeleteTemplate" class="btn">Delete</button>` with `<button type="button" id="ManageTemplates" class="btn">Manage</button>`.
- Delete the whole legacy delete-mode block (the `deleteTemplateButton` const, `deleteMode` flag, `disableDeleteMode`, the `#DeleteTemplate` click listener) and the `confirmActiveTemplateDeletion` import.
- In the delegated apply handler, replace the `deleteMode` branch with a manage-mode guard as the first check after `closest`:

```ts
if (panel.classList.contains("manage-mode")) return; // apply is inert while managing
```

- Call `setupManageMode(panel, templateEntries ?? []);` after `setupTemplateFilter(panel);` (import from `./manageMode`).
- `git rm packages/chrome-extension/src/utils/confirmTemplateDeletion.ts` (verify first: `grep -rn "confirmTemplateDeletion" packages/chrome-extension/` must only hit the file itself). `packages/shared/confirmTemplateDeletion.ts` and its test stay.
- In `bexioTimetrackingTemplates.test.ts`, drop any remaining `#DeleteTemplate` assertions.

- [ ] **Step 4: Run the whole chrome-extension unit suite**

Run: `npx vitest run --project chrome-extension`
Expected: PASS (all files, including the untouched trigger/fillForm/onMessage suites).

- [ ] **Step 5: Commit**

```bash
git add -A packages/chrome-extension
git commit -m "feat: replace hidden delete mode with manage mode and undo toast"
```

---

### Task 11: E2E update + full build

**Files:**
- Modify: `e2e/extension-behaviour.spec.ts` (tests 3 and 4)

**Interfaces:**
- Consumes: the DOM contract (`#ManageTemplates`, `.template-chip`, `.template-chip-delete`, `#SoulcodeExtensionAddForm`, `#templateNameInput`, `#templateNameSave`, `#SoulcodeExtensionToast`, `manage-mode` class). Test 2 ("clicking a template button fills the form") must keep passing unchanged — `button#<id>`, `.template-button--active` and the loader behaviour are intact by design.

- [ ] **Step 1: Rewrite test 3 (filter)**

Replace the display-based assertions with visibility and add a keyword case:

```ts
test("template filter matches names and keywords; reset restores", async () => {
  test.skip(!serviceWorker, "could not resolve the extension service worker — cannot seed chrome.storage");

  await seedTemplates([
    { ...TEMPLATE, id: "e2ealpha", templateName: "Alpha Template" },
    { ...TEMPLATE, id: "e2ebeta", templateName: "Beta Template", keywords: "zebra" },
  ]);

  const page = await context.newPage();
  await serveFixture(page, "https://office.bexio.com/index.php/monitoring/edit", "monitoring-edit");
  await page.goto("https://office.bexio.com/index.php/monitoring/edit");

  const alpha = page.locator("button#e2ealpha");
  const beta = page.locator("button#e2ebeta");
  await expect(alpha).toBeAttached({ timeout: 10_000 });

  await page.fill("#templateFilter", "alpha");
  await expect(beta).toBeHidden();
  await expect(alpha).toBeVisible();

  // keyword match: "zebra" is in beta's keywords, not its name
  await page.fill("#templateFilter", "zebra");
  await expect(alpha).toBeHidden();
  await expect(beta).toBeVisible();

  // no match → empty state with the query
  await page.fill("#templateFilter", "nomatch");
  await expect(page.locator("#templateFilterEmpty")).toBeVisible();
  await expect(page.locator("#templateFilterEmpty")).toHaveText('No templates match "nomatch"');

  await page.fill("#templateFilter", "zebra");
  await page.click("#templateFilterReset");
  await expect(page.locator("#templateFilter")).toHaveValue("");
  await expect(alpha).toBeVisible();
  await expect(beta).toBeVisible();

  await page.close();
});
```

- [ ] **Step 2: Rewrite test 4 (add + manage delete + undo, dialog-free)**

```ts
test("inline Add saves a template; manage mode deletes it with Undo — no native dialogs", async () => {
  test.skip(!serviceWorker, "could not resolve the extension service worker — cannot seed chrome.storage");

  await seedTemplates([]);

  const page = await context.newPage();
  const dialogs: string[] = [];
  page.on("dialog", (dialog) => {
    dialogs.push(`${dialog.type()}: ${dialog.message()}`);
    void dialog.dismiss();
  });

  await serveFixture(page, "https://office.bexio.com/index.php/monitoring/edit", "monitoring-edit");
  await page.goto("https://office.bexio.com/index.php/monitoring/edit");
  await expect(page.locator("#SoulcodeExtensionTemplates")).toBeAttached({ timeout: 10_000 });

  // Add via the inline form
  await page.click("#AddNewTemplate");
  await expect(page.locator("#SoulcodeExtensionAddForm")).toBeVisible();
  await page.fill("#templateNameInput", "My E2E Template");
  await page.click("#templateNameSave");
  const newButton = page.locator("button.template-button", { hasText: "My E2E Template" });
  await expect(newButton).toBeAttached({ timeout: 10_000 });

  // Delete via manage mode
  await page.click("#ManageTemplates");
  await expect(page.locator("#SoulcodeExtensionTemplates")).toHaveClass(/manage-mode/);
  await page.click(".template-chip-delete");
  await expect(page.locator("button.template-button")).toHaveCount(0, { timeout: 10_000 });
  const toast = page.locator("#SoulcodeExtensionToast");
  await expect(toast).toContainText('Deleted "My E2E Template"');

  // Undo restores it (re-render leaves manage mode)
  await toast.locator("button").click();
  await expect(page.locator("button.template-button", { hasText: "My E2E Template" })).toBeAttached({
    timeout: 10_000,
  });

  expect(dialogs, "the template area must not open native dialogs").toEqual([]);

  await page.close();
});
```

- [ ] **Step 3: Build and run the e2e suite** (from the worktree; Bash, not PowerShell — `npm run … -- -Flag` loses flags under PowerShell)

```bash
npm run build:project
npm run test:e2e
```

Expected: all e2e specs PASS (a visible Chromium window opens — that is normal; first run may need `npx playwright install chromium`).

- [ ] **Step 4: Commit**

```bash
git add e2e/extension-behaviour.spec.ts
git commit -m "test: update e2e specs for inline add, keyword filter and manage-mode delete"
```

---

### Task 12: Docs, full verification, dev-build handover

**Files:**
- Modify: `docs/architecture/testing.md` (manual walkthrough), `docs/architecture/storage.md` (restoreTemplate), `docs/architecture/form-layer.md` (read-back path references)

- [ ] **Step 1: Update the architecture docs**

- `docs/architecture/storage.md`: in the helper listing for `chromeStorageTemplateEntries`, add: `restoreTemplate(entry)` — re-inserts a deleted entry for undo; no-op returning `false` when the id already exists (defensive against concurrent side-panel writes).
- `docs/architecture/form-layer.md`: where the read-back path names `readFormData`, point to `readCurrentFormValues` (+ `suggestTemplateName`, `createTemplateFromForm`) instead, noting `readFormData.ts` was removed.
- `docs/architecture/testing.md`: in the manual walkthrough checklist, replace the Add/Delete dialog steps with the new flows (checklists are operator docs — write these steps in simple German, per the repo's convention):
  - Add: "+ Add" klicken → Inline-Feld erscheint mit vorgeschlagenem Namen → Enter speichert, Chip erscheint (kein `prompt()`-Dialog).
  - Duplikat: gleiche Formularwerte nochmals speichern → Inline-Fehlermeldung, kein Dialog.
  - Tooltip: Chip ~0,5 s hovern → Vorschau mit Tätigkeit/Projekt/Arbeitspaket/Kontakt/Status/Abrechenbar.
  - Filter: Keyword eines Templates tippen → nur dieses bleibt; "nomatch" → Leerzustand; Esc leert; bei genau einem Treffer wendet Enter es an.
  - Update: Chip anklicken (grün) → Formular ändern → ↻ klicken → "Updated ✓", Side Panel zeigt die neuen Werte.
  - Löschen: "Manage" → Chips werden rot mit × → × klicken → Chip weg, Toast mit "Undo" (5 s) → Undo stellt wieder her → "Done" beendet den Modus.

- [ ] **Step 2: Full verification**

```bash
npm run typecheck
npm test
npx prettier --check .
```

Expected: all PASS. If prettier flags files you touched, run `npx prettier --write <files>`; if it flags masses of untouched files, check line endings first (`git ls-files --eol` — the `w/` column matters, not `i/`) before assuming real formatting drift.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/testing.md docs/architecture/storage.md docs/architecture/form-layer.md
git commit -m "docs: update architecture docs for the template area redesign"
```

- [ ] **Step 4: Dev build for the user's manual walkthrough** (Bash, from the worktree)

```bash
npm run build:devRelease
npm run version:updateManifest
npm run build:project -- -Development
```

Then hand over the **worktree's** unpacked path (never the main checkout's):

```
E:\git\soulcode\bexio-chrome-extension\.claude\worktrees\code-review-improvements-c314a9\unpacked
```

Leave the version bump in `package.json` / `public/manifest.json` / `.release-please-manifest.json` **uncommitted** — versions belong to the CI release process.
