import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * The app always calls the API on the same origin under `/api`, so no build-time API URL
 * exists: in dev the proxy below forwards it, in production nginx does (see infra/nginx).
 * That also keeps the httpOnly refresh cookie first-party behind the Cloudflare Tunnel.
 */
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Plataforma de Personal Trainer',
        short_name: 'Treino',
        description: 'Treinos, progressão e avaliação física.',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        // The API is never served from the SPA fallback.
        navigateFallbackDenylist: [/^\/api\//, /^\/health/],
        // Runtime caching (videos, thumbs, NetworkFirst API) is wired up in M7.
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
      '/health': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  // @pt/shared is a workspace package compiled to CommonJS; pre-bundle it explicitly.
  optimizeDeps: { include: ['@pt/shared'] },
  build: { outDir: 'dist', sourcemap: true },
});
