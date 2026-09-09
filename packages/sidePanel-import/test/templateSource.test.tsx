/**
 * Where `TemplateProvider` reads its templates from.
 *
 * Regression: the choice hung off `developmentEnv` (`process.env.NODE_ENV === "development"`), so
 * a *development build of the extension* fetched the bundled `devTemplates.json` and showed ~19
 * mock templates in the side panel while the bexio page showed the user's real ones. The build
 * mode is the wrong question — what decides it is whether `chrome.storage` exists at all. Only the
 * standalone Vite dev server (`npm run dev`) lacks it, and only it needs the mock file.
 *
 * `developmentEnv` is read at module load, so these tests re-import the provider through
 * `vi.resetModules()` with `NODE_ENV` stubbed. `TemplateContext` has to come from that same fresh
 * module graph, otherwise the probe would subscribe to a different context object than the
 * provider publishes to.
 */
import { ReactNode, useContext } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { chromeStorageTemplateEntries } from "@bexio-chrome-extension/shared";
import type { TemplateEntry } from "@bexio-chrome-extension/shared/types";
import { installChromeFake } from "../../../test/support/chrome-fake";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  // A test may have removed chrome.storage; put a whole fake back so the shared
  // beforeEach reset does not trip the fake's throw-loudly guard.
  installChromeFake();
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

/**
 * Loads `TemplateProvider` and its context fresh under the given NODE_ENV, and returns a render
 * helper that shows whatever template names the context ends up holding.
 */
async function renderProviderUnderNodeEnv(nodeEnv: string) {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.resetModules();

  const { default: TemplateProvider } = await import("~/TemplateProvider");
  const { TemplateContext } = await import("~/TemplateContext");

  function Probe() {
    const { templates } = useContext(TemplateContext);
    return (
      <ul data-testid="probe">
        {templates.map((template) => (
          <li key={template.id}>{template.templateName}</li>
        ))}
      </ul>
    );
  }

  const Wrapper = ({ children }: { children: ReactNode }) => <TemplateProvider>{children}</TemplateProvider>;
  return render(
    <Wrapper>
      <Probe />
    </Wrapper>,
  );
}

describe("TemplateProvider — template source", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("reads the user's templates from chrome.storage even in a development build", async () => {
    await chromeStorageTemplateEntries.saveTemplates([makeTemplate("tmpl1", "Falcon Template")]);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await renderProviderUnderNodeEnv("development");

    await waitFor(() => expect(screen.getByText("Falcon Template")).toBeTruthy());
    // The mock file must not even be requested — it is what made the panel and the
    // bexio page disagree about which templates exist.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("falls back to the bundled mock file when there is no chrome.storage (standalone dev server)", async () => {
    const mock = makeTemplate("dev1", "Dev Mock Template");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify([mock]), { headers: { "content-type": "application/json" } }));
    delete (globalThis.chrome as unknown as Record<string, unknown>).storage;

    await renderProviderUnderNodeEnv("development");

    await waitFor(() => expect(screen.getByText("Dev Mock Template")).toBeTruthy());
    expect(fetchSpy).toHaveBeenCalledWith("devTemplates.json");
  });
});
