/**
 * Whether this content script still belongs to a loaded extension.
 *
 * Reloading, updating or removing the extension does not remove its content scripts from open tabs:
 * they keep running, observers included, but every `chrome.*` call throws "Extension context
 * invalidated" until the page is reloaded. The new time tracking pages (#168) are a single-page app
 * whose body observers fire on nearly every mutation, so an orphaned script filled the extension's
 * error list. `chrome.runtime.id` is `undefined` in such a script; callers check this and stop.
 */
export function isExtensionContextValid(): boolean {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}
