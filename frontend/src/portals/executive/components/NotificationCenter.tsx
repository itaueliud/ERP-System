import React, { useState } from 'react';
import { Card } from '../../../shared/components';
import type { Notification } from '../types';

interface NotificationCenterProps {
  notifications: Notification[];
  onMarkRead?: (id: string) => void;
  onMarkAllRead?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  payment_approval: 'Payment Approval',
  payment_executed: 'Payment Executed',
  contract_generated: 'Contract Generated',
  lead_converted: 'Lead Converted',
};

const TYPE_COLORS: Record<string, string> = {
  payment_approval: 'bg-orange-100 text-orange-700',
  payment_executed: 'bg-green-100 text-green-700',
  contract_generated: 'bg-blue-100 text-blue-700',
  lead_converted: 'bg-purple-100 text-purple-700',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function NotificationCenter({ notifications, onMarkRead, onMarkAllRead }: NotificationCenterProps) {
  const [local, setLocal] = useState<Notification[]>(notifications);

  const unreadCount = local.filter((n) => !n.read).length;

  const handleMarkRead = (id: string) => {
    setLocal((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    onMarkRead?.(id);
  };

  const handleMarkAllRead = () => {
    setLocal((prev) => prev.map((n) => ({ ...n, read: true })));
    onMarkAllRead?.();
  };

  const markAllButton = unreadCount > 0 ? (
    <button
      onClick={handleMarkAllRead}
      aria-label="Mark all notifications as read"
      className="text-sm text-blue-600 hover:text-blue-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
    >
      Mark all read
    </button>
  ) : null;

  return (
    <section aria-label="Notification center">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        Notifications
        {unreadCount > 0 && (
          <span className="ml-2 bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
            {unreadCount} unread
          </span>
        )}
      </h2>
      <Card variant="default" padding="md" title="Recent Notifications" actions={markAllButton}>
        {local.length === 0 ? (
          <p className="text-gray-500 text-sm py-4 text-center">No notifications.</p>
        ) : (
          <ul className="divide-y divide-gray-100" aria-label="Notification list">
            {local.map((notif) => (
              <li
                key={notif.id}
                className={`py-3 flex items-start gap-3 ${notif.read ? 'opacity-60' : ''}`}
              >
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${
                    TYPE_COLORS[notif.type] ?? 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {TYPE_LABELS[notif.type] ?? notif.type}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{notif.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{notif.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{formatDate(notif.createdAt)}</p>
                </div>
                {!notif.read && (
                  <button
                    onClick={() => handleMarkRead(notif.id)}
                    aria-label={`Mark "${notif.title}" as read`}
                    className="text-xs text-blue-600 hover:text-blue-800 shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
                  >
                    Mark read
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}

export default NotificationCenter;
