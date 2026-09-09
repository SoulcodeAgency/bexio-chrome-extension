/**
 * Routing antd toasts through the `App` context instead of the static `message` API.
 *
 * antd warns: "Static function can not consume context like dynamic theme. Please use 'App'
 * component instead." — the static `message.error()` renders into its own React root, so it never
 * sees our `ConfigProvider` theme and shows up light-themed in a dark panel.
 *
 * `App.useApp()` is a hook, but `sendToBexioTab.ts` is not a component, so the instance is handed
 * to a module-level holder by a bridge component — the pattern antd documents for exactly this
 * case. The holder falls back to the static API, which keeps a toast visible if it fires before
 * the bridge has mounted rather than swallowing it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App as AntdApp, message as staticMessage } from "antd";
import MessageApiBridge from "~/components/MessageApiBridge";
import { getMessageApi } from "~/utils/messageApi";

/**
 * antd's static message renders into the document; stub it and start each test from a clean call
 * history — `vi.spyOn` on an already-spied method hands back the existing mock, calls included.
 */
let staticSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  staticSpy = vi.spyOn(staticMessage, "error").mockImplementation((() => {}) as never);
  staticSpy.mockClear();
});

afterEach(() => {
  cleanup();
});

/** Fires a toast the same way production code does. */
function Probe() {
  return <button onClick={() => getMessageApi().error("boom")}>fire</button>;
}

describe("getMessageApi", () => {
  it("falls back to the static API when no bridge is mounted", () => {
    getMessageApi().error("boom");

    expect(staticSpy).toHaveBeenCalledWith("boom");
  });

  it("routes through the App context once the bridge is mounted", async () => {
    render(
      <AntdApp>
        <MessageApiBridge />
        <Probe />
      </AntdApp>,
    );
    // Let the bridge's effect publish the context instance.
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "fire" }));
    });

    // The whole point: the context instance handled it, not the context-less static one.
    expect(staticSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("boom")).toBeTruthy());
  });

  it("releases the context instance when the bridge unmounts", async () => {
    const { unmount } = render(
      <AntdApp>
        <MessageApiBridge />
      </AntdApp>,
    );
    await act(async () => {});
    unmount();

    // A stale instance from an unmounted root would render its toast into nothing.
    getMessageApi().error("boom");
    expect(staticSpy).toHaveBeenCalledWith("boom");
  });
});
