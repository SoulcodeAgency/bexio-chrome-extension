import { defineConfig } from "vite";

export default ({ mode }) => {
  return defineConfig({
    build: {
      assetsDir: "", // otherwise the scripts will be placed into the named assetsDir folder
      rollupOptions: {
        input: {
          bexioTimetrackingTemplates:
            "./src/apps/bexioTimetrackingTemplates/index.ts",
          bexioProjectList: "./src/apps/bexioProjectList/index.ts",
        },
        output: {
          dir: "../../unpacked",
          assetFileNames: "[name].[ext]",
          chunkFileNames: "[name].[ext]",
          entryFileNames: "[name].js", // Removes the hash of the entry file
        },
      },
      exclude: [/\.html$/],
      outDir: "../../unpacked",
      emptyOutDir: false,
      minify: mode === "production",
    },
  });
};
