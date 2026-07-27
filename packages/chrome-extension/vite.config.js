import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import { basename, dirname } from "node:path";
import manifest from "./public/manifest.json";

// Rolldown (Vite 8) derives emitFile refIds from the chunk `name` alone, so the two
// content scripts — both emitted by @crxjs/vite-plugin as name "index.ts" — collide
// and one of them never gets a fileName ("Content script fileName is undefined").
// Until crxjs emits unique names under Rolldown, rewrite colliding "index.*" chunk
// names to the entry's parent directory name (e.g. "bexioTimetrackingTemplates").
function withUniqueChunkNames(plugins) {
  for (const plugin of plugins.flat(Infinity)) {
    if (plugin?.name === "crx:manifest-post" && typeof plugin.transform === "function") {
      const originalTransform = plugin.transform;
      plugin.transform = function (...args) {
        const context = new Proxy(this, {
          get(target, prop) {
            if (prop === "emitFile") {
              return (file) => {
                if (file?.type === "chunk" && file.id && /^index\./.test(file.name ?? "")) {
                  return target.emitFile({ ...file, name: basename(dirname(file.id)) });
                }
                return target.emitFile(file);
              };
            }
            const value = target[prop];
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
        return originalTransform.apply(context, args);
      };
    }
  }
  return plugins;
}

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
    plugins: [withUniqueChunkNames(crx({ manifest }))],
  });
};
