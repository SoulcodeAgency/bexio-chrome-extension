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
