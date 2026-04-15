import { useQuery } from "@tanstack/react-query";
import { fetchTickets } from "@/services/api";
import { useAuthStore } from "@/features/auth/useAuthStore";
import styles from "./RecentActivity.module.css";
import { MdHistory } from "react-icons/md";
import { formatDistanceToNow, parseISO } from "date-fns";

interface ActivityItem {
  id: string;
  type: "moved" | "logged" | "commented" | "created" | "reviewed";
  title: string;
  key?: string;
  time: string;
  color: string;
}

const TYPE_CONFIG = {
  moved: { label: "Moved ticket", color: "var(--accent)" },
  logged: { label: "Logged time", color: "var(--green)" },
  commented: { label: "Added comment", color: "var(--cyan)" },
  created: { label: "Created ticket", color: "var(--purple)" },
  reviewed: { label: "Submitted review", color: "var(--amber)" },
};

function parseDateString(val: string | undefined | null): Date | null {
  if (!val) return null;
  // Date-only strings like "2026-03-01" parse as UTC midnight with new Date(),
  // causing timezone offset issues. Append local time to fix that.
  const iso = val.includes("T") ? val : `${val}T00:00:00`;
  const d = parseISO(iso);
  return isNaN(d.getTime()) ? null : d;
}

function formatRelative(val: string | undefined | null): string {
  const d = parseDateString(val);
  if (!d) return "—";
  return formatDistanceToNow(d, { addSuffix: true });
}

export default function RecentActivity({ limit = 8 }: { limit?: number }) {
  const user = useAuthStore((s) => s.user);
  const isPersonal = useAuthStore((s) => s.can("view:own"));

  const { data } = useQuery({
    queryKey: ["recent-activity-tickets", user?.name],
    queryFn: () =>
      fetchTickets({
        user: isPersonal ? (user?.name ?? undefined) : undefined,
        dateFrom: null,
        dateTo: null,
      }), 
  });

  // Derive activity feed from tickets + worklogs
  const activities: ActivityItem[] = [];

  (data?.tickets ?? []).slice(0, 20).forEach((t) => {
    // Latest worklog → logged time
    const wl = [...(t.worklogs ?? [])]
      .map((w) => ({ ...w, _date: parseDateString(w.date)?.getTime() ?? 0 }))
      .sort((a, b) => b._date - a._date)[0];

    if (
      wl &&
      wl._date > 0 &&
      (!isPersonal || wl.email === user?.email || wl.author === user?.name)
    ) {
      activities.push({
        id: `wl-${t.key}`,
        type: "logged",
        title: `Logged ${wl.hours}h on ${t.key}`,
        key: t.key,
        time: wl.date,
        color: TYPE_CONFIG.logged.color,
      });
    }

    // Status changes inferred from updated_at
    if (t.status === "In Review" || t.status === "Done") {
      activities.push({
        id: `mv-${t.key}`,
        type: t.status === "Done" ? "moved" : "reviewed",
        title:
          t.status === "Done"
            ? `Closed ${t.key}: ${t.summary.slice(0, 40)}…`
            : `Moved ${t.key} to In Review`,
        key: t.key,
        time: t.updated,
        color:
          t.status === "Done"
            ? TYPE_CONFIG.moved.color
            : TYPE_CONFIG.reviewed.color,
      });
    }
  });

  // Sort by time desc and deduplicate
  const sorted = activities
    .map((a) => ({ ...a, _time: parseDateString(a.time)?.getTime() ?? 0 }))
    .sort((a, b) => b._time - a._time)
    .slice(0, limit);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.icon}>
          <MdHistory />
        </span>
        <div className="card-title">Recent Activity</div>
      </div>

      {sorted.length === 0 ? (
        <div className={styles.empty}>No recent activity</div>
      ) : (
        <div className={styles.feed}>
          {sorted.map((item) => (
            <div key={item.id} className={styles.item}>
              <div
                className={styles.dot}
                style={{
                  background: item.color,
                  boxShadow: `0 0 6px ${item.color}`,
                }}
              />
              <div className={styles.content}>
                <span className={styles.title}>{item.title}</span>
                {item.key && <span className={styles.key}>{item.key}</span>}
              </div>
              <span className={styles.time}>{formatRelative(item.time)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
