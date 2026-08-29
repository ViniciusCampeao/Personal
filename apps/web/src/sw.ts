/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope;

/** `registerType: 'autoUpdate'` — a new deploy takes over open tabs on next load. */
self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// SPA fallback: any navigation not aimed at the API lands on the precached shell.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api\//, /^\/health/],
  }),
);

/**
 * Exercise videos/thumbnails come through short-lived presigned URLs, so the same file
 * arrives under an ever-changing query string. The signature is dropped from the cache
 * key — media objects are immutable per path — otherwise CacheFirst would never hit.
 */
const stripSignature = {
  cacheKeyWillBeUsed: async ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    url.search = '';
    return url.href;
  },
};

registerRoute(
  ({ request, url }) =>
    (request.destination === 'video' || request.destination === 'image') &&
    !url.pathname.startsWith('/api/'),
  new CacheFirst({
    cacheName: 'media',
    plugins: [
      stripSignature,
      new ExpirationPlugin({
        maxEntries: 120,
        maxAgeSeconds: 30 * 24 * 60 * 60,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

/**
 * API reads: fresh when online, last-known-good when not. Auth is excluded — a stale
 * refresh response would be worse than an honest failure — and only GET is cached.
 * Writes made offline go through the Dexie outbox, never through the SW.
 */
registerRoute(
  ({ request, url }) =>
    request.method === 'GET' &&
    url.pathname.startsWith('/api/v1/') &&
    !url.pathname.startsWith('/api/v1/auth'),
  new NetworkFirst({
    cacheName: 'api',
    networkTimeoutSeconds: 4,
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 })],
  }),
);

interface PushPayload {
  title?: string;
  body?: string;
  data?: { url?: string };
}

self.addEventListener('push', (event) => {
  let payload: PushPayload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    // A malformed payload still deserves a notification — permission was granted.
  }
  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Treino', {
      body: payload.body ?? '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: payload.data ?? {},
      lang: 'pt-BR',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data as { url?: string } | undefined)?.url ?? '/';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find(
        (client) => new URL(client.url).origin === self.location.origin,
      );
      if (existing) {
        await existing.focus();
        if ('navigate' in existing) await existing.navigate(target);
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
