import { App, message as staticMessage } from "antd";

/**
 * The toast methods this app actually uses. Narrower than antd's full `MessageInstance` on
 * purpose, so both the context instance and the static API satisfy it.
 */
export type MessageApi = Pick<ReturnType<typeof App.useApp>["message"], "error" | "warning" | "success">;

let contextMessage: MessageApi | undefined;

/**
 * Publishes the `App`-context message instance for non-component callers. Called by
 * `MessageApiBridge`, which is the only place that can run the `App.useApp()` hook.
 */
export function setMessageApi(instance: MessageApi | undefined): void {
  contextMessage = instance;
}

/**
 * The instance toasts should go through.
 *
 * antd's static `message.*` renders into its own React root, so it cannot see our
 * `ConfigProvider` theme — antd warns about exactly that ("Static function can not consume
 * context like dynamic theme"). The context instance from `<App>` can.
 *
 * The static API stays as the fallback rather than dropping the toast: a message fired before
 * the bridge has mounted is still worth showing, badly themed, over not showing at all.
 */
export function getMessageApi(): MessageApi {
  return contextMessage ?? staticMessage;
}

export default getMessageApi;
