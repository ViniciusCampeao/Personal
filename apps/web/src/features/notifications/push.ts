import type { PushSubscribeInput } from '@pt/shared';
import { apiFetch } from '@/lib/api';

export function fetchVapidPublicKey(): Promise<{ publicKey: string }> {
  return apiFetch<{ publicKey: string }>('/push/vapid-public-key');
}

export function registerPushSubscription(input: PushSubscribeInput): Promise<void> {
  return apiFetch<void>('/push/subscribe', { method: 'POST', body: JSON.stringify(input) });
}

export function removePushSubscription(endpoint: string): Promise<void> {
  return apiFetch<void>('/push/subscribe', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint }),
  });
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** VAPID keys travel base64url; `pushManager.subscribe` wants raw bytes. */
export function vapidKeyToBytes(base64url: string): Uint8Array {
  const padded = base64url + '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function subscribeToPush(): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('permission-denied');

  const registration = await navigator.serviceWorker.ready;
  const { publicKey } = await fetchVapidPublicKey();
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: vapidKeyToBytes(publicKey).buffer as ArrayBuffer,
  });

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    await subscription.unsubscribe();
    throw new Error('subscription-incomplete');
  }
  await registerPushSubscription({
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    userAgent: navigator.userAgent.slice(0, 500),
  });
}

export async function unsubscribeFromPush(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await subscription.unsubscribe();
  // The server copy dies too, or it would keep pushing at a dead endpoint.
  await removePushSubscription(subscription.endpoint);
}
