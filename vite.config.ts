import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages: https://ayumu-aa.github.io/oyako-game/
export default defineConfig({
  plugins: [
    react(),
    /* Service Worker は「キャッシュだけ」。manifest を出さないので ホーム画面追加の誘導は 出ない（決定事項） */
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,webp}'],   // build 資産と えいごの絵を 全部 先読み → 機内モードでも 遊べる
        navigateFallback: '/oyako-game/index.html',
        navigateFallbackAllowlist: [/^\/oyako-game\//],
        runtimeCaching: [
          { urlPattern: /^https:\/\/fonts\.googleapis\.com\//, handler: 'StaleWhileRevalidate', options: { cacheName: 'gfonts-css', expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 } } },
          { urlPattern: /^https:\/\/fonts\.gstatic\.com\//, handler: 'CacheFirst', options: { cacheName: 'gfonts-files', expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } } },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  base: '/oyako-game/',
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: { input: { main: 'index.html', board: 'board.html' } },   /* board.html = ブース掲示用 */
  },
});
