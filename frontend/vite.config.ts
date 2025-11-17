import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3002,
    host: true,
    allowedHosts: ['streamlick.com', 'www.streamlick.com'],
  },
  preview: {
    port: 3002,
    host: true,
    allowedHosts: ['streamlick.com', 'www.streamlick.com'],
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
