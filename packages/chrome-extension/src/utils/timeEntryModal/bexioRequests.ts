/**
 * bexio's own API calls, watched through the Resource Timing API (#168).
 *
 * Picking a Kontakt in the time entry dialog makes bexio load that contact's projects
 * (`/2.0/timesheet/views/contacts/<id>/projects`). Until the answer is there, the Projekt field
 * still offers the list it had before — a dialog opened a second time shows the last contact's
 * projects at once. A project picked from that list is reset when the answer arrives and set again
 * without its work packages being loaded, so Arbeitspakete stays disabled for good (seen live
 * 2026-10-02: contact at 0.2s, project at 0.4s, the answer at 0.5s, the project blank at 0.49s and
 * back at 0.54s, Arbeitspaket disabled until the 20s timeout).
 *
 * Nothing in the DOM says the answer arrived, so the request itself is watched. A
 * `PerformanceObserver` rather than `performance.getEntriesByType`: the resource timing buffer holds
 * 250 entries by default and a long-lived single-page app fills it, after which new requests are no
 * longer listed there — observers still get them.
 */

export const CONTACT_PROJECTS_REQUEST = /\/timesheet\/views\/contacts\/\d+\/projects(?:[?#]|$)/;

export type RequestWatch = {
  /** `false` where the browser offers no resource observer (jsdom): callers then do not wait. */
  available: boolean;
  /** Whether a matching request that started at or after `since` (a `performance.now()`) finished. */
  finishedSince: (since: number) => boolean;
  stop: () => void;
};

/** Records every finished request whose URL matches `pattern` until `stop()` is called. */
export function watchRequests(pattern: RegExp): RequestWatch {
  const startTimes: number[] = [];
  let observer: PerformanceObserver | undefined;
  if (typeof PerformanceObserver !== "undefined") {
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (pattern.test(entry.name)) startTimes.push(entry.startTime);
        }
      });
      observer.observe({ type: "resource" });
    } catch {
      observer = undefined;
    }
  }
  return {
    available: observer !== undefined,
    finishedSince: (since) => startTimes.some((startTime) => startTime >= since),
    stop: () => observer?.disconnect(),
  };
}
