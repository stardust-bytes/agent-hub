import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 171305,
    proxy: {
      '/api': 'http://localhost:130596',
      '/socket.io': { target: 'http://localhost:130596', ws: true },
    },
  },
})
