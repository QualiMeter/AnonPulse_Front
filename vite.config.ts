import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'https://anonpulsebeckend-production.up.railway.app',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
