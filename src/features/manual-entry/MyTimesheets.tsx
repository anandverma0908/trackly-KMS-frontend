import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  getDaysInMonth,
  getDay,
  isSameDay,
  isWeekend,
} from "date-fns";
import { useAuthStore } from "@/features/auth/useAuthStore";
import styles from "./MyTimesheets.module.css";
import DayDrawer from "./DayDrawer";

const API = import.meta.env.VITE_API_URL || "";

function getAuthHeader(): Record<string, string> {
  const token = useAuthStore.getState().token;
  return token
    ? { Authorization: `Bearer ${token}` }
    : ({} as Record<string, string>);
}

/* ── Types ── */
interface ActivityItem {
  id: string;
  source: "ticket" | "manual";
  date: string;
  activity: string;
  hours: number;
  pod: string | null;
  client: string | null;
  entry_type: string | null;
  ticket_key: string | null;
  notes: string | null;
  user_name: string;
}

// In fetchActivity — when viewing self, don't pass user param
async function fetchActivity(
  user: string | null,
  dateFrom: string,
  dateTo: string,
): Promise<ActivityItem[]> {
  const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
  if (user) params.append("user", user); // only add if viewing someone else
  const res = await fetch(`${API}/api/activity?${params}`, {
    headers: getAuthHeader(),
  });
  if (!res.ok) throw new Error("Failed to fetch activity");
  return res.json();
}

