import { defineConfig } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UNPACKED = path.resolve(__dirname, "../unpacked");

export default defineConfig({
  testDir: __dirname,
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    // Chromium is launched per-test via launchPersistentContext (extensions need a persistent context);
    // we don't use the default `browser` fixture. See extension-smoke.spec.ts.
  },
  metadata: { unpackedPath: UNPACKED },
});
