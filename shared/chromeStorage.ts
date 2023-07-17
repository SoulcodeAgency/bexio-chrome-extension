const defaultKey: string = "entries";

// Loads from chrome local storage
export async function load<T>(key = defaultKey): Promise<T[]> {
    return await chrome.storage.local.get(key).then((result) => {
        if (result[key] && Array.isArray(result[key])) {
            return result[key] as T[];
        }
        return [];
    });
}

// Delete from chrome local storage
export async function remove<T>(id: string, key = defaultKey): Promise<any> {
    // Iterate over the chrome storage and remove the entry with the given id
    const filteredEntries = await chrome.storage.local.get(key).then((result) => {
        if (result[key] && Array.isArray(result[key])) {
            return result[key].filter((entry: T & { id: string }) => entry.id !== id);
        }
        return [];
    });
    return save(filteredEntries);
}

// Save chrome local storage
export async function save<T>(entries: T[], key = defaultKey): Promise<any> {
    return chrome.storage.local.set({ [key]: entries });
}