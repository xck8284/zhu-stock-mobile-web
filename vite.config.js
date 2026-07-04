import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/twse-api': {
        target: 'https://www.twse.com.tw',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/twse-api/, ''),
      },
    },
  },
})
