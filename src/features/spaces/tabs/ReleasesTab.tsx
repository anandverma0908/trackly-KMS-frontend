import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import SideDrawer from "@/components/ui/SideDrawer";
import {
  fetchReleases, createRelease, updateRelease, deleteRelease,
  fetchReleaseTickets, fetchPodTickets, setFixVersion,
} from "@/services/api";
import type { Release, ReleaseTicket } from "@/services/api";
import styles from "./ReleasesTab.module.css";
import {
  RiAddLine, RiDeleteBinLine, RiCheckboxCircleLine, RiCalendarLine,
  RiLinkM, RiCloseLine, RiSearchLine, RiExternalLinkLine,
} from "react-icons/ri";

const PRIORITY_COLOR: Record<string, string> = {
  Highest: "#ef4444", High: "#f97316", Medium: "#f59e0b",
  Low: "#3b82f6", Lowest: "#6b7280",
};
const STATUS_DONE = ["Done", "Closed", "Resolved", "Released"];

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const done = STATUS_DONE.some((s) => status.toLowerCase().includes(s.toLowerCase()));
  return (
    <span className={`${styles.ticketStatus} ${done ? styles.ticketStatusDone : styles.ticketStatusOpen}`}>
      {status}
    </span>
  );
}

function IssueTypeTag({ type }: { type?: string }) {
  if (!type) return null;
  const t = type.toLowerCase();
  let cls = styles.typeDefault;
  if (t.includes("bug")) cls = styles.typeBug;
  else if (t.includes("story")) cls = styles.typeStory;
  else if (t.includes("epic")) cls = styles.typeEpic;
  else if (t.includes("task")) cls = styles.typeTask;
  return <span className={`${styles.typeTag} ${cls}`}>{type}</span>;
}

