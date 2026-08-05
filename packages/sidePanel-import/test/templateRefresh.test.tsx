/**
 * Keeping the side panel's template list in sync with storage.
 *
 * Templates are written from two places: this panel, and the content script when one is saved on
 * the bexio page. `TemplateProvider` used to read storage once on mount, so a template created on
 * the page stayed invisible here — and "Auto map templates" could not match it — until the panel
 * was closed and reopened. These tests pin both ways out of that: the manual refresh button and
 * the `chrome.storage.onChanged` subscription.
 */
import { useContext } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import App from "~/App";
import TemplateProvider from "~/TemplateProvider";
import RefreshTemplatesButton from "~/components/RefreshTemplatesButton/RefreshTemplatesButton";
import { REFRESH_TEMPLATES_LABEL } from "~/components/RefreshTemplatesButton/labels";
import { TemplateContext, TemplateContextType } from "~/TemplateContext";
import { chromeStorageTemplateEntries } from "@bexio-chrome-extension/shared";
import type { TemplateEntry } from "@bexio-chrome-extension/shared/types";
import { getChromeFake } from "../../../test/support/chrome-fake";

// Vitest runs without `globals`, so @testing-library/react never registers its automatic
// afterEach cleanup — without this every render stacks up in the same document.
afterEach(() => {
  cleanup();
});

function makeTemplate(id: string, templateName: string): TemplateEntry {
  return {
    templateName,
    keywords: "",
    billable: true,
    contact: "Acme AG",
    contactPerson: "Doe Jane",
    id,
    package: "Package Alpha",
    project: "Project Falcon",
    status: "In Arbeit",
    work: "Consulting",
  };
}

/** Renders the template names the context currently holds, so tests can assert on them. */
function TemplateProbe() {
  const { templates } = useContext<TemplateContextType>(TemplateContext);
  return (
    <ul data-testid="probe">
      {templates.map((template) => (
        <li key={template.id}>{template.templateName}</li>
      ))}
    </ul>
  );
}

function renderProvider() {
  return render(
    <TemplateProvider>
      <RefreshTemplatesButton />
      <TemplateProbe />
    </TemplateProvider>,
  );
}

describe("RefreshTemplatesButton", () => {
  it("re-reads templates that were added to storage after mount", async () => {
    await chromeStorageTemplateEntries.saveTemplates([makeTemplate("tmpl1", "Falcon Template")]);

    renderProvider();
    await waitFor(() => expect(screen.getByText("Falcon Template")).toBeTruthy());

    // Simulate the content script saving a second template on the bexio page *without* notifying
    // the panel, which is what happens when the panel was open before the listener was attached.
    const chromeFake = getChromeFake();
    const withNewTemplate = [makeTemplate("tmpl1", "Falcon Template"), makeTemplate("tmpl2", "Condor Template")];
    await chromeFake.storage.local.set({ entries: withNewTemplate });
    chromeFake.storage.onChanged.__reset();

    // Clicking must be enough — no reopening of the panel.
    await act(async () => {
      screen.getByLabelText(REFRESH_TEMPLATES_LABEL).click();
    });

    await waitFor(() => expect(screen.getByText("Condor Template")).toBeTruthy());
  });
});

describe("TemplateProvider — chrome.storage.onChanged", () => {
  it("picks up a template written by the content script without a click", async () => {
    await chromeStorageTemplateEntries.saveTemplates([makeTemplate("tmpl1", "Falcon Template")]);

    renderProvider();
    await waitFor(() => expect(screen.getByText("Falcon Template")).toBeTruthy());

    await act(async () => {
      await chromeStorageTemplateEntries.saveTemplates([
        makeTemplate("tmpl1", "Falcon Template"),
        makeTemplate("tmpl2", "Condor Template"),
      ]);
    });

    await waitFor(() => expect(screen.getByText("Condor Template")).toBeTruthy());
  });

  it("ignores changes to other storage keys", async () => {
    await chromeStorageTemplateEntries.saveTemplates([makeTemplate("tmpl1", "Falcon Template")]);
    renderProvider();
    await waitFor(() => expect(screen.getByText("Falcon Template")).toBeTruthy());

    const chromeFake = getChromeFake();
    // The import buffer shares the storage area but must not trigger a template reload.
    await act(async () => {
      await chromeFake.storage.local.set({ importData: [["Project Falcon", "1:30:00"]] });
    });

    expect(screen.getByTestId("probe").querySelectorAll("li")).toHaveLength(1);
  });

  it("removes its listener on unmount", async () => {
    const chromeFake = getChromeFake();
    const { unmount } = renderProvider();
    await waitFor(() => expect(chromeFake.storage.onChanged.__listeners.length).toBe(1));

    unmount();

    expect(chromeFake.storage.onChanged.__listeners).toHaveLength(0);
  });
});

describe("App header", () => {
  it("puts the refresh button before the two tabs", async () => {
    render(<App />);
    await act(async () => {});

    const button = screen.getByLabelText(REFRESH_TEMPLATES_LABEL);
    const tabList = document.querySelector(".ant-tabs-nav");
    expect(tabList).not.toBeNull();

    // Node.compareDocumentPosition: FOLLOWING (4) means the tab bar comes after the button.
    expect(button.compareDocumentPosition(tabList as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
