import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./public/manifest.json" with { type: "json" };
import { buildDate } from "../../scripts/build-date/buildDate.ts";

export default ({ mode }) => {
  return defineConfig({
    // The "last update" date shown in the Templates block. Stamped here because a build happens
    // on every release path - see scripts/build-date/buildDate.ts.
    define: { __BUILD_DATE__: JSON.stringify(buildDate()) },
    build: {
      assetsDir: "", // otherwise the scripts will be placed into the named assetsDir folder
      rollupOptions: {
        output: {
          dir: "../../unpacked",
          // assetFileNames: "[name]",
          chunkFileNames: "[name].js",
          entryFileNames: "[name].js", // Removes the hash of the entry file
        },
      },
      exclude: [/\.html$/],
      outDir: "../../unpacked",
      emptyOutDir: true,
      minify: mode === "production",
    },
    plugins: [crx({ manifest })],
  });
};
