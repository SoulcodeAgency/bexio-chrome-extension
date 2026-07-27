import { defineConfig } from "vitest/config";
import path from "node:path";

// Subpath aliases for @bexio-chrome-extension/shared/* — must come before the
// bare-package alias so that Vite's prefix-match doesn't swallow them.
const sharedSubpathAliases = [
  {
    find: "@bexio-chrome-extension/shared/chromeStorageTemplateEntries",
    replacement: path.resolve(__dirname, "packages/shared/chromeStorageTemplateEntries.ts"),
  },
  {
    find: "@bexio-chrome-extension/shared/chromeStorageSettings",
    replacement: path.resolve(__dirname, "packages/shared/chromeStorageSettings.ts"),
  },
  {
    find: "@bexio-chrome-extension/shared/chromeStorageImportData",
    replacement: path.resolve(__dirname, "packages/shared/chromeStorageImportData.ts"),
  },
  {
    find: "@bexio-chrome-extension/shared/chromeStorage",
    replacement: path.resolve(__dirname, "packages/shared/chromeStorage.ts"),
  },
  {
    find: "@bexio-chrome-extension/shared/types",
    replacement: path.resolve(__dirname, "packages/shared/types.ts"),
  },
  {
    find: "@bexio-chrome-extension/shared",
    replacement: path.resolve(__dirname, "packages/shared/index.ts"),
  },
  {
    find: "@bexio-chrome-extension/chrome-extension",
    replacement: path.resolve(__dirname, "packages/chrome-extension"),
  },
];

// Root config with all three workspace projects inline (vitest.workspace.ts is
// deprecated since Vitest 3.2; projects live here now).
export default defineConfig({
  test: {
    reporters: ["default"],
    clearMocks: true,
    restoreMocks: true,
    projects: [
      {
        resolve: {
          alias: sharedSubpathAliases,
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
        resolve: {
          alias: sharedSubpathAliases,
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
        test: {
          name: "sidePanel-import",
          root: "./packages/sidePanel-import",
          environment: "node",
          // Nothing tested here this round; left configured for the future.
          include: ["test/**/*.test.ts"],
        },
      },
    ],
  },
});
