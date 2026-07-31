// Minimal in-memory stand-ins for the chrome.* APIs the extension touches in
// code that we unit-test. Anything not implemented here throws loudly so we
// notice when a test reaches for something new.

type StorageRecord = Record<string, unknown>;

/**
 * Mimics the serialization real `chrome.storage.local` performs on every write and
 * every read: values are converted to JSON, so callers never share a reference with
 * the store (a forgotten write-back is therefore visible to tests) and non-JSON data
 * is dropped exactly as Chrome drops it.
 *
 * A JSON round-trip is deliberate — `structuredClone` would *keep* things Chrome
 * throws away, most notably non-index array properties such as the `arr[-1]` that
 * `chromeStorage.update()` sets on an unknown id (see `docs/architecture/storage.md`,
 * known issue 2). `undefined` (and functions) survive as `undefined` rather than
 * making `JSON.parse` throw.
 */
function serialize<T>(value: T): T {
  const json = JSON.stringify(value);
  return (json === undefined ? undefined : JSON.parse(json)) as T;
}

class FakeLocalStorageArea {
  private store: StorageRecord = {};

  async get(key?: string | string[] | null): Promise<StorageRecord> {
    const out: StorageRecord = {};
    const keys = key === undefined || key === null ? Object.keys(this.store) : Array.isArray(key) ? key : [key];
    for (const k of keys) if (k in this.store) out[k] = serialize(this.store[k]);
    return out;
  }

  async set(items: StorageRecord): Promise<void> {
    for (const [k, v] of Object.entries(items)) this.store[k] = serialize(v);
  }

  async remove(key: string | string[]): Promise<void> {
    const keys = Array.isArray(key) ? key : [key];
    for (const k of keys) delete this.store[k];
  }

  async clear(): Promise<void> {
    this.store = {};
  }

  /** test-only */
  __dump(): StorageRecord {
    return serialize(this.store);
  }
  /** test-only */
  __reset(): void {
    this.store = {};
  }
}

/** Only the bits of chrome.tabs.Tab / OnUpdatedInfo the code under test reads. */
export interface FakeTab {
  id?: number;
  url?: string;
}
type FakeOnUpdatedInfo = { status?: string; url?: string };
type FakeOnUpdatedListener = (tabId: number, changeInfo: FakeOnUpdatedInfo, tab: FakeTab) => void;

class FakeTabsApi {
  /** test-only: what `query` resolves to. */
  __queryResult: FakeTab[] = [];
  /** test-only: every `update` call, in order. */
  __updates: Array<{ tabId: number; properties: Record<string, unknown> }> = [];
  /** test-only: when set, `update` rejects with it (e.g. the tab was closed). */
  __updateError: unknown = undefined;

  onUpdated = {
    __listeners: [] as FakeOnUpdatedListener[],
    addListener(fn: FakeOnUpdatedListener) {
      this.__listeners.push(fn);
    },
    removeListener(fn: FakeOnUpdatedListener) {
      const index = this.__listeners.indexOf(fn);
      if (index !== -1) this.__listeners.splice(index, 1);
    },
  };

  query = async (): Promise<FakeTab[]> => this.__queryResult;

  update = async (tabId: number, properties: Record<string, unknown>): Promise<FakeTab> => {
    this.__updates.push({ tabId, properties });
    if (this.__updateError) throw this.__updateError;
    return { id: tabId, ...properties } as FakeTab;
  };

  /** test-only: fire a chrome.tabs.onUpdated event at the registered listeners. */
  __emitUpdated(tabId: number, changeInfo: FakeOnUpdatedInfo, tab: FakeTab): void {
    for (const listener of [...this.onUpdated.__listeners]) listener(tabId, changeInfo, tab);
  }

  /** test-only */
  __reset(): void {
    this.__queryResult = [];
    this.__updates.length = 0;
    this.__updateError = undefined;
    this.onUpdated.__listeners.length = 0;
  }
}

function notImplemented(name: string): never {
  throw new Error(`chrome fake: ${name} is not implemented`);
}

/**
 * Wraps an object so that reading a member we do not stub throws instead of yielding
 * `undefined`. Applied to `chrome` itself *and* to `chrome.storage` / `chrome.runtime`,
 * so `chrome.storage.sync` and `chrome.runtime.getURL` are as loud as `chrome.tabs`.
 *
 * `prop` can be a symbol (Node's inspector, `await`, …), which is why the message is
 * built with `String(prop)` — a template literal would throw
 * "Cannot convert a Symbol value to a string" and hide the real problem.
 */
function guard<T extends object>(target: T, path: string): T {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      if (prop in obj) return Reflect.get(obj, prop, receiver);
      return notImplemented(`${path}.${String(prop)}`);
    },
  });
}

export interface ChromeFake {
  storage: { local: FakeLocalStorageArea };
  tabs: FakeTabsApi;
  runtime: {
    onMessage: { addListener: (fn: unknown) => void; __listeners: unknown[] };
    sendMessage: (...args: unknown[]) => void;
    getURL: (path: string) => string;
    lastError?: unknown;
  };
}

let current: ChromeFake | undefined;

export function installChromeFake(): ChromeFake {
  const fake: ChromeFake = {
    storage: { local: new FakeLocalStorageArea() },
    tabs: new FakeTabsApi(),
    runtime: {
      onMessage: {
        __listeners: [],
        addListener(fn: unknown) {
          this.__listeners.push(fn);
        },
      },
      sendMessage: () => {
        /* no-op in tests; assert on the fake separately if needed */
      },
      // Mirrors chrome.runtime.getURL: turns a packaged asset path into an
      // absolute extension URL. Deterministic so tests can assert on it.
      getURL: (path: string) => `chrome-extension://fake-extension-id/${path}`,
      // Explicitly present so the guard lets it through: real code reads
      // chrome.runtime.lastError to *check* for an error, and it is undefined
      // whenever there is none.
      lastError: undefined,
    },
  };
  // anything not implemented → throw, at every level we stub (chrome.sidePanel,
  // chrome.storage.sync and chrome.runtime.connect all have to be loud).
  fake.storage = guard(fake.storage, "chrome.storage");
  fake.runtime = guard(fake.runtime, "chrome.runtime");
  current = guard(fake, "chrome");
  (globalThis as Record<string, unknown>).chrome = current;
  return current;
}

export function resetChromeFake(): void {
  if (!current) {
    installChromeFake();
    return;
  }
  current.storage.local.__reset();
  // Tests may delete chrome.tabs (to simulate a missing API, e.g. the standalone
  // Vite dev server) or replace it with a plain per-test stub. Put a fresh fake
  // back instead of tripping the throw-loudly guard or calling __reset() on a
  // foreign object.
  const tabs = "tabs" in (current as object) ? current.tabs : undefined;
  if (tabs instanceof FakeTabsApi) {
    tabs.__reset();
  } else {
    current.tabs = new FakeTabsApi();
  }
  current.runtime.onMessage.__listeners.length = 0;
}

export function getChromeFake(): ChromeFake {
  if (!current) return installChromeFake();
  return current;
}
