// Minimal in-memory stand-ins for the chrome.* APIs the extension touches in
// code that we unit-test. Anything not implemented here throws loudly so we
// notice when a test reaches for something new.

type StorageRecord = Record<string, unknown>;

class FakeLocalStorageArea {
  private store: StorageRecord = {};

  async get(key?: string | string[] | null): Promise<StorageRecord> {
    if (key === undefined || key === null) return { ...this.store };
    const keys = Array.isArray(key) ? key : [key];
    const out: StorageRecord = {};
    for (const k of keys) if (k in this.store) out[k] = this.store[k];
    return out;
  }

  async set(items: StorageRecord): Promise<void> {
    Object.assign(this.store, items);
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
    return { ...this.store };
  }
  /** test-only */
  __reset(): void {
    this.store = {};
  }
}

function notImplemented(name: string): never {
  throw new Error(`chrome fake: ${name} is not implemented`);
}

export interface ChromeFake {
  storage: { local: FakeLocalStorageArea };
  runtime: {
    onMessage: { addListener: (fn: unknown) => void; __listeners: unknown[] };
    sendMessage: (...args: unknown[]) => void;
    lastError?: unknown;
  };
}

let current: ChromeFake | undefined;

export function installChromeFake(): ChromeFake {
  const fake: ChromeFake = {
    storage: { local: new FakeLocalStorageArea() },
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
    },
  };
  // anything else → throw
  const guarded = new Proxy(fake, {
    get(target, prop: string) {
      if (prop in target) return (target as Record<string, unknown>)[prop];
      return notImplemented(`chrome.${prop}`);
    },
  });
  current = guarded as ChromeFake;
  (globalThis as Record<string, unknown>).chrome = current;
  return current;
}

export function resetChromeFake(): void {
  if (!current) {
    installChromeFake();
    return;
  }
  current.storage.local.__reset();
  current.runtime.onMessage.__listeners.length = 0;
}

export function getChromeFake(): ChromeFake {
  if (!current) return installChromeFake();
  return current;
}
