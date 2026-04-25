import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { NotificationDto, NotificationType } from '../api/contracts';
import { getAccessToken, getNotifications } from '../api/client';
import { connectNotifications } from './sse';

// ── Types ────────────────────────────────────

type Toast = NotificationDto & { _toastId: number };

interface NotificationsCtx {
  /** All notifications received this session (newest first). */
  items: NotificationDto[];
  /** Number of unread notifications (synced with backend on mount + on each push). */
  unreadCount: number;
  /** Reset unread counter (call when user opens the bell). */
  markAllRead: () => void;
  /** Manually push a notification (mostly for tests). */
  push: (n: NotificationDto) => void;
}

const Ctx = createContext<NotificationsCtx | null>(null);

// ── Helpers ──────────────────────────────────

const ICON_BY_TYPE: Record<NotificationType, string> = {
  MEAL_REMINDER: 'fas fa-utensils',
  PANTRY_EXPIRY: 'fas fa-box-open',
  RECIPE_READY: 'fas fa-bowl-food',
  WEEKLY_REPORT: 'fas fa-chart-line',
  SYSTEM: 'fas fa-bell',
};

// ── Provider ─────────────────────────────────

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const toastIdRef = useRef(0);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t._toastId !== id));
  }, []);

  const showToast = useCallback(
    (n: NotificationDto) => {
      const id = ++toastIdRef.current;
      setToasts((prev) => [...prev, { ...n, _toastId: id }]);
      // auto-dismiss after 5 seconds
      setTimeout(() => removeToast(id), 5000);
    },
    [removeToast],
  );

  const push = useCallback(
    (n: NotificationDto) => {
      // Defensive: drop garbage events (heartbeats, "connected" pings, etc.)
      // that backend may emit on the `notification` channel with an empty body.
      if (!n || (typeof n !== 'object')) return;
      const hasContent = (n.title && n.title.trim()) || (n.message && n.message.trim());
      if (!hasContent) {
        // eslint-disable-next-line no-console
        console.debug('SSE: skipping empty notification', n);
        return;
      }

      setItems((prev) => [n, ...prev]);
      if (!n.read) {
        setUnreadCount((c) => c + 1);
        showToast(n);            // toast only for fresh, unread + non-empty
      }
    },
    [showToast],
  );

  const markAllRead = useCallback(() => setUnreadCount(0), []);

  // Initial unread count from REST + open SSE stream.
  // Re-runs whenever the access token appears/changes, so login → SSE connects.
  const [token, setToken] = useState<string | null>(() => getAccessToken());

  // Watch for token changes. localStorage 'storage' event only fires across tabs,
  // so we also poll inside the current tab. Cheap (string compare every 1s).
  useEffect(() => {
    function sync() {
      const t = getAccessToken();
      setToken((prev) => (prev === t ? prev : t));
    }
    window.addEventListener('storage', sync);
    const id = setInterval(sync, 1000);
    return () => {
      window.removeEventListener('storage', sync);
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      // logged out — drop any open stream and reset counter
      esRef.current?.close();
      esRef.current = null;
      setItems([]);
      setUnreadCount(0);
      return;
    }

    let cancelled = false;

    // 1. Initial sync of unread count + recent items.
    getNotifications()
      .then((res) => {
        if (cancelled) return;
        setItems(res.data.items ?? []);
        setUnreadCount(res.data.unreadCount ?? 0);
      })
      .catch(() => {
        /* offline / not authed — ignore */
      });

    // 2. Live SSE.
    esRef.current = connectNotifications({
      onNotification: (n) => push(n),
    });

    return () => {
      cancelled = true;
      esRef.current?.close();
      esRef.current = null;
    };
  }, [token, push]);

  return (
    <Ctx.Provider value={{ items, unreadCount, markAllRead, push }}>
      {children}
      <ToastStack toasts={toasts} onDismiss={removeToast} />
    </Ctx.Provider>
  );
}

// ── Hook ─────────────────────────────────────

export function useNotifications(): NotificationsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useNotifications must be used inside <NotificationsProvider>');
  }
  return ctx;
}

// ── Toast UI ─────────────────────────────────

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 360,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t._toastId}
          onClick={() => onDismiss(t._toastId)}
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderLeft: '4px solid #38a169',
            borderRadius: 8,
            padding: '12px 14px',
            boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
            cursor: 'pointer',
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          <i
            className={ICON_BY_TYPE[t.type] ?? 'fas fa-bell'}
            style={{ color: '#38a169', fontSize: 18, marginTop: 2 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#1a202c' }}>
              {t.title}
            </div>
            {t.message && (
              <div
                style={{
                  fontSize: 13,
                  color: '#4a5568',
                  marginTop: 2,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {t.message}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

