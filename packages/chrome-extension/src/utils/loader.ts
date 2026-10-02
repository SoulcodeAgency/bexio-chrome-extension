import { getLoader } from "../selectors/selectors";

// Fix typescript error, for startViewTransition API
interface CustomDocument extends Document {
  startViewTransition: (callback: () => void) => ViewTransition;
}

export function swapDisplayStyle(show = true) {
  // `!` rather than a guard: the loader is injected by renderHtml before this ever
  // runs, and a missing loader should keep throwing here rather than silently no-op.
  const loader = getLoader()!;
  loader.style.display = show ? "flex" : "none";
}

export function toggleDisplayLoader(show = true) {
  // Fallback for browsers that don't support this API:
  if (!(document as CustomDocument).startViewTransition) {
    swapDisplayStyle(show);
    return;
  }
  // With a transition:
  (document as CustomDocument).startViewTransition(() => swapDisplayStyle(show));
}

/**
 * How long a fill of bexio's new time entry dialog (#168) runs before the loader shows. A fill
 * there usually takes well under a second (measured live: 0.4–3s), and a full-page overlay with a
 * view transition flashing up for each one is only noise; it is for the slow cases.
 */
export const DIALOG_LOADER_DELAY_MS = 800;

/**
 * Shows the loader once `delayMs` have passed — without a view transition, and only if the loader
 * is still in the page then. Returns the function that cancels a pending show or hides the loader
 * again.
 */
export function showLoaderAfter(delayMs: number): () => void {
  let shown = false;
  const timer = setTimeout(() => {
    if (!getLoader()) return;
    swapDisplayStyle(true);
    shown = true;
  }, delayMs);
  return () => {
    clearTimeout(timer);
    if (shown && getLoader()) swapDisplayStyle(false);
  };
}
