import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { fetchGuestMe, fetchGuestTickets } from "@/services/api";
import type { Ticket } from "@/types";
import {
  RiGlobalLine,
  RiTicketLine,
  RiSearchLine,
  RiLockLine,
} from "react-icons/ri";
import styles from "./GuestLoginPage.module.css";

export default function GuestLoginPage() {
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get("token") ?? "";

  const [tokenInput, setTokenInput] = useState(urlToken);
  const [token, setToken] = useState(urlToken);
  const [search, setSearch] = useState("");

  const meQuery = useQuery({
    queryKey: ["guest-me", token],
    queryFn: () => fetchGuestMe(token),
    enabled: !!token,
    retry: false,
  });

  const ticketsQuery = useQuery({
    queryKey: ["guest-tickets", token],
    queryFn: () => fetchGuestTickets(token, { limit: 200 }),
    enabled: !!token && meQuery.isSuccess,
    retry: false,
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
  const tickets: Ticket[] = ticketsQuery.data?.tickets ?? [];

  const filtered = tickets.filter((t) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      (t.summary ?? "").toLowerCase().includes(q) ||
      (t.key ?? "").toLowerCase().includes(q) ||
      (t.status ?? "").toLowerCase().includes(q)
    );
  });

  if (!token || meQuery.isError) {
    return (
      <div className={styles.root}>
        <div className={styles.container}>
          <div className={styles.brand}>
            <RiGlobalLine size={28} />
            <span>Trackly Guest Portal</span>
          </div>
          <form className={styles.card} onSubmit={handleSubmit}>
            <h2 className={styles.heading}>Enter Guest Access Token</h2>
            <p className={styles.hint}>
              Paste the token you received to view shared tickets.
            </p>
            <input
              className={styles.input}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="guest-token-..."
              autoFocus
            />
            {meQuery.isError && (
              <p className={styles.error}>Invalid or expired token. Please check and try again.</p>
            )}
            <button type="submit" className={styles.submitBtn}>
              View Tickets
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.container}>
        <div className={styles.headerRow}>
          <div className={styles.brand}>
            <RiGlobalLine size={24} />
            <span>Trackly Guest Portal</span>
          </div>
          <div className={styles.profilePill}>
            <RiLockLine size={14} />
            <span>Read-only</span>
          </div>
        </div>

        {profile && (
          <div className={styles.profileBar}>
            <div>
              <div className={styles.profileName}>{profile.name}</div>
              <div className={styles.profileEmail}>{profile.email}</div>
            </div>
            <div className={styles.profilePods}>
              {(profile.allowed_pods ?? []).join(", ")}
            </div>
          </div>
        )}

        <div className={styles.searchBar}>
          <RiSearchLine size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets…"
          />
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Key</th>
                <th>Summary</th>
                <th>Status</th>
                <th>POD</th>
                <th>Assignee</th>
              </tr>
            </thead>
            <tbody>
              {ticketsQuery.isLoading ? (
                <tr>
                  <td colSpan={5} className={styles.emptyCell}>Loading tickets…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.emptyCell}>
                    {search ? "No tickets match your search." : "No shared tickets found."}
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.key}>
                    <td className={styles.colKey}>
                      <RiTicketLine size={14} style={{ marginRight: 6, verticalAlign: "-2px", opacity: 0.6 }} />
                      {t.key}
                    </td>
                    <td className={styles.colSummary}>{t.summary}</td>
                    <td>
                      <span className={`${styles.badge} ${styles[t.status?.replace(/\s+/g, "") ?? ""]}`}>
                        {t.status}
                      </span>
                    </td>
                    <td>{t.pod}</td>
                    <td>{t.assignee ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.footer}>
          {filtered.length} of {tickets.length} ticket{tickets.length === 1 ? "" : "s"}
        </div>
      </div>
    </div>
  );
}
