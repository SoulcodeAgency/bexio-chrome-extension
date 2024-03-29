import { load, save } from "./chromeStorage";
export const applyNotesKey = "applyNotesSetting";
export const activeTabIdKey = "activeTabId";
export const showTextColumnKey = "showTextColumnSetting";

export async function loadApplyNotesSetting(): Promise<boolean> {
  const loadedImportData = await load<boolean>(applyNotesKey);
  return loadedImportData ?? true;
}
export async function saveApplyNotesSetting(
  applyNotesSetting: boolean
): Promise<any> {
  return save<boolean>(applyNotesSetting, applyNotesKey);
}

export async function loadActiveTabId(): Promise<string | undefined> {
  const loadedImportData = await load<string>(activeTabIdKey);
  return loadedImportData ?? undefined;
}

export async function saveActiveTabId(tabId: string): Promise<any> {
  return save<string>(tabId, activeTabIdKey);
}

export async function loadShowTextColumnSetting(): Promise<boolean> {
  const loadedImportData = await load<boolean>(showTextColumnKey);
  return loadedImportData ?? true;
}
export async function saveShowTextColumnSetting(
  showTextColumnSetting: boolean
): Promise<any> {
  return save<boolean>(showTextColumnSetting, showTextColumnKey);
}