function TicketRow({
  ticket,
  onUnlink,
}: {
  ticket: ReleaseTicket;
  onUnlink?: (key: string) => void;
}) {
  return (
    <div className={styles.ticketRow}>
      <IssueTypeTag type={ticket.issue_type} />
      <a
        className={styles.ticketKey}
        href={ticket.url ?? "#"}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        {ticket.key}
        {ticket.url && <RiExternalLinkLine size={10} style={{ marginLeft: 3, opacity: 0.6 }} />}
      </a>
      <span className={styles.ticketSummary}>{ticket.summary}</span>
      <div className={styles.ticketRight}>
        {ticket.priority && (
          <span
            className={styles.priorityDot}
            style={{ background: PRIORITY_COLOR[ticket.priority] ?? "#9ca3af" }}
            title={ticket.priority}
          />
        )}
        <StatusBadge status={ticket.status} />
        {ticket.assignee && (
          <span className={styles.assigneeChip} title={ticket.assignee}>
            {ticket.assignee.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
          </span>
        )}
        {onUnlink && (
          <button
            className={styles.unlinkBtn}
            onClick={() => onUnlink(ticket.key)}
            title="Remove from release"
          >
            <RiCloseLine size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

function LinkTicketsModal({
  pod,
  release,
  linkedKeys,
  onClose,
  onLinked,
}: {
  pod: string;
  release: Release;
  linkedKeys: Set<string>;
  onClose: () => void;
  onLinked: () => void;
}) {
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  const { data, isFetching } = useQuery({
    queryKey: ["pod-tickets-search", pod, search],
    queryFn: () => fetchPodTickets(pod, search || undefined),
    placeholderData: (prev) => prev,
  });

  const linkMut = useMutation({
    mutationFn: (key: string) => setFixVersion(key, release.name),
    onSuccess: (_, key) => {
      qc.invalidateQueries({ queryKey: ["release-tickets", pod, release.id] });
      qc.invalidateQueries({ queryKey: ["releases", pod] });
      toast.success(`${key} added to ${release.name}`);
      onLinked();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const available = (data?.tickets ?? []).filter((t) => !linkedKeys.has(t.key));

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Link tickets to {release.name}</span>
          <button className={styles.modalClose} onClick={onClose}><RiCloseLine size={16} /></button>
        </div>
        <div className={styles.modalSearch}>
          <RiSearchLine size={14} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search tickets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className={styles.modalList}>
          {isFetching && available.length === 0 && (
            <div className={styles.modalEmpty}>Searching…</div>
          )}
          {!isFetching && available.length === 0 && (
            <div className={styles.modalEmpty}>No tickets found.</div>
          )}
          {available.map((t) => (
            <button
              key={t.key}
              className={styles.modalTicketRow}
              onClick={() => linkMut.mutate(t.key)}
              disabled={linkMut.isPending}
            >
              <IssueTypeTag type={t.issue_type} />
              <span className={styles.modalTicketKey}>{t.key}</span>
              <span className={styles.modalTicketSummary}>{t.summary}</span>
              {t.assignee && <span className={styles.modalAssignee}>{t.assignee}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReleaseDrawer({
  release,
  pod,
  onClose,
  onMarkReleased,
  onDelete,
}: {
  release: Release;
  pod: string;
  onClose: () => void;
  onMarkReleased: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [showLink, setShowLink] = useState(false);
  const qc = useQueryClient();

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["release-tickets", pod, release.id],
    queryFn: () => fetchReleaseTickets(pod, release.id),
  });

  const unlinkMut = useMutation({
    mutationFn: (key: string) => setFixVersion(key, null),
    onSuccess: (_, key) => {
      qc.invalidateQueries({ queryKey: ["release-tickets", pod, release.id] });
      qc.invalidateQueries({ queryKey: ["releases", pod] });
      toast.success(`${key} removed from release`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const linkedKeys = new Set(tickets.map((t) => t.key));

  const done = tickets.filter((t) =>
    STATUS_DONE.some((s) => t.status?.toLowerCase().includes(s.toLowerCase()))
  ).length;
  const total = tickets.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <>
      <SideDrawer
        open
        onClose={onClose}
        size="md"
        title={release.name}
        badge={
          <span className={`${styles.statusBadge} ${release.status === "released" ? styles.statusReleased : styles.statusUnreleased}`}>
            {release.status}
          </span>
        }
      >
        <div className={styles.drawerBody}>
          {release.description && <p className={styles.drawerDesc}>{release.description}</p>}

          <div className={styles.drawerMeta}>
            {release.release_date && (
              <span><RiCalendarLine size={12} style={{ marginRight: 4 }} />{release.release_date}</span>
            )}
          </div>

          {total > 0 && (
            <div className={styles.progressWrap}>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
              </div>
              <span className={styles.progressLabel}>{done}/{total} done</span>
            </div>
          )}

          <div className={styles.ticketsSection}>
            <div className={styles.ticketsSectionHeader}>
              <span className={styles.ticketsSectionTitle}>Linked Tickets ({total})</span>
              <button className={styles.linkBtn} onClick={() => setShowLink(true)}>
                <RiLinkM size={12} /> Link Tickets
              </button>
            </div>

            {isLoading && <div className={styles.ticketsLoading}>Loading…</div>}
            {!isLoading && tickets.length === 0 && (
              <div className={styles.ticketsEmpty}>No tickets linked yet. Click "Link Tickets" to add some.</div>
            )}
            {tickets.map((t) => (
              <TicketRow
                key={t.key}
                ticket={t}
                onUnlink={(key) => unlinkMut.mutate(key)}
              />
            ))}
          </div>

          <div className={styles.drawerActions}>
            {release.status === "unreleased" && (
              <button
                className={styles.releaseBtn}
                onClick={() => onMarkReleased(release.id)}
              >
                <RiCheckboxCircleLine size={12} /> Mark as Released
              </button>
            )}
            <button
              className={styles.drawerDangerBtn}
              onClick={() => { onDelete(release.id); onClose(); }}
            >
              <RiDeleteBinLine size={12} /> Delete Release
            </button>
          </div>
        </div>
      </SideDrawer>

      {showLink && (
        <LinkTicketsModal
          pod={pod}
          release={release}
          linkedKeys={linkedKeys}
          onClose={() => setShowLink(false)}
          onLinked={() => setShowLink(false)}
        />
      )}
    </>
  );
}

export default function ReleasesTab({ pod }: { pod: string }) {
  const qc = useQueryClient();
  const { data: releases = [] } = useQuery({
    queryKey: ["releases", pod],
    queryFn: () => fetchReleases(pod),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState("");
  const [drawerRelease, setDrawerRelease] = useState<Release | null>(null);

  const createMut = useMutation({
    mutationFn: () => createRelease(pod, { name, description: desc || undefined, release_date: date || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["releases", pod] });
      toast.success("Release created");
      setShowCreate(false);
      setName(""); setDesc(""); setDate("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const releaseMut = useMutation({
    mutationFn: (id: string) => updateRelease(pod, id, { status: "released" }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["releases", pod] });
      if (drawerRelease?.id === updated.id) setDrawerRelease(updated);
      toast.success("Marked as released");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteRelease(pod, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["releases", pod] });
      toast.success("Release deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className={styles.tab}>
      <div className={styles.header}>
        <h3 className={styles.title}>Releases</h3>
        <button className={styles.createBtn} onClick={() => setShowCreate(true)}>
          <RiAddLine size={14} /> Create Release
        </button>
      </div>

      {showCreate && (
        <div className={styles.form}>
          <input className={styles.input} placeholder="Version name (e.g. v1.2.0)" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={styles.input} placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <input className={styles.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <div className={styles.formActions}>
            <button className={styles.saveBtn} onClick={() => createMut.mutate()} disabled={!name.trim() || createMut.isPending}>Create</button>
            <button className={styles.cancelBtn} onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className={styles.grid}>
        {releases.map((r) => (
          <div key={r.id} className={styles.releaseCard} onClick={() => setDrawerRelease(r)}>
            <div className={styles.releaseTop}>
              <span className={styles.releaseName}>{r.name}</span>
              <span className={`${styles.statusBadge} ${r.status === "released" ? styles.statusReleased : styles.statusUnreleased}`}>
                {r.status}
              </span>
            </div>
            {r.description && <p className={styles.releaseDesc}>{r.description}</p>}
            <div className={styles.releaseMeta}>
              <span className={styles.releaseCount}>{r.ticket_count} tickets</span>
              {r.release_date && (
                <span className={styles.releaseDate}>
                  <RiCalendarLine size={10} /> {r.release_date}
                </span>
              )}
            </div>
            {r.status === "unreleased" && (
              <button
                className={styles.releaseBtn}
                onClick={(e) => { e.stopPropagation(); releaseMut.mutate(r.id); }}
              >
                <RiCheckboxCircleLine size={12} /> Mark as Released
              </button>
            )}
          </div>
        ))}
        {releases.length === 0 && <div className={styles.empty}>No releases yet.</div>}
      </div>

      {drawerRelease && (
        <ReleaseDrawer
          release={drawerRelease}
          pod={pod}
          onClose={() => setDrawerRelease(null)}
          onMarkReleased={(id) => releaseMut.mutate(id)}
          onDelete={(id) => deleteMut.mutate(id)}
        />
      )}
    </div>
  );
}
