import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useFilterStore } from "@/store";
import { fetchTickets, fetchTicket } from "@/services/api";
import { QUERY_KEYS } from "@/config/queryKeys";
import { useDebounce } from "@/hooks";
import { formatDate, formatHours } from "@/utils/formatters";
import { IssueTypeBadge, StatusBadge, PODBadge } from "@/components/ui/Badge";
import LatticeGrid, { Column } from "@/components/ui/LatticeGrid";
import CreateTicketDrawer from "./CreateTicketDrawer";
import type { Ticket } from "@/types";
import styles from "./TicketsPage.module.css";

const COLUMNS: Column<Ticket>[] = [
  {
    key: "key",
    label: "Key",
    width: 110,
    render: (t) => <span className={styles.key}>{t.key}</span>,
  },
  {
    key: "summary",
    label: "Summary",
    width: 280,
    sortable: true,
    render: (t) => (
      <span className={`${styles.summary} truncate`}>{t.summary}</span>
    ),
  },
  {
    key: "assignee",
    label: "Assignee",
    width: 150,
    sortable: true,
    className: "dim",
  },
  {
    key: "pod",
    label: "POD",
    width: 90,
    render: (t) => <PODBadge pod={t.pod} />,
  },
  {
    key: "client",
    label: "Client",
    width: 140,
    className: "dim",
  },
  {
    key: "issue_type",
    label: "Type",
    width: 90,
    render: (t) => <IssueTypeBadge type={t.issue_type} />,
  },
  {
    key: "status",
    label: "Status",
    width: 140,
    render: (t) => <StatusBadge status={t.status} />,
  },
  {
    key: "updated",
    label: "Updated",
    width: 90,
    sortable: true,
    className: "dim",
    render: (t) => formatDate(t.updated),
  },
  {
    key: "hours_spent",
    label: "Hours",
    width: 70,
    sortable: true,
    render: (t) => (
      <span className={styles.hours}>{formatHours(t.hours_spent)}</span>
    ),
  },
];

