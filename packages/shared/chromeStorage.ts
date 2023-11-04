const defaultKey: string = "entries";

// Loads from chrome local storage
export async function load<T>(key = defaultKey): Promise<T | undefined> {
    return await chrome.storage.local.get(key).then((result) => {
        console.log("chrome.storage.local load", key, result);
        if (result[key] !== undefined) {
            return result[key] as T;
        }
        return undefined;
    });
}

// Delete from chrome local storage
export async function remove<T>(id: string, key = defaultKey): Promise<any> {
    // Iterate over the chrome storage and remove the entry with the given id
    const filteredEntries = await chrome.storage.local.get(key).then((result) => {
        //TODO, this currently only handles arrays.
        if (result[key] && Array.isArray(result[key])) {
            return result[key].filter((entry: T & { id: string }) => entry.id !== id);
        }
        return [];
    });
    return save(filteredEntries);
}

// Save chrome local storage
export async function save<T>(data: T, key = defaultKey): Promise<any> {
    return chrome.storage.local.set({ [key]: data });
}

// Update an entry in chrome local storage
export async function update<T>(updatedEntry: T & { [index: string]: string }, key = defaultKey, idKey = "id"): Promise<any> {
    // Iterate over the chrome storage and update the entry with the given id
    const entries = await chrome.storage.local.get(key);
    if (updatedEntry[idKey] === undefined) throw new Error("No id found in updatedEntry");

    if (entries[key] && Array.isArray(entries[key])) {
        const entryIndex = entries[key].findIndex((entry: T & { [index: string]: string }) => entry[idKey] === updatedEntry[idKey]);
        entries[key][entryIndex] = { ...entries[key][entryIndex], ...updatedEntry }
        console.log(entries[key][entryIndex]);
    };
    return save(entries[key] as T[]);
}

export async function clear(key = defaultKey): Promise<any> {
    return chrome.storage.local.remove(key);
}