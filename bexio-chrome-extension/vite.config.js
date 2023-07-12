export default {
  build: {
    assetsDir: "public",
    rollupOptions: {
      input: {
        main: "src/bexioTimetrackingTemplates.ts",
      },
    },
    exclude: [/\.html$/],
    outDir: "../package",
    emptyOutDir: true,
  },
};