export default function TicketsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTicketKey = searchParams.get("key");

  const { data: urlTicketData } = useQuery({
    queryKey: ["ticket", urlTicketKey],
    queryFn: () => fetchTicket(urlTicketKey!),
    enabled: !!urlTicketKey,
  });

  const filters = useFilterStore();
  const { pods, clients, togglePod, toggleClient, clearPods, clearClients } =
    useFilterStore();
  const debouncedSearch = useDebounce(filters.search, 300);

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.tickets({
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      user: filters.user,
      pods,
      clients,
    }),
    queryFn: () =>
      fetchTickets({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        user: filters.user,
        pods,
        clients,
      }),
  });

  const tickets: Ticket[] = (data?.tickets ?? []).filter((t) => {
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      if (
        !t.key.toLowerCase().includes(q) &&
        !t.summary.toLowerCase().includes(q) &&
        !t.assignee.toLowerCase().includes(q) &&
        !t.client.toLowerCase().includes(q)
      ) return false;
    }
    if (typeFilter && t.issue_type !== typeFilter) return false;
    if (statusFilter && t.status !== statusFilter) return false;
    return true;
  });

  const uniqueTypes    = [...new Set((data?.tickets ?? []).map((t) => t.issue_type))].sort();
  const uniqueStatuses = [...new Set((data?.tickets ?? []).map((t) => t.status))].sort();

  const activeFilters = [
    filters.project && { label: `Project: ${filters.project}`, onRemove: () => filters.setFilter("project", null) },
    filters.user    && { label: `Engineer: ${filters.user}`, onRemove: () => filters.setFilter("user", null) },
    typeFilter      && { label: `Type: ${typeFilter}`, onRemove: () => setTypeFilter("") },
    statusFilter    && { label: `Status: ${statusFilter}`, onRemove: () => setStatusFilter("") },
    ...pods.map((p)    => ({ label: `POD: ${p}`, onRemove: () => togglePod(p) })),
    ...clients.map((c) => ({ label: `Client: ${c}`, onRemove: () => toggleClient(c) })),
  ].filter(Boolean) as { label: string; onRemove: () => void }[];

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={`${styles.header} fade-up`}>
        <div>
          <h1 className={styles.title}>Tickets</h1>
          <p className={styles.subtitle}>
            {isLoading
              ? "Loading…"
              : `${(data?.total ?? tickets.length).toLocaleString()} tickets · ${tickets.length.toLocaleString()} shown`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + New Ticket
        </button>
      </div>

      {/* Filter bar */}
      <div className={`${styles.filterBar} fade-up-2`}>
        <span className={styles.filterLabel}>Filter: </span>
        <input
          className={`input input-sm ${styles.searchInline}`}
          placeholder="Search tickets…"
          value={filters.search}
          onChange={(e) => filters.setFilter("search", e.target.value)}
          style={{ width: 180 }}
        />

        <select
          className={`input input-sm ${styles.filterSelect}`}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All Types</option>
          {uniqueTypes.map((t) => <option key={t}>{t}</option>)}
        </select>

        <select
          className={`input input-sm ${styles.filterSelect}`}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          {uniqueStatuses.map((s) => <option key={s}>{s}</option>)}
        </select>

        {activeFilters.map((f) => (
          <button key={f.label} className="chip active" onClick={f.onRemove}>
            {f.label} <span className="chip-close">✕</span>
          </button>
        ))}

        {activeFilters.length > 0 && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: "auto" }}
            onClick={() => {
              filters.resetFilters();
              clearPods();
              clearClients();
              setTypeFilter("");
              setStatusFilter("");
            }}
          >
            Clear all
          </button>
        )}
      </div>

      {/* Table */}
      <div className="fade-up-3">
        <LatticeGrid<Ticket>
          columns={COLUMNS}
          rows={tickets}
          rowKey="key"
          isLoading={isLoading}
          onRowClick={(t) => setSelectedTicket(t)}
          emptyIcon="📭"
          emptyTitle="No tickets found"
          emptyDesc="Try adjusting your filters or create a new ticket."
          striped
          footerLeft={
            !isLoading && tickets.length > 0
              ? `Showing ${tickets.length.toLocaleString()} of ${(data?.total ?? 0).toLocaleString()} tickets`
              : undefined
          }
          footerRight={
            !isLoading && tickets.length > 0
              ? (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowCreate(true)}
                >
                  + Create ticket
                </button>
              )
              : undefined
          }
        />
      </div>

      {/* Create Drawer */}
      <CreateTicketDrawer
        open={showCreate}
        onClose={() => setShowCreate(false)}
        defaultStatus="To Do"
      />

      {/* Detail Drawer */}
      {selectedTicket && !urlTicketKey && (
        <CreateTicketDrawer
          open={!!selectedTicket}
          onClose={() => setSelectedTicket(null)}
          ticketKey={selectedTicket.key}
          initialData={{
            title: selectedTicket.summary,
            description: (selectedTicket as any).description ?? "",
            issue_type: selectedTicket.issue_type,
            priority: selectedTicket.priority,
            status: selectedTicket.status,
            assignee: selectedTicket.assignee,
            reporter: (selectedTicket as any).reporter ?? "",
            pod: selectedTicket.pod,
            client: selectedTicket.client,
            story_points: selectedTicket.story_points,
            labels: selectedTicket.labels,
            due_date: selectedTicket.due_date,
            epic: (selectedTicket as any).epic ?? "",
            parent: (selectedTicket as any).parent ?? "",
            originalEst: selectedTicket.original_estimate_hours
              ? String(selectedTicket.original_estimate_hours)
              : "",
            timeSpent: selectedTicket.hours_spent ? String(selectedTicket.hours_spent) : "",
            remaining: selectedTicket.remaining_estimate_hours
              ? String(selectedTicket.remaining_estimate_hours)
              : "",
          }}
        />
      )}

      {/* URL-driven edit drawer */}
      <CreateTicketDrawer
        open={!!urlTicketKey}
        onClose={() => {
          searchParams.delete("key");
          setSearchParams(searchParams);
        }}
        ticketKey={urlTicketKey ?? undefined}
        initialData={
          urlTicketData
            ? {
                title: urlTicketData.summary,
                description: (urlTicketData as any).description ?? "",
                issue_type: urlTicketData.issue_type,
                priority: urlTicketData.priority,
                status: urlTicketData.status,
                assignee: urlTicketData.assignee,
                reporter: (urlTicketData as any).reporter ?? "",
                pod: urlTicketData.pod,
                client: urlTicketData.client,
                story_points: urlTicketData.story_points,
                labels: urlTicketData.labels,
                due_date: urlTicketData.due_date,
                epic: (urlTicketData as any).epic ?? "",
                parent: (urlTicketData as any).parent ?? "",
                originalEst: urlTicketData.original_estimate_hours
                  ? String(urlTicketData.original_estimate_hours)
                  : "",
                timeSpent: urlTicketData.hours_spent ? String(urlTicketData.hours_spent) : "",
                remaining: urlTicketData.remaining_estimate_hours
                  ? String(urlTicketData.remaining_estimate_hours)
                  : "",
              }
            : undefined
        }
      />
    </div>
  );
}
