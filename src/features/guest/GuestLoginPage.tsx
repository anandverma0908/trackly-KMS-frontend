import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { fetchGuestMe, fetchGuestTickets } from "@/services/api";
import { formatDate } from "@/utils/formatters";
import type { Ticket } from "@/types";
import { IssueTypeBadge, StatusBadge, PODBadge } from "@/components/ui/Badge";
import LatticeGrid, { type Column } from "@/components/ui/LatticeGrid";
import {
  RiSearchLine,
  RiLockLine,
  RiBuilding2Line,
  RiShieldCheckLine,
} from "react-icons/ri";
import styles from "./GuestLoginPage.module.css";

const COLUMNS: Column<Ticket>[] = [
  {
    key: "key",
    label: "Key",
    width: 110,
    render: (t) => <span className={styles.keyCell}>{t.key}</span>,
  },
  {
    key: "summary",
    label: "Summary",
    width: 320,
    sortable: true,
    render: (t) => <span className={styles.summaryCell}>{t.summary}</span>,
  },
  {
    key: "issue_type",
    label: "Type",
    width: 100,
    render: (t) => <IssueTypeBadge type={t.issue_type} />,
  },
  {
    key: "status",
    label: "Status",
    width: 130,
    sortable: true,
    render: (t) => <StatusBadge status={t.status} />,
  },
  {
    key: "pod",
    label: "POD",
    width: 90,
    render: (t) => <PODBadge pod={t.pod} />,
  },
  {
    key: "assignee",
    label: "Assignee",
    width: 140,
    sortable: true,
    className: "dim",
  },
  {
    key: "updated",
    label: "Updated",
    width: 90,
    sortable: true,
    className: "dim",
    render: (t) => formatDate(t.updated),
  },
];

export default function GuestLoginPage() {
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get("token") ?? "";

  const [tokenInput, setTokenInput] = useState(urlToken);
  const [token, setToken] = useState(urlToken);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");


  // Both queries start in parallel as soon as token is available
  const meQuery = useQuery({
    queryKey: ["guest-me", token],
    queryFn: () => fetchGuestMe(token),
    enabled: !!token,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const ticketsQuery = useQuery({
    queryKey: ["guest-tickets", token],
    queryFn: () => fetchGuestTickets(token, { limit: 500 }),
    enabled: !!token,
    retry: false,
    staleTime: 2 * 60 * 1000,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = tokenInput.trim();
    if (!trimmed) {
      toast.error("Please enter a guest token");
      return;
    }
    setToken(trimmed);
  }

  const profile = meQuery.data;
  const allTickets: Ticket[] = ticketsQuery.data?.tickets ?? [];

  const uniqueStatuses = [...new Set(allTickets.map((t) => t.status).filter(Boolean))].sort();

  const filtered = allTickets.filter((t) => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (t.summary ?? "").toLowerCase().includes(q) ||
      (t.key ?? "").toLowerCase().includes(q) ||
      (t.assignee ?? "").toLowerCase().includes(q) ||
      (t.pod ?? "").toLowerCase().includes(q)
    );
  });

  // Show login form when no token or token is invalid
  if (!token || meQuery.isError) {
    return (
      <div className={styles.root}>
        <div className={styles.loginWrap}>
          <div className={styles.loginBrand}>
            <span className={styles.loginLogo}>T</span>
            <span className={styles.loginBrandName}>Trackly</span>
          </div>

          <div className={styles.loginCard}>
            <div className={styles.loginIconWrap}>
              <RiShieldCheckLine size={24} />
            </div>
            <h2 className={styles.loginTitle}>Guest Portal</h2>
            <p className={styles.loginHint}>
              Paste the access token you received to view shared tickets.
            </p>

            <form onSubmit={handleSubmit}>
              <input
                className={styles.loginInput}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="guest-xxxxxxxxxxxxxxxx"
                autoFocus
                spellCheck={false}
              />
              {meQuery.isError && (
                <p className={styles.loginError}>
                  Invalid or expired token. Please check and try again.
                </p>
              )}
              <button type="submit" className={styles.loginBtn}>
                View Tickets
              </button>
            </form>
          </div>

          <p className={styles.loginFootnote}>
            Access is read-only and scoped to tickets shared with you.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.page}>

        {/* ── Top bar ── */}
        <div className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <span className={styles.logoBadge}>T</span>
            <span className={styles.appName}>Trackly</span>
            <span className={styles.separator}>/</span>
            <span className={styles.portalLabel}>Guest Portal</span>
          </div>
          <div className={styles.topbarRight}>
            <span className={styles.readOnlyBadge}>
              <RiLockLine size={11} />
              Read-only
            </span>
          </div>
        </div>

        {/* ── Profile card ── */}
        {profile && (
          <div className={styles.profileCard}>
            <div className={styles.profileAvatar}>
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div className={styles.profileInfo}>
              <div className={styles.profileName}>{profile.name}</div>
              <div className={styles.profileEmail}>{profile.email}</div>
            </div>
            <div className={styles.profileMeta}>
              <div className={styles.profileMetaItem}>
                <RiBuilding2Line size={13} />
                <span>
                  {(profile.allowed_pods ?? []).length > 0
                    ? (profile.allowed_pods ?? []).join(", ")
                    : "All spaces"}
                </span>
              </div>
              {ticketsQuery.isSuccess && (
                <div className={styles.profileMetaItem}>
                  <span className={styles.ticketCount}>
                    {allTickets.length} ticket{allTickets.length !== 1 ? "s" : ""} shared
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Filter bar ── */}
        <div className={styles.filterBar}>
          <div className={styles.searchWrap}>
            <RiSearchLine size={14} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tickets…"
            />
          </div>

          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            {uniqueStatuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {(search || statusFilter) && (
            <button
              className={styles.clearBtn}
              onClick={() => { setSearch(""); setStatusFilter(""); }}
            >
              Clear
            </button>
          )}
        </div>

        {/* ── Grid ── */}
        <div className={styles.gridWrap}>
          <LatticeGrid<Ticket>
            columns={COLUMNS}
            rows={filtered}
            rowKey="key"
            isLoading={ticketsQuery.isLoading}
            emptyIcon="📭"
            emptyTitle={search || statusFilter ? "No tickets match" : "No shared tickets"}
            emptyDesc={
              search || statusFilter
                ? "Try adjusting your search or filters."
                : "No tickets have been shared with this guest link."
            }
            striped
            stickyHeader
            footerLeft={
              ticketsQuery.isSuccess
                ? `${filtered.length} of ${allTickets.length} ticket${allTickets.length !== 1 ? "s" : ""}`
                : undefined
            }
          />
        </div>

      </div>
    </div>
  );
}
