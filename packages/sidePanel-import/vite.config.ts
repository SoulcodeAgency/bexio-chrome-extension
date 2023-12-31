import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path';

// https://vitejs.dev/config/
export default ({ mode }) => {
  return defineConfig({

    plugins: [react()],
    base: "/sidePanel-import/",
    resolve: {
      alias: {
        '~': path.resolve(__dirname, 'src'),
      }
    },
    build: {
      outDir: '../../unpacked/sidePanel-import',
      emptyOutDir: true,
      rollupOptions: {
        external: ["../shared/chromeStorageTemplateEntries", "../shared/chromeStorage"],
      },
      minify: mode === 'production',
    },
    server: {
      fs: {
        strict: false,
        allow: [path.resolve(__dirname, '../shared')]
      }
    },
  })
}