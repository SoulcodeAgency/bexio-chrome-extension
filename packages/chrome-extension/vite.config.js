import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./public/manifest.json";

export default ({ mode }) => {
  return defineConfig({
    build: {
      assetsDir: "", // otherwise the scripts will be placed into the named assetsDir folder
      rollupOptions: {
        // input: {
        //   bexioTimetrackingTemplates:
        //     "./src/apps/bexioTimetrackingTemplates/index.ts",
        //   bexioProjectList: "./src/apps/bexioProjectList/index.ts",
        // },
        output: {
          dir: "../../unpacked",
          // assetFileNames: "[name]",
          chunkFileNames: "[name].js",
          entryFileNames: "[name].js", // Removes the hash of the entry file
          // assetFileNames: "[name].[format]",
          // chunkFileNames: "[name].[format]",
          // entryFileNames: "[name].[format]", // Removes the hash of the entry file
        },
      },
      exclude: [/\.html$/],
      outDir: "../../unpacked",
      emptyOutDir: true,
      minify: true, // mode === "production",
    },
    plugins: [crx({ manifest })],
  });
};
