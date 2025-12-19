import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      // Proxy AI requests to the local AI service so the browser never sees API keys.
      proxy: {
        '/api': {
          target: 'http://localhost:8787',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    plugins: [react()],
    // IMPORTANT: do NOT inject secrets into the client bundle via `define`.
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
