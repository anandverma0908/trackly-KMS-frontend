import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/services/api";
import { useNotificationStore } from "@/store";
import type { Notification } from "@/types";
import IconButton from "@mui/material/IconButton";
import { RiCheckboxMultipleLine, RiNotificationOffLine, RiRunLine, RiSunLine, RiFireLine } from "react-icons/ri";
import styles from "./NotificationPanel.module.css";

interface Props {
  onClose: () => void;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  sprint_started: <RiRunLine size={18} />,
  standup_ready: <RiSunLine size={18} />,
  burn_rate_warning: <RiFireLine size={18} />,
};

export default function NotificationPanel({ onClose: _onClose }: Props) {
  const qc = useQueryClient();
  const { clearUnread } = useNotificationStore();

  const { data: raw = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 30_000,
  });

  const notifications = raw as Notification[];
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

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>Notifications</span>
          {unread > 0 && <span className={styles.badge}>{unread}</span>}
        </div>
        <div className={styles.headerActions}>
          {unread > 0 && (
            <IconButton
              size="small"
              title="Mark all read"
              onClick={() => readAllMut.mutate()}
              disabled={readAllMut.isPending}
              sx={{
                color: "var(--text-3)",
                "&:hover": { color: "var(--accent)" },
              }}
            >
              <RiCheckboxMultipleLine size={18} />
            </IconButton>
          )}
          {/* <IconButton
            size="small"
            onClick={onClose}
            sx={{ color: "var(--text-3)", "&:hover": { color: "var(--text)" } }}
          >
            <CloseIcon fontSize="small" />
          </IconButton> */}
        </div>
      </div>

      {/* List */}
      <div className={styles.list}>
        {notifications.length === 0 ? (
          <div className={styles.empty}>
            <RiNotificationOffLine size={36} color="var(--text-3)" />
            <p>You're all caught up</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`${styles.item} ${!n.read ? styles.unread : ""}`}
              onClick={() => {
                if (!n.read) readMut.mutate(n.id);
                if (n.link) window.location.href = n.link;
              }}
            >
              <span className={styles.itemIcon}>
                {TYPE_ICON[n.type] ?? (
                  <RiNotificationOffLine size={18} />
                )}
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
          ))
        )}
      </div>
    </div>
  );
}
