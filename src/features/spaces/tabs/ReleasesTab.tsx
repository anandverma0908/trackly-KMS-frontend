import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import SideDrawer from "@/components/ui/SideDrawer";
import { IssueTypeBadge, StatusBadge } from "@/components/ui/Badge";
import {
  fetchReleases,
  createRelease,
  updateRelease,
  deleteRelease,
  fetchReleaseTickets,
  fetchPodTickets,
  setFixVersion,
} from "@/services/api";
import type { Release, ReleaseTicket } from "@/services/api";
import styles from "./ReleasesTab.module.css";
import {
  RiAddLine,
  RiDeleteBinLine,
  RiCheckboxCircleLine,
  RiCalendarLine,
  RiLinkM,
  RiCloseLine,
  RiSearchLine,
  RiExternalLinkLine,
  RiFlashlightLine,
} from "react-icons/ri";

const PRIORITY_COLOR: Record<string, string> = {
  Highest: "var(--red)",
  High: "var(--amber)",
  Medium: "var(--amber)",
  Low: "var(--accent)",
  Lowest: "var(--text-3)",
};

const STATUS_DONE = ["Done", "Closed", "Resolved", "Released"];

function fmtDate(s: string | null | undefined) {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDateFull(s: string) {
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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
      <IssueTypeBadge type={ticket.issue_type ?? "Task"} />
      <a
        className={styles.ticketKey}
        href={ticket.url ?? "#"}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        {ticket.key}
        {ticket.url && (
          <RiExternalLinkLine
            size={10}
            style={{ marginLeft: 3, opacity: 0.6 }}
          />
        )}
      </a>
      <span className={styles.ticketSummary}>{ticket.summary}</span>
      <div className={styles.ticketRight}>
        {ticket.priority && (
          <span
            className={styles.priorityDot}
            style={{
              background: PRIORITY_COLOR[ticket.priority] ?? "var(--text-3)",
            }}
            title={ticket.priority}
          />
        )}
        <StatusBadge status={ticket.status ?? ""} />
        {ticket.assignee && (
          <span className={styles.assigneeChip} title={ticket.assignee}>
            {ticket.assignee
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
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
}: {
  pod: string;
  release: Release;
  linkedKeys: Set<string>;
  onClose: () => void;
}) {
  const [searchRaw, setSearchRaw] = useState("");
  const [search, setSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const qc = useQueryClient();

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  function handleSearch(val: string) {
    setSearchRaw(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(val), 300);
  }

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
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const available = (data?.tickets ?? []).filter((t) => !linkedKeys.has(t.key));

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>
            Link tickets to {release.name}
          </span>
          <button className={styles.modalClose} onClick={onClose}>
            <RiCloseLine size={16} />
          </button>
        </div>
        <div className={styles.modalSearch}>
          <RiSearchLine size={14} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search tickets…"
            value={searchRaw}
            onChange={(e) => handleSearch(e.target.value)}
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
              <IssueTypeBadge type={t.issue_type ?? "Task"} />
              <span className={styles.modalTicketKey}>{t.key}</span>
              <span className={styles.modalTicketSummary}>{t.summary}</span>
              {t.assignee && (
                <span className={styles.modalAssignee}>{t.assignee}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Create Release Drawer ── */
function CreateReleaseDrawer({
  pod,
  releases,
  onClose,
}: {
  pod: string;
  releases: Release[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState("");

  const nameExists =
    name.trim() &&
    releases.some((r) => r.name.toLowerCase() === name.trim().toLowerCase());

  const createMut = useMutation({
    mutationFn: () =>
      createRelease(pod, {
        name: name.trim(),
        description: desc || undefined,
        release_date: date || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["releases", pod] });
      toast.success("Release created");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SideDrawer
      open
      onClose={onClose}
      size="sm"
      title="Create Release"
      badge={
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--green)",
            background: "rgba(52,211,153,0.12)",
            border: "1px solid rgba(52,211,153,0.28)",
            padding: "2px 10px",
            borderRadius: 99,
          }}
        >
          <RiFlashlightLine size={9} style={{ marginRight: 4 }} />
          New Release
        </span>
      }
      footer={
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className={styles.footerSaveBtn}
            onClick={() => createMut.mutate()}
            disabled={!name.trim() || !!nameExists || createMut.isPending}
          >
            {createMut.isPending ? "Creating…" : "Create Release"}
          </button>
          <button className={styles.footerCancelBtn} onClick={onClose}>
            Cancel
          </button>
        </div>
      }
    >
      <div className={styles.drawerForm}>
        <div className={styles.formField}>
          <label className={styles.fieldLabel}>Version Name *</label>
          <input
            className={`${styles.fieldInput} ${nameExists ? styles.fieldInputError : ""}`}
            placeholder="e.g. v1.2.0"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          {nameExists && (
            <span className={styles.fieldErrorMsg}>
              A release with this name already exists.
            </span>
          )}
        </div>

        <div className={styles.formField}>
          <label className={styles.fieldLabel}>Description</label>
          <textarea
            className={styles.fieldTextarea}
            placeholder="What's included in this release?"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
          />
        </div>

        <div className={styles.formField}>
          <label className={styles.fieldLabel}>
            <RiCalendarLine size={11} style={{ marginRight: 4 }} />
            Release Date
          </label>
          <input
            className={styles.fieldInput}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          {date && (
            <span
              style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}
            >
              {fmtDateFull(date)}
            </span>
          )}
        </div>
      </div>
    </SideDrawer>
  );
}

/* ── Release Detail Drawer ── */
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
  onDelete: (id: string) => Promise<void>;
}) {
  const [showLink, setShowLink] = useState(false);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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
    STATUS_DONE.some((s) => t.status?.toLowerCase().includes(s.toLowerCase())),
  ).length;
  const total = tickets.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await onDelete(release.id);
      onClose();
    } catch {
      /* already toasted */
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <SideDrawer
        open
        onClose={onClose}
        size="md"
        title={release.name}
        badge={
          <span
            className={`${styles.statusBadge} ${release.status === "released" ? styles.statusReleased : styles.statusUnreleased}`}
          >
            {release.status}
          </span>
        }
        stats={
          total > 0
            ? [
                { label: "Total", value: String(total) },
                { label: "Done", value: String(done) },
                { label: "% Done", value: `${progress}%` },
              ]
            : undefined
        }
      >
        <div className={styles.drawerBody}>
          {release.description && (
            <p className={styles.drawerDesc}>{release.description}</p>
          )}

          {release.release_date && (
            <div className={styles.drawerMeta}>
              <span>
                <RiCalendarLine size={12} style={{ marginRight: 4 }} />
                {fmtDate(release.release_date)}
              </span>
            </div>
          )}

          <div className={styles.ticketsSection}>
            <div className={styles.ticketsSectionHeader}>
              <span className={styles.ticketsSectionTitle}>
                Linked Tickets ({total})
              </span>
              <button
                className={styles.linkBtn}
                onClick={() => setShowLink(true)}
              >
                <RiLinkM size={12} /> Link Tickets
              </button>
            </div>

            {isLoading && <div className={styles.ticketsLoading}>Loading…</div>}
            {!isLoading && tickets.length === 0 && (
              <div className={styles.ticketsEmpty}>
                No tickets linked yet. Click "Link Tickets" to add some.
              </div>
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
            {release.status === "unreleased" &&
              (confirmRelease ? (
                <div className={styles.confirmInline}>
                  <span className={styles.confirmText}>Mark as released?</span>
                  <button
                    className={styles.releaseBtn}
                    onClick={() => {
                      onMarkReleased(release.id);
                      setConfirmRelease(false);
                    }}
                  >
                    Confirm
                  </button>
                  <button
                    className={styles.confirmNo}
                    onClick={() => setConfirmRelease(false)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  className={styles.releaseBtn}
                  onClick={() => setConfirmRelease(true)}
                >
                  <RiCheckboxCircleLine size={12} /> Mark as Released
                </button>
              ))}
            {confirmDelete ? (
              <div className={styles.confirmInline}>
                <span className={styles.confirmText}>Delete this release?</span>
                <button
                  className={styles.drawerDangerBtn}
                  disabled={isDeleting}
                  onClick={handleDelete}
                >
                  {isDeleting ? "Deleting…" : "Delete"}
                </button>
                <button
                  className={styles.confirmNo}
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className={styles.drawerDangerBtn}
                onClick={() => setConfirmDelete(true)}
              >
                <RiDeleteBinLine size={12} /> Delete Release
              </button>
            )}
          </div>
        </div>
      </SideDrawer>

      {showLink && (
        <LinkTicketsModal
          pod={pod}
          release={release}
          linkedKeys={linkedKeys}
          onClose={() => setShowLink(false)}
        />
      )}
    </>
  );
}

/* ── Main ── */
export default function ReleasesTab({ pod }: { pod: string }) {
  const qc = useQueryClient();
  const {
    data: releases = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["releases", pod],
    queryFn: () => fetchReleases(pod),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [drawerRelease, setDrawerRelease] = useState<Release | null>(null);

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

  if (isLoading)
    return (
      <div className={styles.tab}>
        <div className={styles.stateBox} style={{ color: "var(--text-3)" }}>
          Loading releases…
        </div>
      </div>
    );
  if (isError)
    return (
      <div className={styles.tab}>
        <div className={styles.stateBox} style={{ color: "var(--red)" }}>
          Failed to load releases. Please refresh.
        </div>
      </div>
    );

  return (
    <div className={styles.tab}>
      <div className={styles.header}>
        <button
          className={styles.createBtn}
          onClick={() => setShowCreate(true)}
        >
          <RiAddLine size={14} /> Create Release
        </button>
      </div>

      <div className={styles.grid}>
        {releases.map((r) => {
          return (
            <div
              key={r.id}
              className={styles.releaseCard}
              onClick={() => setDrawerRelease(r)}
            >
              <div className={styles.releaseBody}>
                <div className={styles.releaseTop}>
                  <div className={styles.releaseDot} />
                  <span className={styles.releaseName}>{r.name}</span>
                  <span
                    className={`${styles.statusBadge} ${r.status === "released" ? styles.statusReleased : styles.statusUnreleased}`}
                  >
                    {r.status}
                  </span>
                </div>

                {r.release_date && (
                  <div className={styles.releaseDate}>
                    <RiCalendarLine size={12} /> {fmtDate(r.release_date)}
                  </div>
                )}

                <div className={styles.releaseCountSection}>
                  <span className={styles.releaseCountNum}>
                    {r.ticket_count}
                  </span>
                  <span className={styles.releaseCountLabel}>tickets</span>
                </div>

                {r.description && (
                  <p className={styles.releaseDesc}>{r.description}</p>
                )}

                {r.status === "unreleased" && (
                  <div className={styles.releaseCardFooter}>
                    <button
                      className={styles.releaseBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        releaseMut.mutate(r.id);
                      }}
                    >
                      <RiCheckboxCircleLine size={12} /> Mark as Released
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {releases.length === 0 && (
          <div className={styles.empty}>No releases yet.</div>
        )}
      </div>

      {/* ── Create Drawer ── */}
      {showCreate && (
        <CreateReleaseDrawer
          pod={pod}
          releases={releases}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* ── Detail Drawer ── */}
      {drawerRelease && (
        <ReleaseDrawer
          release={drawerRelease}
          pod={pod}
          onClose={() => setDrawerRelease(null)}
          onMarkReleased={(id) => releaseMut.mutate(id)}
          onDelete={(id) => deleteMut.mutateAsync(id)}
        />
      )}
    </div>
  );
}
