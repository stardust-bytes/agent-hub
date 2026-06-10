import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 17135,
    proxy: {
      '/api': 'http://localhost:13596',
      '/socket.io': { target: 'http://localhost:13596', ws: true },
    },
  },
})
