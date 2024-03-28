import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./public/manifest.json";

export default ({ mode }) => {
  return defineConfig({
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
