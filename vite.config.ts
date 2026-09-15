import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages: https://ayumu-aa.github.io/oyako-game/
export default defineConfig({
  plugins: [react()],
  base: '/oyako-game/',
  build: { chunkSizeWarningLimit: 2000 },
});
