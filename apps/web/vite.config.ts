import { fileURLToPath, URL } from 'node:url';
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
      // Web Push needs `push`/`notificationclick` handlers, which `generateSW` cannot
      // emit — the worker is hand-written in src/sw.ts and workbox only injects the
      // precache manifest into it.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
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
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
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
  // Mirrors `paths` in tsconfig.app.json and `moduleNameMapper` in jest.config.cjs.
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // @pt/shared is a workspace package compiled to CommonJS; pre-bundle it explicitly.
  // Editing a shared schema needs a vite restart — the pre-bundle is not re-run on
  // changes to its `dist`.
  optimizeDeps: { include: ['@pt/shared'] },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // `@pt/shared` resolves through a workspace symlink, so it misses the default
    // `/node_modules/` filter and rollup would parse its CommonJS `dist` as ESM —
    // "loginSchema is not exported by ...". Dev never hits this: `optimizeDeps` above
    // pre-bundles the same package with esbuild instead.
    commonjsOptions: { include: [/node_modules/, /packages\/shared/] },
  },
});
