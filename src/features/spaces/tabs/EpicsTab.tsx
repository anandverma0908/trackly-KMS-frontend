import React, { useState, useMemo, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import SideDrawer from "@/components/ui/SideDrawer";
import { useAuthStore } from "@/features/auth/useAuthStore";
import {
  fetchProject,
  createEpic,
  updateEpic,
  deleteEpic,
  linkTicketToEpic,
  fetchPodTickets,
} from "@/services/api";
import type { ProjectTask } from "../spacesData";
import styles from "./EpicsTab.module.css";

import {
  RiAddLine,
  RiEditLine,
  RiDeleteBinLine,
  RiSearchLine,
  RiCloseLine,
  RiLinkM,
  RiCalendarLine,
  RiFlagLine,
} from "react-icons/ri";

interface Epic {
  id: string;
  title: string;
  color: string;
  startDate: string;
  endDate: string;
  progress: number;
  tasks: number;
  completed: number;
}

const COLORS = [
  "#f59e0b",
  "#34D399",
  "#FBBF24",
  "#F87171",
  "#A78BFA",
  "#22D3EE",
  "#FB923C",
  "#64748B",
];

function fmtDate(s: string) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtShort(s: string) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ── Link Ticket Modal ── */
function LinkTicketModal({
  pod,
  epicId,
  onClose,
}: {
  pod: string;
  epicId: string;
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
    queryKey: ["pod-tickets-link-epic", pod, search],
    queryFn: () => fetchPodTickets(pod, search || undefined),
    placeholderData: (prev) => prev,
  });

  const linkMut = useMutation({
    mutationFn: (key: string) => linkTicketToEpic(key, epicId),
    onSuccess: (_, key) => {
      qc.invalidateQueries({ queryKey: ["space-project", pod] });
      toast.success(`${key} linked to epic`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const LINKABLE_TO_EPIC = ["Story", "Task", "Bug", "Improvement", "Subtask"];
  const tickets = (data?.tickets ?? []).filter(
    (t: any) => LINKABLE_TO_EPIC.includes(t.issue_type ?? "Task"),
  );

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Link ticket to epic</span>
          <button className={styles.modalClose} onClick={onClose}>
            <RiCloseLine size={16} />
          </button>
        </div>
        <div className={styles.modalSearch}>
          <RiSearchLine
            size={13}
            style={{ color: "var(--text-3)", flexShrink: 0 }}
          />
          <input
            className={styles.modalInput}
            placeholder="Search tickets…"
            value={searchRaw}
            onChange={(e) => handleSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className={styles.modalList}>
          {isFetching && tickets.length === 0 && (
            <div className={styles.modalEmpty}>Searching…</div>
          )}
          {!isFetching && tickets.length === 0 && (
            <div className={styles.modalEmpty}>No tickets found.</div>
          )}
          {tickets.map((t) => (
            <button
              key={t.key}
              className={styles.modalRow}
              onClick={() => linkMut.mutate(t.key)}
              disabled={linkMut.isPending}
            >
              <span className={styles.modalKey}>{t.key}</span>
              <span className={styles.modalSummary}>{t.summary}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Create / Edit Epic Drawer ── */
function EpicFormDrawer({
  epic,
  onClose,
  onCreate,
  onUpdate,
  isPending,
}: {
  epic: Epic | null;
  onClose: () => void;
  onCreate: (payload: {
    title: string;
    color: string;
    start_date?: string;
    end_date?: string;
  }) => void;
  onUpdate: (payload: {
    title: string;
    color: string;
    start_date?: string;
    end_date?: string;
  }) => void;
  isPending: boolean;
}) {
  const isEdit = Boolean(epic);
  const [title, setTitle] = useState(epic?.title ?? "");
  const [color, setColor] = useState(epic?.color ?? "#f59e0b");
  const [start, setStart] = useState(
    epic?.startDate ? epic.startDate.slice(0, 10) : "",
  );
  const [end, setEnd] = useState(
    epic?.endDate ? epic.endDate.slice(0, 10) : "",
  );

  const dateError =
    start && end && end < start
      ? "End date must be on or after start date"
      : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || dateError) return;
    const payload = {
      title: title.trim(),
      color,
      start_date: start || undefined,
      end_date: end || undefined,
    };
    if (isEdit) onUpdate(payload);
    else onCreate(payload);
  }

  return (
    <SideDrawer
      open
      onClose={onClose}
      size="sm"
      title={isEdit ? "Edit Epic" : "Create Epic"}
      badge={
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 11,
            fontWeight: 700,
            color: "var(--accent)",
            background: "var(--accent-glow)",
            border: "1px solid var(--accent-border)",
            padding: "2px 10px",
            borderRadius: 99,
          }}
        >
          <RiFlagLine size={10} /> {isEdit ? "Editing" : "New Epic"}
        </span>
      }
      footer={
        <div className={styles.drawerFooter}>
          <button
            className={styles.footerSaveBtn}
            onClick={handleSubmit}
            disabled={!title.trim() || !!dateError || isPending}
          >
            {isPending
              ? isEdit
                ? "Saving…"
                : "Creating…"
              : isEdit
                ? "Save Changes"
                : "Create Epic"}
          </button>
          <button className={styles.footerCancelBtn} onClick={onClose}>
            Cancel
          </button>
        </div>
      }
    >
      <form className={styles.drawerForm} onSubmit={handleSubmit}>
        <div className={styles.formField}>
          <label className={styles.fieldLabel}>Epic Title *</label>
          <input
            className={styles.fieldInput}
            placeholder="e.g. User Authentication"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            required
          />
        </div>

        <div className={styles.formField}>
          <label className={styles.fieldLabel}>Color</label>
          <div className={styles.colorSwatches}>
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`${styles.colorSwatch} ${color === c ? styles.colorSwatchActive : ""}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                title={c}
              />
            ))}
          </div>
          <div className={styles.colorPreview}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: color,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--text-2)",
              }}
            >
              {color}
            </span>
          </div>
        </div>

        <div className={styles.formField}>
          <label className={styles.fieldLabel}>
            <RiCalendarLine size={11} style={{ marginRight: 4 }} />
            Timeline
          </label>
          <div className={styles.fieldRow}>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-3)",
                  marginBottom: 4,
                }}
              >
                Start
              </div>
              <input
                className={styles.fieldInput}
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <span
              style={{ color: "var(--text-3)", fontSize: 14, paddingTop: 22 }}
            >
              →
            </span>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-3)",
                  marginBottom: 4,
                }}
              >
                End
              </div>
              <input
                className={`${styles.fieldInput} ${dateError ? styles.fieldInputError : ""}`}
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          {dateError && (
            <span className={styles.fieldErrorMsg}>{dateError}</span>
          )}
        </div>
      </form>
    </SideDrawer>
  );
}

/* ── Main ── */
export default function EpicsTab({ pod }: { pod: string }) {
  const qc = useQueryClient();
  const userRole = useAuthStore((s) => s.user?.role);
  const canManage =
    userRole === "admin" ||
    userRole === "engineering_manager" ||
    userRole === "tech_lead";

  const {
    data: project,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["space-project", pod],
    queryFn: () => fetchProject(pod),
  });

  const epics: Epic[] = project?.epics ?? [];
  const allTasks: ProjectTask[] = useMemo(() => {
    if (!project) return [];
    return [
      ...(project.backlogTasks ?? []),
      ...project.sprints.flatMap((s) => s.tasks),
    ];
  }, [project]);

  const [drawerEpic, setDrawerEpic] = useState<Epic | null>(null);
  const [formDrawer, setFormDrawer] = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<Epic | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!confirmDeleteId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setConfirmDeleteId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmDeleteId]);

  const createMut = useMutation({
    mutationFn: (payload: {
      title: string;
      color: string;
      start_date?: string;
      end_date?: string;
    }) => createEpic(pod, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["space-project", pod] });
      toast.success("Epic created");
      setFormDrawer(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (payload: {
      epicId: string;
      body: {
        title?: string;
        color?: string;
        start_date?: string;
        end_date?: string;
      };
    }) => updateEpic(pod, payload.epicId, payload.body),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["space-project", pod] });
      toast.success("Epic updated");
      if (drawerEpic && updated?.id === drawerEpic.id)
        setDrawerEpic(updated as Epic);
      setFormDrawer(null);
      setEditTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (epicId: string) => deleteEpic(pod, epicId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["space-project", pod] });
      toast.success("Epic deleted");
      setDrawerEpic(null);
      setConfirmDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openEdit(epic: Epic) {
    setDrawerEpic(null);
    setEditTarget(epic);
    setFormDrawer("edit");
  }

  const epicTasks = drawerEpic
    ? allTasks.filter((t) => t.epicId === drawerEpic.id)
    : [];

  if (isLoading)
    return (
      <div className={styles.tab}>
        <div className={styles.stateBox} style={{ color: "var(--text-3)" }}>
          Loading epics…
        </div>
      </div>
    );
  if (isError)
    return (
      <div className={styles.tab}>
        <div className={styles.stateBox} style={{ color: "var(--red)" }}>
          Failed to load epics. Please refresh.
        </div>
      </div>
    );

  return (
    <div className={styles.tab}>
      <div className={styles.header}>
        {canManage && (
          <button
            className={styles.createBtn}
            onClick={() => {
              setEditTarget(null);
              setFormDrawer("create");
            }}
          >
            <RiAddLine size={14} /> Create Epic
          </button>
        )}
      </div>

      <div className={styles.grid}>
        {epics.map((epic) => (
          <div
            key={epic.id}
            className={styles.epicCard}
            onClick={() => setDrawerEpic(epic)}
          >
            <div className={styles.epicBody}>
              <div className={styles.epicTop}>
                <div className={styles.epicDot} style={{ background: epic.color }} />
                <span className={styles.epicTitle}>{epic.title}</span>
                {canManage && (
                  <button
                    className={styles.epicEditBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(epic);
                    }}
                  >
                    <RiEditLine size={13} />
                  </button>
                )}
              </div>

              {epic.startDate && epic.endDate && (
                <div className={styles.epicDates}>
                  <RiCalendarLine size={12} />
                  {fmtShort(epic.startDate)} → {fmtShort(epic.endDate)}
                </div>
              )}

              <div className={styles.epicProgressSection}>
                <div className={styles.epicProgressHeader}>
                  <span className={styles.epicProgressPct} style={{ color: epic.color }}>
                    {epic.progress}%
                  </span>
                  <span className={styles.epicProgressLabel}>complete</span>
                </div>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${epic.progress}%`, background: epic.color }}
                  />
                </div>
              </div>

              <div className={styles.epicStats}>
                <span className={styles.epicStat}><strong>{epic.tasks}</strong> tickets</span>
                <span className={styles.epicStatDivider}>·</span>
                <span className={styles.epicStat}><strong>{epic.completed}</strong> done</span>
                <span className={styles.epicStatDivider}>·</span>
                <span className={styles.epicStat}><strong>{epic.tasks - epic.completed}</strong> left</span>
              </div>
            </div>
          </div>
        ))}
        {epics.length === 0 && (
          <div className={styles.empty}>
            No epics yet. Create one to start tracking.
          </div>
        )}
      </div>

      {/* ── Create / Edit Drawer ── */}
      {formDrawer && (
        <EpicFormDrawer
          epic={formDrawer === "edit" ? editTarget : null}
          onClose={() => {
            setFormDrawer(null);
            setEditTarget(null);
          }}
          onCreate={(payload) => createMut.mutate(payload)}
          onUpdate={(payload) =>
            updateMut.mutate({ epicId: editTarget!.id, body: payload })
          }
          isPending={createMut.isPending || updateMut.isPending}
        />
      )}

      {/* ── Epic Detail Drawer ── */}
      {drawerEpic && (
        <SideDrawer
          open={Boolean(drawerEpic)}
          onClose={() => {
            setDrawerEpic(null);
            setConfirmDeleteId(null);
          }}
          size="md"
          title={drawerEpic.title}
          badge={
            <span
              className={styles.epicBadge}
              style={{
                color: drawerEpic.color,
                background: `${drawerEpic.color}18`,
                border: `1px solid ${drawerEpic.color}33`,
              }}
            >
              {drawerEpic.progress}% complete
            </span>
          }
          stats={[
            { label: "Tickets", value: String(drawerEpic.tasks) },
            { label: "Done", value: String(drawerEpic.completed) },
            {
              label: "Remaining",
              value: String(drawerEpic.tasks - drawerEpic.completed),
            },
          ]}
        >
          <div className={styles.drawerBody}>
            {(drawerEpic.startDate || drawerEpic.endDate) && (
              <div className={styles.drawerDateRow}>
                <RiCalendarLine size={12} style={{ color: "var(--text-3)" }} />
                <span>{fmtDate(drawerEpic.startDate)}</span>
                <span style={{ color: "var(--text-3)" }}>→</span>
                <span>{fmtDate(drawerEpic.endDate)}</span>
              </div>
            )}

            <div className={styles.drawerSectionHeader}>
              <h4 className={styles.drawerSectionTitle}>Linked Tickets</h4>
              {canManage && (
                <button
                  className={styles.linkBtn}
                  onClick={() => setShowLinkModal(true)}
                >
                  <RiLinkM size={12} /> Link Ticket
                </button>
              )}
            </div>
            <div className={styles.drawerTickets}>
              {epicTasks.map((task) => (
                <div key={task.id} className={styles.drawerTicket}>
                  <span className={styles.drawerTicketKey}>{task.key}</span>
                  <span className={styles.drawerTicketTitle}>{task.title}</span>
                  <span className={styles.drawerTicketStatus}>
                    {task.status}
                  </span>
                </div>
              ))}
              {epicTasks.length === 0 && (
                <div className={styles.drawerEmpty}>
                  No tickets linked to this epic.
                </div>
              )}
            </div>

            {canManage && (
              <div className={styles.drawerActions}>
                <button
                  className={styles.editInDrawerBtn}
                  onClick={() => openEdit(drawerEpic)}
                >
                  <RiEditLine size={13} /> Edit Epic
                </button>
                {confirmDeleteId === drawerEpic.id ? (
                  <div className={styles.deleteConfirm}>
                    <span className={styles.deleteConfirmText}>
                      Delete this epic and unlink all tickets?
                    </span>
                    <button
                      className={styles.deleteConfirmYes}
                      disabled={deleteMut.isPending}
                      onClick={() => deleteMut.mutate(drawerEpic.id)}
                    >
                      {deleteMut.isPending ? "Deleting…" : "Delete"}
                    </button>
                    <button
                      className={styles.deleteConfirmNo}
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className={styles.drawerDangerBtn}
                    onClick={() => setConfirmDeleteId(drawerEpic.id)}
                  >
                    <RiDeleteBinLine size={13} /> Delete Epic
                  </button>
                )}
              </div>
            )}
          </div>
        </SideDrawer>
      )}

      {/* ── Link Ticket Modal ── */}
      {showLinkModal && drawerEpic && (
        <LinkTicketModal
          pod={pod}
          epicId={drawerEpic.id}
          onClose={() => setShowLinkModal(false)}
        />
      )}
    </div>
  );
}