async function fetchTeamUsers(): Promise<{ name: string; role: string }[]> {
  const res = await fetch(`${API}/api/users`, { headers: getAuthHeader() });
  if (!res.ok) return [];
  return res.json();
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function getStatus(hours: number, weekend: boolean) {
  if (weekend) return "weekend";
  if (hours >= 8) return "full";
  if (hours > 0) return "partial";
  return "empty";
}

/* ── Main component ── */
export default function MyTimesheets() {
  const user = useAuthStore((s) => s.user);
  const isManager =
    user?.role === "admin" || user?.role === "engineering_manager";

  const [month, setMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [viewingUser, setViewingUser] = useState<string>(user?.name ?? "");

  const dateFrom = format(startOfMonth(month), "yyyy-MM-dd");
  const dateTo = format(endOfMonth(month), "yyyy-MM-dd");
  const isSelf = viewingUser === user?.name;

  /* Fetch activity */
  // Pass null when viewing self, name when viewing team member
  const { data: activity = [], isLoading } = useQuery({
    queryKey: ["activity", isSelf ? "me" : viewingUser, dateFrom, dateTo],
    queryFn: () => fetchActivity(isSelf ? null : viewingUser, dateFrom, dateTo),
    enabled: true,
  });

  /* Fetch team for managers */
  const { data: _teamUsers = [] } = useQuery({
    queryKey: ["team-users"],
    queryFn: fetchTeamUsers,
    enabled: isManager,
  });

  /* Group by date */
  const byDate: Record<string, ActivityItem[]> = {};
  activity.forEach((item) => {
    const d = item.date.slice(0, 10);
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(item);
  });

  function hoursForDay(d: Date) {
    return (byDate[format(d, "yyyy-MM-dd")] ?? []).reduce(
      (s, e) => s + e.hours,
      0,
    );
  }

  /* Calendar grid */
  const totalDays = getDaysInMonth(month);
  const firstDay = getDay(startOfMonth(month));
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  /* Month stats */
  const workdays = Array.from({ length: totalDays }, (_, i) => i + 1).filter(
    (d) => !isWeekend(new Date(month.getFullYear(), month.getMonth(), d)),
  );
  const totalTarget = workdays.length * 8;
  const totalLogged = workdays.reduce(
    (s, d) =>
      s + hoursForDay(new Date(month.getFullYear(), month.getMonth(), d)),
    0,
  );
  const fullDays = workdays.filter(
    (d) => hoursForDay(new Date(month.getFullYear(), month.getMonth(), d)) >= 8,
  ).length;
  const partialDays = workdays.filter((d) => {
    const h = hoursForDay(new Date(month.getFullYear(), month.getMonth(), d));
    return h > 0 && h < 8;
  }).length;

  return (
    <div className={styles.root}>
      {/* ── Top bar ── */}
      <div className={styles.topBarContainer}>
        <div className={styles.topBar}>
          {/* Month nav */}
          <div className={styles.monthNav}>
            <button
              className={styles.navBtn}
              onClick={() => setMonth((m) => subMonths(m, 1))}
            >
              ‹
            </button>
            <span className={styles.monthLabel}>
              {format(month, "MMMM yyyy")}
            </span>
            <button
              className={styles.navBtn}
              onClick={() => setMonth((m) => addMonths(m, 1))}
            >
              ›
            </button>
          </div>

          {/* Stats */}
          <div className={styles.statsStrip}>
            <div className={styles.stat}>
              <span className={styles.statVal}>{totalLogged.toFixed(0)}h</span>
              <span className={styles.statLbl}>Logged</span>
            </div>
            <div className={styles.statDiv} />
            <div className={styles.stat}>
              <span className={styles.statVal}>{totalTarget}h</span>
              <span className={styles.statLbl}>Target</span>
            </div>
            <div className={styles.statDiv} />
            <div className={styles.stat}>
              <span className={styles.statVal}>{fullDays}</span>
              <span className={styles.statLbl}>Full days</span>
            </div>
            <div className={styles.statDiv} />
            <div className={styles.stat}>
              <span className={styles.statVal}>{partialDays}</span>
              <span className={styles.statLbl}>Partial</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className={styles.progressWrap}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{
                width: `${Math.min((totalLogged / totalTarget) * 100, 100)}%`,
              }}
            />
          </div>
          <span className={styles.progressPct}>
            {totalTarget > 0
              ? Math.round((totalLogged / totalTarget) * 100)
              : 0}
            %
          </span>
        </div>
      </div>

      {/* Viewing banner (manager looking at someone else) */}
      {isManager && !isSelf && (
        <div className={styles.viewingBanner}>
          <span>
            👁 Viewing timesheet of <strong>{viewingUser}</strong>
          </span>
          <button
            className={styles.viewingBack}
            onClick={() => setViewingUser(user?.name ?? "")}
          >
            ← Back to mine
          </button>
        </div>
      )}

      <div className={styles.calendarContainer}>
        {/* Calendar */}
        <div className={styles.calendar}>
          {DAYS.map((d) => (
            <div key={d} className={styles.dayHeader}>
              {d}
            </div>
          ))}

          {cells.map((day, i) => {
            if (!day)
              return <div key={`e-${i}`} className={styles.emptyCell} />;

            const date = new Date(month.getFullYear(), month.getMonth(), day);
            const weekend = isWeekend(date);
            const today = isSameDay(date, new Date());
            const hours = hoursForDay(date);
            const status = getStatus(hours, weekend);
            const isSelected = selectedDay && isSameDay(date, selectedDay);
            const entries = byDate[format(date, "yyyy-MM-dd")] ?? [];

            return (
              <div
                key={day}
                className={[
                  styles.dayCell,
                  styles[`status_${status}`],
                  isSelected ? styles.daySelected : "",
                  today ? styles.dayToday : "",
                ].join(" ")}
                onClick={() =>
                  !weekend && setSelectedDay(isSelected ? null : date)
                }
              >
                <div className={styles.dayNumber}>{day}</div>

                {!weekend && (
                  <div className={styles.dayContent}>
                    {isLoading ? (
                      <div className={styles.loadingDot} />
                    ) : hours > 0 ? (
                      <div
                        className={styles.hoursLabel}
                        style={{
                          color: hours >= 8 ? "var(--green)" : "#F59E0B",
                        }}
                      >
                        {hours.toFixed(1)}h
                      </div>
                    ) : null}

                    {entries.length > 0 && (
                      <div className={styles.entryDots}>
                        {entries.slice(0, 3).map((e, idx) => (
                          <div
                            key={idx}
                            className={styles.entryDot}
                            style={{
                              background:
                                e.source === "ticket"
                                  ? "var(--accent)"
                                  : "#A78BFA",
                            }}
                          />
                        ))}
                        {entries.length > 3 && (
                          <span className={styles.entryDotMore}>
                            +{entries.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend — bottom of page */}
        <div className={styles.legend} style={{ marginTop: "auto" }}>
          {[
            { color: "rgba(52,211,153,0.6)", label: "≥ 8h — Full day" },
            { color: "rgba(251,191,36,0.6)", label: "1–7h — Partial" },
            { color: "var(--border-2)", label: "0h — Not logged" },
            { color: "var(--accent)", label: "Ticket entry" },
            { color: "#A78BFA", label: "Manual entry" },
          ].map((l) => (
            <div key={l.label} className={styles.legendItem}>
              <span
                className={styles.legendDot}
                style={{ background: l.color }}
              />
              <span>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Day drawer via Portal */}
      {selectedDay && (
        <DayDrawer
          date={selectedDay}
          entries={byDate[format(selectedDay, "yyyy-MM-dd")] ?? []}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}
