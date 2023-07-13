import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/sidePanel-import/",
  build: {
    outDir: '../unpacked/sidePanel-import',
  },
  server: {
    fs: {
      strict: false,
      allow: [path.resolve(__dirname, '../shared')]
    }
  },
})
