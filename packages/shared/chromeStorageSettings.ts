import { load, save } from "./chromeStorage";
export const applyNotesKey = "applyNotesSetting";
export const activeTabIdKey = "activeTabId";
export const removePopoversKey = "removePopoversSetting";

export async function loadApplyNotesSetting(): Promise<boolean> {
  const loadedSetting = await load<boolean>(applyNotesKey);
  return loadedSetting ?? true;
}
export async function saveApplyNotesSetting(
  applyNotesSetting: boolean
): Promise<any> {
  return save<boolean>(applyNotesSetting, applyNotesKey);
}

export async function loadActiveTabId(): Promise<string | undefined> {
  const loadedSetting = await load<string>(activeTabIdKey);
  return loadedSetting ?? undefined;
}

export async function saveActiveTabId(tabId: string): Promise<any> {
  return save<string>(tabId, activeTabIdKey);
}

export async function loadRemovePopoversSetting(): Promise<boolean> {
  const loadedSetting = await load<boolean>(removePopoversKey);
  return loadedSetting ?? false;
}
export async function saveRemovePopoversSetting(
  removePopoversSetting: boolean
): Promise<any> {
  return save<boolean>(removePopoversSetting, removePopoversKey);
}
