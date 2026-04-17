import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFilterStore } from "@/store";
import { fetchSummary, fetchOrgMembers } from "@/services/api";
import { QUERY_KEYS } from "@/config/queryKeys";
import { useDebounce } from "@/hooks";
import { initials, formatNumber } from "@/utils/formatters";
import EmptyState from "@/components/ui/EmptyState";
import styles from "./TeamPage.module.css";
import EngineerDrawer from "./EngineerDrawer";
import { SummaryByUser } from "@/types";
import { useAuthStore } from "../auth/useAuthStore";

export default function TeamPage() {
  const [search, setSearch] = useState("");
  const [selectedEngineer, setSelectedEngineer] =
    useState<SummaryByUser | null>(null);
  const debouncedSearch = useDebounce(search, 250);
  const filters = useFilterStore();
  const { pods, clients } = useFilterStore();
  const getScopedPod = useAuthStore((s) => s.getScopedPod);
  const scopedPod = getScopedPod();

  // If role-scoped to a POD, override the multi-select with just that POD
  const effectivePods = pods.length > 0 ? pods : scopedPod ? [scopedPod] : [];

  const { data, isLoading: summaryLoading } = useQuery({
    queryKey: QUERY_KEYS.summary({
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      pods: effectivePods,
      clients,
    }),
    queryFn: () =>
      fetchSummary({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        pods: effectivePods,
        clients,
      }),
  });

  const { data: orgMembers = [], isLoading: membersLoading } = useQuery({
    queryKey: ["org-members"],
    queryFn: fetchOrgMembers,
    staleTime: 5 * 60_000,
  });

  const isLoading = summaryLoading || membersLoading;

  // Build merged list: every org member appears, enriched with summary data
  const summaryMap = new Map<string, SummaryByUser>();
  (data?.by_user ?? []).forEach((u) => summaryMap.set(u.user, u));

  const allEngineers: SummaryByUser[] = orgMembers
    .filter((m) => m.role !== "finance_viewer")
    .map((m) => summaryMap.get(m.name) ?? { user: m.name, hours: 0, tickets: 0, clients: [] });

  const maxHours = Math.max(...allEngineers.map((u) => u.hours), 1);

  const engineers = allEngineers
    .filter((u) => {
      if (!debouncedSearch) return true;
      return u.user.toLowerCase().includes(debouncedSearch.toLowerCase());
    })
    .sort((a, b) => b.hours - a.hours);

  const avatarColors = [
    "linear-gradient(135deg,#4F7EFF,#818CF8)",
    "linear-gradient(135deg,#34D399,#10B981)",
    "linear-gradient(135deg,#FBBF24,#F59E0B)",
    "linear-gradient(135deg,#F87171,#FCA5A5)",
    "linear-gradient(135deg,#A78BFA,#C4B5FD)",
    "linear-gradient(135deg,#22D3EE,#67E8F9)",
    "linear-gradient(135deg,#64748B,#94A3B8)",
  ];

  function getAvatarColor(name: string) {
    let hash = 0;
    for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
    return avatarColors[Math.abs(hash) % avatarColors.length];
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={`${styles.header} fade-up`}>
        <div>
          <h1 className={styles.title}>Team</h1>
          <p className={styles.subtitle}>
            {isLoading
              ? "Loading…"
              : `${engineers.length} members — click any card to view their worklog.`}
          </p>
        </div>
      </div>

      {/* Filter row */}
      <div className={styles.filterRow}>
        {/* Left: POD filter */}
        {/* Right: search */}
        <div className={styles.filterRight}>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              className={styles.searchInput}
              placeholder="Search engineer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className={styles.searchClear}
                onClick={() => setSearch("")}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className={styles.grid}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className={styles.cardSkeleton} />
          ))}
        </div>
      ) : engineers.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No engineers found"
          desc="Try a different POD or search term."
        />
      ) : (
        <div className={`${styles.grid} fade-up-2`}>
          {engineers.map((eng, i) => (
            <div
              key={eng.user}
              className={styles.card}
              style={{ animationDelay: `${Math.min(i * 0.04, 0.4)}s` }}
              onClick={() => setSelectedEngineer(eng)}
            >
              {/* Top accent line on hover handled by CSS */}
              <div
                className={styles.avatar}
                style={{ background: getAvatarColor(eng.user) }}
              >
                {initials(eng.user)}
              </div>

              <div className={styles.name}>{eng.user}</div>
              <div className={styles.pod}>
                {(() => {
                  const m = orgMembers.find((o) => o.name === eng.user);
                  if (m?.title) return m.title;
                  if (m?.role) return m.role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                  return eng.clients[0] ?? "—";
                })()}
              </div>

              <div className={styles.stats}>
                <div className={styles.stat}>
                  <div
                    className={styles.statVal}
                    style={{
                      color: getAvatarColor(eng.user).includes("4F7EFF")
                        ? "var(--accent)"
                        : undefined,
                    }}
                  >
                    {formatNumber(Math.round(eng.hours))}h
                  </div>
                  <div className={styles.statLabel}>Hours</div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statVal}>{eng.tickets}</div>
                  <div className={styles.statLabel}>Tickets</div>
                </div>
              </div>

              <div className={styles.bar}>
                <div
                  className={styles.barFill}
                  style={{
                    width: `${(eng.hours / maxHours) * 100}%`,
                    background: getAvatarColor(eng.user),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <EngineerDrawer
        engineer={selectedEngineer}
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        onClose={() => setSelectedEngineer(null)}
      />
    </div>
  );
}
