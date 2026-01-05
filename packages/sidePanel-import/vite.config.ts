import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default ({ mode }) => {
  return defineConfig({
    plugins: [react()],
    base: "/sidePanel-import/",
    resolve: {
      alias: {
        "~": path.resolve(__dirname, "src"),
        react: path.resolve(__dirname, "../../node_modules/react"),
        "react-dom": path.resolve(__dirname, "../../node_modules/react-dom"),
      },
      dedupe: ["react", "react-dom"],
    },
    build: {
      outDir: "../../unpacked/sidePanel-import",
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
      },
      minify: mode === "production",
    },
    server: {
      fs: {
        strict: false,
        allow: [path.resolve(__dirname, "../shared")],
      },
    },
  });
};
