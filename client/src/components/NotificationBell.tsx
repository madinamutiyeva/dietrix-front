import { useNotifications } from '../lib/notifications';

/**
 * Bell icon with red dot that lights up only when there are unread
 * notifications. Click clears the unread counter (mark-all-read locally).
 */
export default function NotificationBell() {
  const { unreadCount, markAllRead } = useNotifications();
  const hasUnread = unreadCount > 0;

  return (
    <button
      type="button"
      className="notification-badge"
      onClick={() => hasUnread && markAllRead()}
      title={hasUnread ? `${unreadCount} new notification${unreadCount > 1 ? 's' : ''}` : 'No new notifications'}
      aria-label="Notifications"
      style={{
        background: 'transparent',
        border: 'none',
        cursor: hasUnread ? 'pointer' : 'default',
        position: 'relative',
        padding: 0,
      }}
    >
      <i className="far fa-bell" />
    </button>
  );
}

