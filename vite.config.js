import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import crawlable from './vite-plugin-crawlable.js';
import imageRatios from './vite-plugin-image-ratios.js';
import youtubeMeta from './vite-plugin-youtube-meta.js';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), crawlable(), youtubeMeta(), imageRatios()],
  assetsInclude: ['**/*.glb'],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
