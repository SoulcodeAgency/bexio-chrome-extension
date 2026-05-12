import { defineWorkspace } from "vitest/config";
import path from "node:path";

export default defineWorkspace([
  {
    extends: "./vitest.config.ts",
    resolve: {
      alias: {
        "@bexio-chrome-extension/shared": path.resolve(__dirname, "packages/shared/index.ts"),
        "@bexio-chrome-extension/chrome-extension": path.resolve(__dirname, "packages/chrome-extension"),
      },
    },
    test: {
      name: "shared",
      root: "./packages/shared",
      environment: "node",
      include: ["test/**/*.test.ts"],
      setupFiles: [path.resolve(__dirname, "test/support/setup-chrome.ts")],
    },
  },
  {
    extends: "./vitest.config.ts",
    resolve: {
      alias: {
        "@bexio-chrome-extension/shared": path.resolve(__dirname, "packages/shared/index.ts"),
        "@bexio-chrome-extension/chrome-extension": path.resolve(__dirname, "packages/chrome-extension"),
      },
    },
    test: {
      name: "chrome-extension",
      root: "./packages/chrome-extension",
      environment: "jsdom",
      include: ["test/**/*.test.ts", "test/**/*.slow.test.ts"],
      setupFiles: [path.resolve(__dirname, "test/support/setup-chrome.ts")],
    },
  },
  {
    extends: "./vitest.config.ts",
    test: {
      name: "sidePanel-import",
      root: "./packages/sidePanel-import",
      environment: "node",
      // Nothing tested here this round; left configured for the future.
      include: ["test/**/*.test.ts"],
    },
  },
]);
