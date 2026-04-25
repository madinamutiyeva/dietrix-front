import { getAccessToken } from '../api/client';
import type { NotificationDto } from '../api/contracts';

/** Same logic as in api/client.ts — kept local to avoid HMR/init-order issues. */
const API_ORIGIN = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export type SseHandlers = {
  onConnected?: () => void;
  onNotification?: (n: NotificationDto) => void;
  onError?: (e: Event) => void;
};

/**
 * Open an SSE stream to /api/notifications/stream.
 * Returns the EventSource (call `.close()` on logout).
 *
 * Token is passed in query because EventSource cannot set headers.
 * Backend JWT filter accepts `?token=` only for this endpoint.
 */
export function connectNotifications(handlers: SseHandlers = {}): EventSource | null {
  const token = getAccessToken();
  if (!token) return null;

  const url = `${API_ORIGIN}/api/notifications/stream?token=${encodeURIComponent(token)}`;
  const es = new EventSource(url);

  es.addEventListener('connected', () => {
    // eslint-disable-next-line no-console
    console.log('✅ SSE connected');
    handlers.onConnected?.();
  });

  es.addEventListener('notification', (e: MessageEvent) => {
    try {
      const n: NotificationDto = JSON.parse(e.data);
      // eslint-disable-next-line no-console
      console.log('🔔 notification', n);
      handlers.onNotification?.(n);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('SSE: bad notification payload', err, e.data);
    }
  });

  // Catch-all for events the backend might emit without an `event:` tag
  // (heartbeats, keepalives, etc.). We log but do NOT treat them as
  // notifications, so no phantom toasts appear.
  es.onmessage = (e) => {
    // eslint-disable-next-line no-console
    console.debug('SSE default message (ignored):', e.data);
  };

  es.onerror = (e) => {
    // EventSource auto-reconnects after ~3s.
    // eslint-disable-next-line no-console
    console.warn('SSE disconnected, browser will auto-reconnect');
    handlers.onError?.(e);
  };

  return es;
}

