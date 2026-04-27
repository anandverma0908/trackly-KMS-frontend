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

const COLORS = ["#4F7EFF", "#34D399", "#FBBF24", "#F87171", "#A78BFA", "#22D3EE", "#FB923C", "#64748B"];

function fmtDate(s: string) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

  const tickets = data?.tickets ?? [];

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Link ticket to epic</span>
          <button className={styles.modalClose} onClick={onClose}><RiCloseLine size={16} /></button>
        </div>
        <div className={styles.modalSearch}>
          <RiSearchLine size={13} style={{ color: "var(--text-3)", flexShrink: 0 }} />
          <input
            className={styles.modalInput}
            placeholder="Search tickets…"
            value={searchRaw}
            onChange={(e) => handleSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className={styles.modalList}>
          {isFetching && tickets.length === 0 && <div className={styles.modalEmpty}>Searching…</div>}
          {!isFetching && tickets.length === 0 && <div className={styles.modalEmpty}>No tickets found.</div>}
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

export default function EpicsTab({ pod }: { pod: string }) {
  const qc = useQueryClient();
  const userRole = useAuthStore((s) => s.user?.role);
  const canManage = userRole === "admin" || userRole === "engineering_manager" || userRole === "tech_lead";

  const { data: project, isLoading, isError } = useQuery({
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
  const [editingEpic, setEditingEpic] = useState<Epic | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formColor, setFormColor] = useState("#4F7EFF");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");

  const dateError = formStart && formEnd && formEnd < formStart
    ? "End date must be on or after start date"
    : null;

  // Escape key dismisses delete confirm
  useEffect(() => {
    if (!confirmDeleteId) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setConfirmDeleteId(null); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmDeleteId]);

  const createMut = useMutation({
    mutationFn: (payload: { title: string; color: string; start_date?: string; end_date?: string }) =>
      createEpic(pod, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["space-project", pod] });
      toast.success("Epic created");
      resetForm();
      setShowCreate(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (payload: { epicId: string; body: { title?: string; color?: string; start_date?: string; end_date?: string } }) =>
      updateEpic(pod, payload.epicId, payload.body),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["space-project", pod] });
      toast.success("Epic updated");
      // Refresh the open drawer with updated data
      if (drawerEpic && updated?.id === drawerEpic.id) setDrawerEpic(updated as Epic);
      resetForm();
      setEditingEpic(null);
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

  function resetForm() {
    setFormTitle("");
    setFormColor("#4F7EFF");
    setFormStart("");
    setFormEnd("");
  }

  function startEdit(epic: Epic) {
    // Close any open drawer to avoid conflicting state
    setDrawerEpic(null);
    setEditingEpic(epic);
    setShowCreate(false);
    setFormTitle(epic.title);
    setFormColor(epic.color);
    setFormStart(epic.startDate ? epic.startDate.slice(0, 10) : "");
    setFormEnd(epic.endDate ? epic.endDate.slice(0, 10) : "");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim() || dateError) return;
    const payload = {
      title: formTitle.trim(),
      color: formColor,
      start_date: formStart || undefined,
      end_date: formEnd || undefined,
    };
    if (editingEpic) {
      updateMut.mutate({ epicId: editingEpic.id, body: payload });
    } else {
      createMut.mutate(payload);
    }
  }

  const epicTasks = drawerEpic
    ? allTasks.filter((t) => t.epicId === drawerEpic.id)
    : [];

  if (isLoading) {
    return (
      <div className={styles.tab}>
        <div className={styles.stateBox} style={{ color: "var(--text-3)" }}>Loading epics…</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.tab}>
        <div className={styles.stateBox} style={{ color: "var(--red)" }}>
          Failed to load epics. Please refresh.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.tab}>
      <div className={styles.header}>
        <h3 className={styles.title}>Epics</h3>
        {canManage && (
          <button
            className={styles.createBtn}
            onClick={() => { resetForm(); setShowCreate(true); setEditingEpic(null); }}
          >
            <RiAddLine size={14} /> Create Epic
          </button>
        )}
      </div>

      {(showCreate || editingEpic) && canManage && (
        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            className={styles.input}
            placeholder="Epic title"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            required
          />
          <div className={styles.colorRow}>
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`${styles.colorDot} ${formColor === c ? styles.colorDotActive : ""}`}
                style={{ background: c }}
                onClick={() => setFormColor(c)}
              />
            ))}
          </div>
          <div className={styles.dateRow}>
            <input className={styles.input} type="date" value={formStart} onChange={(e) => setFormStart(e.target.value)} />
            <span className={styles.dateArrow}>→</span>
            <input
              className={`${styles.input} ${dateError ? styles.inputError : ""}`}
              type="date"
              value={formEnd}
              onChange={(e) => setFormEnd(e.target.value)}
            />
          </div>
          {dateError && <span className={styles.dateErrorMsg}>{dateError}</span>}
          <div className={styles.formActions}>
            <button
              type="submit"
              className={styles.saveBtn}
              disabled={createMut.isPending || updateMut.isPending || !!dateError}
            >
              {editingEpic ? "Update Epic" : "Create Epic"}
            </button>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => { resetForm(); setShowCreate(false); setEditingEpic(null); }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className={styles.grid}>
        {epics.map((epic) => (
          <div key={epic.id} className={styles.epicCard} onClick={() => setDrawerEpic(epic)}>
            <div className={styles.epicBar} style={{ background: epic.color }} />
            <div className={styles.epicBody}>
              <div className={styles.epicTop}>
                <span className={styles.epicTitle}>{epic.title}</span>
                {canManage && (
                  <button
                    className={styles.epicEditBtn}
                    onClick={(e) => { e.stopPropagation(); startEdit(epic); }}
                  >
                    <RiEditLine size={12} />
                  </button>
                )}
              </div>
              <div className={styles.epicMeta}>
                <span>{epic.tasks} ticket{epic.tasks !== 1 ? "s" : ""}</span>
                {epic.startDate && epic.endDate && (
                  <span className={styles.epicDates}>
                    {fmtDate(epic.startDate)} → {fmtDate(epic.endDate)}
                  </span>
                )}
              </div>
              <div className={styles.progressWrap}>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${epic.progress}%`, background: epic.color }} />
                </div>
                <span className={styles.progressLabel}>{epic.progress}%</span>
              </div>
            </div>
          </div>
        ))}
        {epics.length === 0 && (
          <div className={styles.empty}>No epics yet. Create one to start tracking.</div>
        )}
      </div>

      {/* ── Epic Detail Drawer ── */}
      {drawerEpic && (
        <SideDrawer
          open={Boolean(drawerEpic)}
          onClose={() => { setDrawerEpic(null); setConfirmDeleteId(null); }}
          size="md"
          title={drawerEpic.title}
          badge={
            <span
              className={styles.epicBadge}
              style={{ color: drawerEpic.color, background: `${drawerEpic.color}18`, border: `1px solid ${drawerEpic.color}33` }}
            >
              {drawerEpic.progress}% complete
            </span>
          }
        >
          <div className={styles.drawerBody}>
            <div className={styles.drawerStats}>
              <div className={styles.drawerStat}>
                <span className={styles.drawerStatValue}>{drawerEpic.tasks}</span>
                <span className={styles.drawerStatLabel}>Tickets</span>
              </div>
              <div className={styles.drawerStat}>
                <span className={styles.drawerStatValue}>{drawerEpic.completed}</span>
                <span className={styles.drawerStatLabel}>Done</span>
              </div>
              <div className={styles.drawerStat}>
                <span className={styles.drawerStatValue}>{drawerEpic.tasks - drawerEpic.completed}</span>
                <span className={styles.drawerStatLabel}>Remaining</span>
              </div>
            </div>

            <div className={styles.drawerSectionHeader}>
              <h4 className={styles.drawerSectionTitle}>Linked Tickets</h4>
              {canManage && (
                <button className={styles.linkBtn} onClick={() => setShowLinkModal(true)}>
                  <RiLinkM size={12} /> Link Ticket
                </button>
              )}
            </div>
            <div className={styles.drawerTickets}>
              {epicTasks.map((task) => (
                <div key={task.id} className={styles.drawerTicket}>
                  <span className={styles.drawerTicketKey}>{task.key}</span>
                  <span className={styles.drawerTicketTitle}>{task.title}</span>
                  <span className={styles.drawerTicketStatus}>{task.status}</span>
                </div>
              ))}
              {epicTasks.length === 0 && (
                <div className={styles.drawerEmpty}>No tickets linked to this epic.</div>
              )}
            </div>

            {canManage && (
              <div className={styles.drawerActions}>
                {confirmDeleteId === drawerEpic.id ? (
                  <div className={styles.deleteConfirm}>
                    <span className={styles.deleteConfirmText}>Delete this epic and unlink all tickets?</span>
                    <button
                      className={styles.deleteConfirmYes}
                      disabled={deleteMut.isPending}
                      onClick={() => deleteMut.mutate(drawerEpic.id)}
                    >
                      {deleteMut.isPending ? "Deleting…" : "Delete"}
                    </button>
                    <button className={styles.deleteConfirmNo} onClick={() => setConfirmDeleteId(null)}>
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
