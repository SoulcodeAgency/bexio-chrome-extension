/**
 * The side-panel → content-script message listener (issue #86).
 *
 * The listener is the receiving half of the messaging contract: it must be a *synchronous*
 * dispatcher that returns `true` (keeping the message channel open) and calls `sendResponse` on
 * every path — success and failure alike — so the side panel can tell "applied" from "nothing
 * happened" instead of relying on Chrome-version-dependent async-listener semantics.
 *
 * The listener is registered on the chrome fake at import time; `chrome.runtime.onMessage.__listeners`
 * is how the test gets hold of it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChromeFake } from "../../../../test/support/chrome-fake";

const { calls } = vi.hoisted(() => ({ calls: [] as string[] }));

const { fillFormControl } = vi.hoisted(() => ({
  fillFormControl: { resolve: (_value: boolean) => {} },
}));

vi.mock("@bexio-chrome-extension/chrome-extension/src/utils/fillForm", () => ({
  default: vi.fn((id: string, billable?: boolean) => {
    calls.push(`fillForm:${id}:${String(billable)}`);
    // The listener awaits fillForm: the test decides when (and how) the fill finishes.
    return new Promise<boolean>((resolve) => {
      fillFormControl.resolve = resolve;
    });
  }),
}));

vi.mock("@bexio-chrome-extension/chrome-extension/src/utils/triggerDuration", () => ({
  default: vi.fn(async (value: string) => {
    calls.push(`duration:${value}`);
  }),
}));

vi.mock("@bexio-chrome-extension/chrome-extension/src/utils/triggerDate", () => ({
  default: vi.fn(async (value: string) => {
    calls.push(`date:${value}`);
  }),
}));

vi.mock("@bexio-chrome-extension/chrome-extension/src/utils/triggerDescription", () => ({
  default: vi.fn(async (value: string) => {
    calls.push(`description:${value}`);
  }),
}));

vi.mock("@bexio-chrome-extension/chrome-extension/src/utils/triggerCheckbox", () => ({
  default: vi.fn(async (_el: unknown, value?: boolean) => {
    calls.push(`billable:${String(value)}`);
  }),
}));

// Top-level document.querySelector — irrelevant here, and the DOM is empty.
vi.mock("@bexio-chrome-extension/chrome-extension/src/selectors/billableCheckbox", () => ({
  billableCheckbox: null,
}));

// The real module calls initializeExtension() at import time.
vi.mock("@bexio-chrome-extension/chrome-extension/src/apps/bexioTimetrackingTemplates/index", () => ({
  initializeExtension: vi.fn(() => {
    calls.push("reinit");
  }),
}));

type Listener = (request: unknown, sender: unknown, sendResponse: (response: unknown) => void) => unknown;

async function loadListener(): Promise<Listener> {
  await import("@bexio-chrome-extension/chrome-extension/src/eventListeners/onMessage");
  const listeners = getChromeFake().runtime.onMessage.__listeners;
  expect(listeners).toHaveLength(1);
  return listeners[0] as Listener;
}

/** Calls the listener and resolves with whatever it passed to sendResponse. */
async function dispatch(listener: Listener, request: unknown) {
  let response: unknown;
  let responded: (value: unknown) => void = () => {};
  const responsePromise = new Promise((resolve) => {
    responded = resolve;
  });
  const returnValue = listener(request, {}, (value) => {
    response = value;
    responded(value);
  });
  await responsePromise;
  return { returnValue, response };
}

