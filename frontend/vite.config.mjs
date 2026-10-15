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
      '/chat': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/models': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/health': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/ping': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/curriculum': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/schools': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/auth': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/chats': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/learner': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/simulations': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
  build: {
    emptyOutDir: false,
  },
})
