import { load, save } from "./chromeStorage";
export const applyNotesKey = "applyNotesSetting";

export async function loadApplyNotesSetting(): Promise<boolean> {
    const loadedImportData = await load<boolean>(applyNotesKey);
    return loadedImportData ?? true;
}
export async function saveApplyNotesSetting(applyNotesSetting: boolean): Promise<any> {
    return save<boolean>(applyNotesSetting, applyNotesKey);
}