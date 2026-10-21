import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// CI sets VITE_BASE=/weather-aware-truck-routing/ for GitHub Pages.
const base = process.env.VITE_BASE || '/'

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
    },
  },
})
