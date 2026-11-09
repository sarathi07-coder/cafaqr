import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Code-splitting: separate vendor chunks so browser caches them independently
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-socket': ['socket.io-client'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
    // Inline small assets for fewer HTTP requests
    assetsInlineLimit: 8192,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        xfwd: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        xfwd: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:3000',
        ws: true,
        xfwd: true,
      },
    },
  },
});
