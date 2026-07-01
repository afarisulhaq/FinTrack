/**
 * PWA Push Notification helpers.
 *
 * Handles service-worker registration, permission requests, and
 * push subscription management. The subscription endpoint + keys
 * are sent to the backend so the server can push notifications.
 */

import { getApiBaseUrl } from "./api";

// ── Service Worker Registration ─────────────────────────────────────────────

let swRegistration: ServiceWorkerRegistration | null = null;

/** Register the service worker. Call once on app boot. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    swRegistration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    console.log("[SW] Registered:", swRegistration.scope);
    return swRegistration;
  } catch (err) {
    console.warn("[SW] Registration failed:", err);
    return null;
  }
}

/** Get the current SW registration (lazy register if needed). */
async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (swRegistration) return swRegistration;
  return registerServiceWorker();
}

// ── Permission ──────────────────────────────────────────────────────────────

export type PushPermissionState =
  | "granted"
  | "denied"
  | "default"
  | "unsupported";

/** Check the current push notification permission state. */
export function getPushPermission(): PushPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission as PushPermissionState;
}

/** Request notification permission from the user. */
export async function requestPushPermission(): Promise<PushPermissionState> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  const result = await Notification.requestPermission();
  return result as PushPermissionState;
}

// ── Push Subscription ───────────────────────────────────────────────────────

/**
 * Subscribe to push notifications and send the subscription to the backend.
 * Returns `true` on success, `false` on failure.
 *
 * The VAPID public key is fetched from the backend so it doesn't need to
 * be baked into the client build.
 */
export async function subscribeToPush(token: string): Promise<boolean> {
  try {
    const reg = await getRegistration();
    if (!reg) return false;

    // Check if already subscribed
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      // Send existing subscription to backend (in case it wasn't saved)
      await saveSubscription(existing, token);
      return true;
    }

    // Get VAPID public key from backend
    const vapidKey = await fetchVapidKey();
    if (!vapidKey) {
      console.warn("[Push] No VAPID key from server — push not configured");
      return false;
    }

    // Subscribe
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey)
        .buffer as ArrayBuffer,
    });

    // Save to backend
    await saveSubscription(subscription, token);
    return true;
  } catch (err) {
    console.warn("[Push] Subscribe failed:", err);
    return false;
  }
}

/** Unsubscribe from push notifications. */
export async function unsubscribeFromPush(token: string): Promise<boolean> {
  try {
    const reg = await getRegistration();
    if (!reg) return false;

    const subscription = await reg.pushManager.getSubscription();
    if (!subscription) return true; // already unsubscribed

    await subscription.unsubscribe();

    // Notify backend
    await fetch(`${getApiBaseUrl()}/user/push-subscription`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
      }),
    });

    return true;
  } catch (err) {
    console.warn("[Push] Unsubscribe failed:", err);
    return false;
  }
}

/** Check if push is currently subscribed. */
export async function isPushSubscribed(): Promise<boolean> {
  try {
    const reg = await getRegistration();
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

// ── Internal helpers ────────────────────────────────────────────────────────

async function fetchVapidKey(): Promise<string | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/push/vapid-key`);
    const json = await res.json();
    return json.data?.vapidPublicKey ?? null;
  } catch {
    return null;
  }
}

async function saveSubscription(
  subscription: PushSubscription,
  token: string,
): Promise<void> {
  await fetch(`${getApiBaseUrl()}/user/push-subscription`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(subscription.toJSON()),
  });
}

/** Convert a URL-safe base64 string to a Uint8Array (for applicationServerKey). */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
