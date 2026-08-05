import { TemplateContext } from "./TemplateContext";
import { ReactNode, useCallback, useEffect, useState } from "react";
import {
  chromeStorageTemplateEntries,
  sortTemplates,
} from "@bexio-chrome-extension/shared";
import { TemplateEntry } from "@bexio-chrome-extension/shared/types";
import { developmentEnv } from "./utils/development";

/**
 * The `chrome.storage.local` key the templates are stored under — kept in sync with
 * `templateEntriesKey` in `packages/shared/chromeStorageTemplateEntries.ts`.
 */
const TEMPLATE_ENTRIES_KEY = "entries";

/**
 * `chrome.storage.onChanged` is missing when the app runs outside the extension (the standalone
 * Vite dev server) and the test fake throws on unimplemented members, so the lookup is guarded
 * the same way `sendToBexioTab` guards `chrome.tabs`.
 */
function getStorageOnChanged(): typeof chrome.storage.onChanged | undefined {
  try {
    return typeof chrome !== "undefined" && chrome.storage?.onChanged ? chrome.storage.onChanged : undefined;
  } catch {
    return undefined;
  }
}

function TemplateProvider({ children }: { children: ReactNode }) {
  const [templates, setTemplates] = useState<TemplateEntry[]>(
    sortTemplates([])
  );

  async function getDevTemplates() {
    const response = await fetch("devTemplates.json");
    return await response.json();
  }

  const reloadData = useCallback(async () => {
    const templateEntries = developmentEnv
      ? await getDevTemplates()
      : await chromeStorageTemplateEntries.loadTemplates();
    setTemplates(sortTemplates(templateEntries));
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      await reloadData();
    };

    fetchData();
  }, [reloadData]);

  /**
   * Templates are not only written here — saving one on the bexio page writes the same storage
   * key from the content script, and the panel used to keep showing its mount-time snapshot until
   * it was closed and reopened. `chrome.storage.onChanged` fires across extension contexts, so
   * those writes land here too.
   */
  useEffect(() => {
    const onChanged = getStorageOnChanged();
    if (!onChanged) return;

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName !== "local" || !(TEMPLATE_ENTRIES_KEY in changes)) return;
      console.log("Templates changed in storage, reloading");
      reloadData();
    };

    onChanged.addListener(listener);
    return () => onChanged.removeListener(listener);
  }, [reloadData]);

  return (
    <TemplateContext.Provider value={{ templates, reloadData }}>
      {children}
    </TemplateContext.Provider>
  );
}

export default TemplateProvider;
