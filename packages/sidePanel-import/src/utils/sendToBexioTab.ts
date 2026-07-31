import { message } from "antd";
import { ExchangeRequestData, ExchangeResponse } from "@bexio-chrome-extension/shared/types";

/**
 * Single entry point for every side-panel → content-script message.
 *
 * Chrome rejects `chrome.tabs.sendMessage` with "Could not establish connection. Receiving end
 * does not exist." whenever the active tab has no content script. That is a normal situation: the
 * service worker enables the side panel on every `monitoring*` page, but the message listener only
 * exists on `monitoring/edit*`. Instead of letting that become an invisible unhandled rejection,
 * this helper reports it to the user through an antd `message` toast and returns a result the
 * caller can branch on.
 */

export const NO_EXTENSION_APIS_MESSAGE =
  "Chrome extension APIs are unavailable here — open this panel from the bexio extension.";

export const NO_ACTIVE_TAB_MESSAGE = "No active browser tab found. Click into the bexio window and try again.";

export const NO_CONTENT_SCRIPT_MESSAGE = "Open the bexio time-tracking page (monitoring/edit) first, then try again.";

export type SendToBexioTabResult = { ok: true; tabId: number } | { ok: false; error: string };

export type SendToBexioTabOptions = {
  /** Text shown when the active tab has no content script listening. */
  unreachableMessage?: string;
  /** Severity of that text — use "warning" when the user's primary action still succeeded. */
  unreachableLevel?: "error" | "warning";
};

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * `chrome.tabs` is missing when the app runs outside the extension (the standalone Vite dev
 * server) and the test fake throws on unimplemented members, so the lookup itself is guarded.
 */
function getTabsApi(): typeof chrome.tabs | undefined {
  try {
    return typeof chrome !== "undefined" && chrome.tabs ? chrome.tabs : undefined;
  } catch {
    return undefined;
  }
}

function fail(text: string, level: "error" | "warning" = "error"): SendToBexioTabResult {
  console.warn("sendToBexioTab:", text);
  if (level === "warning") {
    message.warning(text);
  } else {
    message.error(text);
  }
  return { ok: false, error: text };
}

export async function sendToBexioTab(
  data: ExchangeRequestData,
  options: SendToBexioTabOptions = {},
): Promise<SendToBexioTabResult> {
  const tabs = getTabsApi();
  if (!tabs) {
    return fail(NO_EXTENSION_APIS_MESSAGE);
  }

  let tab: chrome.tabs.Tab | undefined;
  try {
    [tab] = await tabs.query({ active: true, lastFocusedWindow: true });
  } catch (error) {
    return fail(`${NO_ACTIVE_TAB_MESSAGE} (${describeError(error)})`);
  }

  // `chrome.tabs.query` returns an empty array when no tab is active in the last focused window
  // (e.g. a detached DevTools window has focus), so `tab` can be undefined here.
  if (!tab || typeof tab.id !== "number") {
    return fail(NO_ACTIVE_TAB_MESSAGE);
  }

  let response: ExchangeResponse | undefined;
  try {
    response = (await tabs.sendMessage(tab.id, data)) as ExchangeResponse | undefined;
  } catch (error) {
    console.warn("sendToBexioTab: sendMessage rejected:", describeError(error));
    return fail(options.unreachableMessage ?? NO_CONTENT_SCRIPT_MESSAGE, options.unreachableLevel);
  }

  // Older content scripts answer with undefined; only an explicit failure is reported.
  if (response && response.ok === false) {
    return fail(`The bexio page could not apply the data: ${response.error}`);
  }

  return { ok: true, tabId: tab.id };
}

export default sendToBexioTab;
