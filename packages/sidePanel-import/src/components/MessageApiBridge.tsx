import { useEffect } from "react";
import { App } from "antd";
import { setMessageApi } from "~/utils/messageApi";

/**
 * Hands the `App`-context message instance to `~/utils/messageApi`, so code that is not a React
 * component (`sendToBexioTab.ts`) can toast through the themed instance instead of antd's static
 * one. This is the bridge antd documents for the case; it renders nothing.
 *
 * Must be rendered inside `<App>`.
 */
function MessageApiBridge() {
  const { message } = App.useApp();

  useEffect(() => {
    setMessageApi(message);
    // Releasing on unmount matters: the instance belongs to this `App`'s React root, and a stale
    // one would render its toast into a tree that is gone.
    return () => setMessageApi(undefined);
  }, [message]);

  return null;
}

export default MessageApiBridge;
