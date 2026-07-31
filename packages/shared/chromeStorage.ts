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

/**
 * Removes the entry whose `id` property equals `id` from the stored array at `key`.
 *
 * **Array-only assumption:** if the stored value exists but is not an array, `remove`
 * silently replaces it with `[]` rather than throwing. This is a known issue — see
 * `docs/architecture/storage.md`.
 *
 * @param id   The `id` of the entry to remove.
 * @param key  The storage key (defaults to `"entries"`).
 */
export async function remove<T>(id: string, key = defaultKey): Promise<any> {
    // Iterate over the chrome storage and remove the entry with the given id
    const filteredEntries = await chrome.storage.local.get(key).then((result) => {
        //TODO, this currently only handles arrays.
        if (result[key] && Array.isArray(result[key])) {
            return result[key].filter((entry: T & { id: string }) => entry.id !== id);
        }
        return [];
    });
    return save(filteredEntries, key);
}

// Save chrome local storage
export async function save<T>(data: T, key = defaultKey): Promise<any> {
    return chrome.storage.local.set({ [key]: data });
}

/**
 * Shallow-merges `updatedEntry` over the existing entry whose `idKey` property matches.
 *
 * **Array-only assumption:** only works correctly when the stored value is an array.
 * If the stored value is absent or not an array, the entry block is skipped and
 * `save(undefined)` is called, overwriting the key with `undefined`.
 *
 * **Unknown-id no-op (with side-effect):** if no entry matches `updatedEntry[idKey]`,
 * `Array.prototype.findIndex` returns `-1` and the code executes `arr[-1] = {...}`, which
 * sets a non-index property on the array object. The array `length` is unchanged and numeric
 * iteration skips the property, but the stray property persists in memory (real
 * `chrome.storage.local` drops non-index properties on serialization). This is a known issue —
 * see `docs/architecture/storage.md`.
 *
 * @param updatedEntry  The entry to merge in. Must have a property matching `idKey`.
 * @param key           The storage key (defaults to `"entries"`).
 * @param idKey         The property name used as the unique identifier (defaults to `"id"`).
 */
export async function update<T>(updatedEntry: T & { [index: string]: string }, key = defaultKey, idKey = "id"): Promise<any> {
    // Iterate over the chrome storage and update the entry with the given id
    const entries = await chrome.storage.local.get(key);
    if (updatedEntry[idKey] === undefined) throw new Error("No id found in updatedEntry");

    if (entries[key] && Array.isArray(entries[key])) {
        const entryIndex = entries[key].findIndex((entry: T & { [index: string]: string }) => entry[idKey] === updatedEntry[idKey]);
        entries[key][entryIndex] = { ...entries[key][entryIndex], ...updatedEntry }
        console.log(entries[key][entryIndex]);
    };
    return save(entries[key] as T[], key);
}

export async function clear(key = defaultKey): Promise<any> {
    return chrome.storage.local.remove(key);
}