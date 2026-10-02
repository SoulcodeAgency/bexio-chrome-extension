import { vi } from "vitest";

/**
 * A stand-in for the browser's `PerformanceObserver` limited to what `bexioRequests.ts` uses:
 * `observe({ type: "resource" })`, `disconnect()` and the callback. Node ships a real
 * `PerformanceObserver` that also accepts "resource", so without this the fill would silently wait
 * for requests no test makes.
 *
 * `finishRequest(url)` delivers a finished request (started "now") to every connected observer.
 */
export function installFakeResourceObserver() {
  const observers = new Set<FakePerformanceObserver>();

  class FakePerformanceObserver {
    constructor(
      private readonly callback: (list: { getEntries: () => { name: string; startTime: number }[] }) => void,
    ) {}
    observe() {
      observers.add(this);
    }
    disconnect() {
      observers.delete(this);
    }
    deliver(entry: { name: string; startTime: number }) {
      this.callback({ getEntries: () => [entry] });
    }
  }

  vi.stubGlobal("PerformanceObserver", FakePerformanceObserver);
  return {
    finishRequest(url: string) {
      const entry = { name: url, startTime: performance.now() };
      for (const observer of observers) observer.deliver(entry);
    },
    get connected() {
      return observers.size;
    },
  };
}

/** No resource observer at all, as in a browser without the API: the fill does not wait. */
export function removeResourceObserver() {
  vi.stubGlobal("PerformanceObserver", undefined);
}
