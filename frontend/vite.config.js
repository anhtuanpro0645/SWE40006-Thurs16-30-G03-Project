import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// In development (npm run dev) Vite proxies API calls to Express on port 3000,
// the same routes Nginx forwards in the Docker image.
const apiTarget = process.env.API_URL || 'http://localhost:3000';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': apiTarget,
      '/health': apiTarget,
    },
  },
});
