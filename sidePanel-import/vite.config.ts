import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path';
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/sidePanel-import/",
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    outDir: '../unpacked/sidePanel-import',
    emptyOutDir: true,
    rollupOptions: {
      external: ["@shared/chromeStorageTemplateEntries", "@shared/chromeStorage"]
    }
  },
  server: {
    fs: {
      strict: false,
      allow: [path.resolve(__dirname, '../shared')]
    }
  },
})
