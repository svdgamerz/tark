import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import os from 'os'
import path from 'path'

const tempCache = path.join(os.tmpdir(), 'tark_vite_cache')

export default defineConfig({
  plugins: [react()],
  cacheDir: tempCache,
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/simulations': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    emptyOutDir: false,
  },
})
