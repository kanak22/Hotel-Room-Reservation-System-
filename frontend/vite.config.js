import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://hotel-room-reservation-system-ce0m.onrender.com',
        changeOrigin: true,
        secure: true,
      }
    }
  }
})
