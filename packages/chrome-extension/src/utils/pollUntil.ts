/**
 * Shared polling primitive behind the four `waitFor*` helpers.
 *
 * Bexio's form widgets (select2, jQuery-UI autocomplete) update the DOM
 * asynchronously, so the only way to know a step finished is to look at the DOM
 * again a moment later. Every such poll loop needs the same two things: an
 * interval and — crucially — a deadline. Without a deadline a single failed
 * bexio AJAX call, an offline browser or a renamed CSS class leaves `fillForm`
 * awaiting a promise that never settles, and the full-viewport loader overlay
 * stays on screen until the user reloads the page (#83).
 */

/**
 * Milliseconds between two poll attempts.
 *
 * The checks are plain DOM reads (`querySelector` / `getComputedStyle`), so
 * polling four times a second is cheap. It also matters for perceived speed:
 * `fillForm` runs ~15 of these waits in sequence, so every 1000 ms of polling
 * latency that is not needed is up to 15 s of staring at the loader.
 * The first check always runs synchronously, so this only affects retries.
 */
export const POLL_INTERVAL_MS = 250;

/**
 * Milliseconds a single `waitFor*` may spend before it gives up and rejects.
 *
 * Generous on purpose: it must cover bexio's slowest select2 AJAX load on a
 * large account plus a bad mobile connection, because a false timeout aborts a
 * fill that would have succeeded. It is a per-wait budget, not a budget for the
 * whole `fillForm` run.
 */
export const POLL_TIMEOUT_MS = 20_000;

/** Thrown by {@link pollUntil} (and therefore by every `waitFor*`) on deadline. */
export class WaitForTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(label: string, timeoutMs: number) {
    super(`Timed out after ${timeoutMs}ms while waiting for ${label}.`);
    this.name = "WaitForTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Polls `check` until it returns a truthy value, then resolves with it.
 *
 * The first check runs synchronously; every further attempt is scheduled
 * `intervalMs` later. Once `timeoutMs` has elapsed the promise rejects with a
 * {@link WaitForTimeoutError} naming `label`, so the caller (`fillForm`) can
 * hide the loader and tell the user instead of hanging forever.
 *
 * @param label      Human-readable description of the awaited condition; it ends
 *                   up in the error message, so write it as "the … to appear".
 * @param check      Returns a truthy value once the condition holds.
 * @param intervalMs Milliseconds between attempts (default {@link POLL_INTERVAL_MS}).
 * @param timeoutMs  Overall deadline in milliseconds (default {@link POLL_TIMEOUT_MS}).
 */
function pollUntil<T>(
  label: string,
  check: () => T | null | undefined | false,
  intervalMs = POLL_INTERVAL_MS,
  timeoutMs = POLL_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const poll = () => {
      const result = check();
      if (result) {
        resolve(result);
      } else if (Date.now() >= deadline) {
        reject(new WaitForTimeoutError(label, timeoutMs));
      } else {
        setTimeout(poll, intervalMs);
      }
    };
    poll();
  });
}

export default pollUntil;
