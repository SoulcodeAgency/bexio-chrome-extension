import { defineConfig } from "vitest/config";

// Root defaults shared by all workspace projects.
export default defineConfig({
  test: {
    // Each project sets its own environment; node is a safe default.
    environment: "node",
    // The build smoke test shells out to Vite and is slow; `test:fast` excludes it.
    // (Default `test` includes it.)
    reporters: ["default"],
    clearMocks: true,
    restoreMocks: true,
  },
});