describe("onMessage listener", () => {
  beforeEach(() => {
    calls.length = 0;
    vi.resetModules();
    document.body.innerHTML = "";
  });

  it("returns true synchronously so the message channel stays open", async () => {
    const listener = await loadListener();

    const returnValue = listener({ mode: "reload" }, {}, () => {});

    expect(returnValue).toBe(true);
  });

  it("re-initialises the injected UI and acknowledges a reload request", async () => {
    const listener = await loadListener();

    const { response } = await dispatch(listener, { mode: "reload" });

    expect(calls).toEqual(["reinit"]);
    expect(response).toEqual({ ok: true });
  });

  /**
   * The side panel offers the "submit" step as soon as the template request is acknowledged, so
   * the acknowledgement has to mean "the form is filled and the loader is gone" — not merely
   * "fillForm was started". Since #83 every waitFor* has a deadline, so awaiting is safe.
   */
  it("acknowledges a template request only after fillForm reports a complete fill", async () => {
    const listener = await loadListener();

    let response: unknown;
    const responded = new Promise<void>((resolve) => {
      listener({ mode: "template", templateId: "tmpl1", timeEntryBillable: true }, {}, (value) => {
        response = value;
        resolve();
      });
    });
    await Promise.resolve();
    expect(calls).toEqual(["fillForm:tmpl1:true"]);
    expect(response).toBeUndefined();

    fillFormControl.resolve(true);
    await responded;

    expect(response).toEqual({ ok: true });
  });

  it("answers with { ok: false } when fillForm reports an incomplete fill", async () => {
    const listener = await loadListener();

    const pending = dispatch(listener, { mode: "template", templateId: "tmpl1" });
    await Promise.resolve();
    fillFormControl.resolve(false);
    const { response } = await pending;

    expect(response).toEqual({ ok: false, error: expect.stringMatching(/not applied/i) });
  });

  describe("submit request", () => {
    function installForm(duration: string) {
      document.body.innerHTML = `
        <form id="MonitoringForm" action="/index.php/monitoring/edit" method="POST">
          <input id="monitoring_duration" value="${duration}">
          <button type="submit" name="save" class="btn btn-primary save">Speichern</button>
        </form>`;
      const form = document.getElementById("MonitoringForm") as HTMLFormElement;
      const submits: string[] = [];
      form.addEventListener("submit", (event) => {
        // jsdom cannot navigate; recording the submitter is what matters.
        event.preventDefault();
        submits.push((event as SubmitEvent).submitter?.getAttribute("name") ?? "none");
      });
      return submits;
    }

    it("clicks bexio's save button so the form submits with the `save` control", async () => {
      const submits = installForm("01:30");
      const listener = await loadListener();

      const { response } = await dispatch(listener, { mode: "submit" });

      expect(submits).toEqual(["save"]);
      expect(response).toEqual({ ok: true });
    });

    it("refuses to submit a form with an empty duration", async () => {
      const submits = installForm("");
      const listener = await loadListener();

      const { response } = await dispatch(listener, { mode: "submit" });

      expect(submits).toEqual([]);
      expect(response).toEqual({ ok: false, error: expect.stringMatching(/duration/i) });
    });

    it("answers with { ok: false } when the save button is gone", async () => {
      document.body.innerHTML = `<form id="MonitoringForm"><input id="monitoring_duration" value="01:00"></form>`;
      const listener = await loadListener();

      const { response } = await dispatch(listener, { mode: "submit" });

      expect(response).toEqual({ ok: false, error: expect.stringMatching(/save button/i) });
    });
  });

  it("applies duration, date, billable and notes, then acknowledges", async () => {
    const listener = await loadListener();

    const { response } = await dispatch(listener, {
      mode: "time+duration",
      duration: "1:30",
      date: "01.07.2026",
      notes: "Did stuff",
      billable: true,
    });

    expect(calls).toEqual([
      "duration:1:30",
      "date:01.07.2026",
      "billable:true",
      // applyNotesSetting defaults to true when nothing is stored
      "description:Did stuff",
    ]);
    expect(response).toEqual({ ok: true });
  });

  it("capitalizes the first letter of the notes by default", async () => {
    const listener = await loadListener();

    await dispatch(listener, {
      mode: "time+duration",
      duration: "0:45",
      date: "03.08.2026",
      notes: "leister weekly",
    });

    // uppercaseFirstLetterSetting defaults to true when nothing is stored
    expect(calls).toContain("description:Leister weekly");
  });

  it("applies the notes verbatim when the uppercase setting is off", async () => {
    await chrome.storage.local.set({ uppercaseFirstLetterSetting: false });
    const listener = await loadListener();

    await dispatch(listener, {
      mode: "time+duration",
      duration: "0:45",
      date: "03.08.2026",
      notes: "leister weekly",
    });

    expect(calls).toContain("description:leister weekly");
  });

  it("writes no description at all when notes are switched off", async () => {
    await chrome.storage.local.set({ applyNotesSetting: false });
    const listener = await loadListener();

    const { response } = await dispatch(listener, {
      mode: "time+duration",
      duration: "0:45",
      date: "03.08.2026",
      notes: "leister weekly",
    });

    expect(calls).toEqual(["duration:0:45", "date:03.08.2026", "billable:undefined"]);
    expect(response).toEqual({ ok: true });
  });

  it("answers with { ok: false } when a cheap trigger rejects", async () => {
    const triggerDuration = await import("@bexio-chrome-extension/chrome-extension/src/utils/triggerDuration");
    // The real trigger* modules are `async`, so a missing form field surfaces as a rejected
    // promise, never as a synchronous throw. Mock the way the real thing fails.
    vi.mocked(triggerDuration.default).mockRejectedValueOnce(new Error("duration field is gone"));
    const listener = await loadListener();

    const { response } = await dispatch(listener, {
      mode: "time+duration",
      duration: "1:30",
      date: "01.07.2026",
      notes: undefined,
    });

    expect(response).toEqual({ ok: false, error: "duration field is gone" });
  });

  it("answers with { ok: false } when triggerDate rejects", async () => {
    const triggerDate = await import("@bexio-chrome-extension/chrome-extension/src/utils/triggerDate");
    vi.mocked(triggerDate.default).mockRejectedValueOnce(new Error("date field is gone"));
    const listener = await loadListener();

    const { response } = await dispatch(listener, {
      mode: "time+duration",
      duration: "1:30",
      date: "01.07.2026",
      notes: undefined,
    });

    expect(response).toEqual({ ok: false, error: "date field is gone" });
  });

  it("answers with { ok: false } when triggerCheckbox rejects", async () => {
    const triggerCheckbox = await import("@bexio-chrome-extension/chrome-extension/src/utils/triggerCheckbox");
    vi.mocked(triggerCheckbox.default).mockRejectedValueOnce(new Error("billable checkbox is gone"));
    const listener = await loadListener();

    const { response } = await dispatch(listener, {
      mode: "time+duration",
      duration: "1:30",
      date: "01.07.2026",
      billable: true,
      notes: undefined,
    });

    expect(response).toEqual({ ok: false, error: "billable checkbox is gone" });
  });

  /**
   * Issue #124. `triggerDescription` rejects when TinyMCE's iframe body is not in the DOM yet
   * (`getDescriptionField` throws rather than returning a falsy value). While the call was not
   * awaited, that rejection never joined the dispatcher's promise chain: the side panel was told
   * `{ ok: true }` and the note silently never reached the editor.
   */
  it("answers with { ok: false } when triggerDescription rejects", async () => {
    const triggerDescription = await import("@bexio-chrome-extension/chrome-extension/src/utils/triggerDescription");
    vi.mocked(triggerDescription.default).mockRejectedValueOnce(new Error("Description field not found"));
    const listener = await loadListener();

    const { response } = await dispatch(listener, {
      mode: "time+duration",
      duration: "1:30",
      date: "01.07.2026",
      notes: "Did stuff",
    });

    expect(response).toEqual({ ok: false, error: "Description field not found" });
  });
});
