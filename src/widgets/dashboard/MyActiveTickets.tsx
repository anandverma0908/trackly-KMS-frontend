import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchTickets, fetchTicket } from "@/services/api";
import { useAuthStore } from "@/features/auth/model/useAuthStore";
import CreateTicketDrawer from "@/features/tickets/ui/CreateTicketDrawer";
import styles from "./MyActiveTickets.module.scss";

import { RiArrowRightLine, RiTimeLine } from "react-icons/ri";

/* ── Constants ── */

// All statuses considered "open / active"
const DONE_STATUSES = new Set([
  "Done",
  "Closed",
  "Resolved",
  "Won't Fix",
  "Duplicate",
  "Cancelled",
  "Rejected",
]);

const STATUS_META: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  "In Progress": {
    color: "var(--accent)",
    bg: "rgba(79,126,255,0.15)",
    label: "In Progress",
  },
  "In Review": {
    color: "var(--amber)",
    bg: "rgba(251,191,36,0.15)",
    label: "In Review",
  },
  Blocked: {
    color: "var(--red,#F87171)",
    bg: "rgba(248,113,113,0.15)",
    label: "Blocked",
  },
  "To Do": { color: "var(--text-3)", bg: "var(--surface-2)", label: "To Do" },
  Open: { color: "var(--text-3)", bg: "var(--surface-2)", label: "Open" },
  Reopened: {
    color: "var(--cyan,#22D3EE)",
    bg: "rgba(34,211,238,0.12)",
    label: "Reopened",
  },
};

function getStatusMeta(status: string) {
  // Check for blocked in any casing
  if (status.toLowerCase().includes("block")) {
    return STATUS_META["Blocked"];
  }
  return (
    STATUS_META[status] ?? {
      color: "var(--text-3)",
      bg: "var(--surface-2)",
      label: status,
    }
  );
}

const PRIORITY_ICON: Record<string, { icon: string; color: string }> = {
  Highest: { icon: "⬆⬆", color: "var(--red,#F87171)" },
  High: { icon: "⬆", color: "var(--amber)" },
  Medium: { icon: "▶", color: "var(--accent)" },
  Low: { icon: "⬇", color: "var(--green)" },
  Lowest: { icon: "⬇⬇", color: "var(--text-3)" },
};

/* ── Filter tab definitions ── */
type FilterKey = "all" | "in_progress" | "in_review" | "blocked" | "open";

interface TabDef {
  key: FilterKey;
  label: string;
  match: (status: string) => boolean;
}

const TABS: TabDef[] = [
  { key: "all", label: "All", match: () => true },
  {
    key: "in_progress",
    label: "In Progress",
    match: (s) => s === "In Progress",
  },
  { key: "in_review", label: "In Review", match: (s) => s === "In Review" },
  {
    key: "blocked",
    label: "Blocked",
    match: (s) => s.toLowerCase().includes("block"),
  },
  {
    key: "open",
    label: "Backlog",
    match: (s) => s === "To Do" || s === "Open" || s === "Reopened",
  },
];

/* ── Skeleton loading rows ── */
function SkeletonList() {
  return (
    <div className={styles.list}>
      {[80, 60, 70, 55, 65].map((w, i) => (
        <div
          key={i}
          className={styles.skeletonTicket}
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div style={{ display: "flex", gap: 6 }}>
            <div
              style={{
                width: 48,
                height: 14,
                borderRadius: 4,
                background: "var(--surface-3)",
              }}
            />
            <div
              style={{
                width: 60,
                height: 14,
                borderRadius: 4,
                background: "var(--surface-3)",
              }}
            />
          </div>
          <div
            style={{
              width: `${w}%`,
              height: 12,
              borderRadius: 4,
              background: "var(--surface-3)",
            }}
          />
          <div
            style={{
              width: "45%",
              height: 10,
              borderRadius: 4,
              background: "var(--surface-3)",
            }}
          />
        </div>
      ))}
    </div>
  );
}

