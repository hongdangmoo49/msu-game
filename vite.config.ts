import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  preview: {
    port: 4173,
    strictPort: true
  },
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
    sourcemap: true
  }
});
