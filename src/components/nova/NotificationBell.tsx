import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from "@/services/api";
import { useNotificationStore } from "@/store";
import type { Notification } from "@/types";
import styles from "./NotificationBell.module.css";

export default function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { clearUnread } = useNotificationStore();
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: rawNotifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 30_000,
  });

  const notifications: Notification[] = rawNotifications as Notification[];
  const unread = notifications.filter((n) => !n.read).length;

  const readMut = useMutation({
    mutationFn: (id: number) => markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const readAllMut = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      clearUnread();
    },
  });

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const typeIcon: Record<string, string> = {
    sprint:   "🏃",
    standup:  "☀️",
    burnrate: "🔥",
    default:  "🔔",
  };

  return (
    <div className={styles.wrap} ref={panelRef}>
      <button className={styles.bell} onClick={() => setOpen((v) => !v)} title="Notifications">
        🔔
        {unread > 0 && (
          <span className={styles.badge}>{unread > 99 ? "99+" : unread}</span>
        )}
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>Notifications</span>
            {unread > 0 && (
              <button className={styles.markAll} onClick={() => readAllMut.mutate()} disabled={readAllMut.isPending}>
                Mark all read
              </button>
            )}
          </div>

          <div className={styles.list}>
            {notifications.length === 0 && (
              <div className={styles.empty}>
                <span>🔔</span>
                <p>No notifications yet</p>
              </div>
            )}
            {notifications.map((n: Notification) => (
              <div
                key={n.id}
                className={`${styles.item} ${!n.read ? styles.itemUnread : ""}`}
                onClick={() => {
                  if (!n.read) readMut.mutate(n.id);
                  if (n.link) window.location.href = n.link;
                  setOpen(false);
                }}
              >
                <span className={styles.itemIcon}>
                  {typeIcon[n.type] ?? typeIcon.default}
                </span>
                <div className={styles.itemBody}>
                  <div className={styles.itemTitle}>{n.title}</div>
                  <p className={styles.itemMsg}>{n.message}</p>
                  <span className={styles.itemTime}>
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                </div>
                {!n.read && <span className={styles.unreadDot} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