/* ── Main component ── */
export default function MyActiveTickets() {
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<FilterKey>("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const { data: selectedTicketData } = useQuery({
    queryKey: ["ticket", selectedKey],
    queryFn: () => fetchTicket(selectedKey!),
    enabled: !!selectedKey,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["my-active-tickets", user?.name],
    queryFn: () =>
      fetchTickets({
        user: user?.name ?? undefined,
        dateFrom: null,
        dateTo: null,
      }),
    enabled: !!user,
  });

  /* Filter out done tickets */
  const tickets = (data?.tickets ?? []).filter(
    (t) => !DONE_STATUSES.has(t.status),
  );

  /* Counts per tab (for badges) */
  const tabCounts: Record<FilterKey, number> = {
    all: tickets.length,
    in_progress: tickets.filter((t) => t.status === "In Progress").length,
    in_review: tickets.filter((t) => t.status === "In Review").length,
    blocked: tickets.filter((t) => t.status.toLowerCase().includes("block"))
      .length,
    open: tickets.filter((t) =>
      ["To Do", "Open", "Reopened"].includes(t.status),
    ).length,
  };

  /* Apply tab filter */
  const tabDef = TABS.find((t) => t.key === activeTab)!;
  const filtered = tickets.filter((t) => tabDef.match(t.status));

  /* Sort: Blocked first, then by priority severity, then recency */
  const PRIORITY_ORDER: Record<string, number> = {
    Highest: 0,
    High: 1,
    Medium: 2,
    Low: 3,
    Lowest: 4,
  };
  const sorted = [...filtered].sort((a, b) => {
    // Blocked always first
    const aBlock = a.status.toLowerCase().includes("block") ? 0 : 1;
    const bBlock = b.status.toLowerCase().includes("block") ? 0 : 1;
    if (aBlock !== bBlock) return aBlock - bBlock;
    // Then by priority
    const ap = PRIORITY_ORDER[a.priority ?? ""] ?? 5;
    const bp = PRIORITY_ORDER[b.priority ?? ""] ?? 5;
    if (ap !== bp) return ap - bp;
    // Then by recency
    return new Date(b.updated).getTime() - new Date(a.updated).getTime();
  });

  const hasBlocked = tabCounts.blocked > 0;

  return (
    <div className={styles.card}>
      {/* Header */}
      <div className={styles.header}>
        {/* <span className={styles.iconWrap}>
          <RiTicketLine />
        </span> */}
        <span className={styles.title}>Active Tickets</span>
        {!isLoading && (
          <span
            className={`${styles.countBadge} ${hasBlocked ? styles.countBadgeAlert : ""}`}
          >
            {tickets.length} open
            {hasBlocked ? ` · ${tabCounts.blocked} blocked` : ""}
          </span>
        )}
      </div>

      {/* Filter tabs — only show if there are tickets or still loading */}
      {(isLoading || tickets.length > 0) && (
        <div className={styles.tabs}>
          {TABS.map((tab) => {
            // Only show tabs that have tickets (except "All")
            if (tab.key !== "all" && tabCounts[tab.key] === 0 && !isLoading)
              return null;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                {!isLoading && (
                  <span
                    className={`${styles.tabCount} ${isActive ? styles.tabCountActive : ""}`}
                  >
                    {tabCounts[tab.key]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Ticket list */}
      {isLoading ? (
        <SkeletonList />
      ) : sorted.length === 0 ? (
        /* ── Edge case: empty state ── */
        <div className={styles.empty}>
          {activeTab === "all" ? (
            <>
              <span className={styles.emptyTitle}>All clear!</span>
              <span className={styles.emptyDesc}>
                No open tickets assigned to you right now.
              </span>
            </>
          ) : (
            <>
              <span className={styles.emptyIcon}>✓</span>
              <span className={styles.emptyTitle}>Nothing here</span>
              <span className={styles.emptyDesc}>
                No tickets with "{TABS.find((t) => t.key === activeTab)?.label}"
                status.
              </span>
            </>
          )}
        </div>
      ) : (
        <div className={styles.list}>
          {sorted.map((t) => {
            const sm = getStatusMeta(t.status);
            const priData = PRIORITY_ICON[t.priority ?? ""];
            return (
              <button
                key={t.key}
                className={styles.ticket}
                style={{ "--tc": sm.color } as React.CSSProperties}
                onClick={() => setSelectedKey(t.key)}
                title={t.summary}
              >
                <div className={styles.ticketBody}>
                  {/* Top row: key, status badge, priority */}
                  <div className={styles.ticketTop}>
                    <span className={styles.ticketKey}>{t.key}</span>
                    <span
                      className={styles.statusBadge}
                      style={{ background: sm.bg, color: sm.color }}
                    >
                      {sm.label}
                    </span>
                    {priData && (
                      <span
                        className={styles.priorityIcon}
                        style={{ color: priData.color }}
                        title={`Priority: ${t.priority}`}
                      >
                        {priData.icon}
                      </span>
                    )}
                  </div>

                  {/* Summary (max 2 lines) */}
                  <div className={styles.ticketSummary}>{t.summary}</div>

                  {/* Meta row: client/pod + hours */}
                  <div className={styles.ticketMeta}>
                    {t.pod && <span className={styles.metaChip}>{t.pod}</span>}
                    {t.client && (
                      <span className={styles.metaChip}>· {t.client}</span>
                    )}
                    {t.hours_spent > 0 && (
                      <span className={styles.hoursChip}>
                        <RiTimeLine
                          style={{ display: "inline", marginRight: 2 }}
                        />
                        {t.hours_spent.toFixed(1)}h
                      </span>
                    )}
                  </div>
                </div>

                {/* Arrow (appears on hover) */}
                <RiArrowRightLine className={styles.arrowIcon} />
              </button>
            );
          })}
        </div>
      )}

      {selectedKey && (
        <CreateTicketDrawer
          open
          onClose={() => setSelectedKey(null)}
          ticketKey={selectedKey}
          initialData={
            selectedTicketData
              ? {
                  title: selectedTicketData.summary,
                  description: (selectedTicketData as any).description ?? "",
                  issue_type: selectedTicketData.issue_type,
                  priority: selectedTicketData.priority,
                  status: selectedTicketData.status,
                  assignee: selectedTicketData.assignee,
                  reporter: (selectedTicketData as any).reporter ?? "",
                  pod: selectedTicketData.pod,
                  client: selectedTicketData.client,
                  story_points: selectedTicketData.story_points,
                  labels: selectedTicketData.labels,
                  due_date: selectedTicketData.due_date,
                  originalEst: selectedTicketData.original_estimate_hours
                    ? String(selectedTicketData.original_estimate_hours)
                    : "",
                  timeSpent: selectedTicketData.hours_spent
                    ? String(selectedTicketData.hours_spent)
                    : "",
                  remaining: selectedTicketData.remaining_estimate_hours
                    ? String(selectedTicketData.remaining_estimate_hours)
                    : "",
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
