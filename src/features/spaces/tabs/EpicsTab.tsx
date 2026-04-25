import React, { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import SideDrawer from "@/components/ui/SideDrawer";
import {
  fetchProject,
  createEpic,
  updateEpic,
  deleteEpic,
} from "@/services/api";
import type { ProjectTask } from "../spacesData";
import styles from "./EpicsTab.module.css";

import {
  RiAddLine,
  RiEditLine,
  RiDeleteBinLine,
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

export default function EpicsTab({ pod }: { pod: string }) {
  const qc = useQueryClient();
  const { data: project } = useQuery({
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

  const [formTitle, setFormTitle] = useState("");
  const [formColor, setFormColor] = useState("#4F7EFF");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["space-project", pod] });
      toast.success("Epic updated");
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
    setEditingEpic(epic);
    setFormTitle(epic.title);
    setFormColor(epic.color);
    setFormStart(epic.startDate ? epic.startDate.slice(0, 10) : "");
    setFormEnd(epic.endDate ? epic.endDate.slice(0, 10) : "");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim()) return;
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

  const COLORS = ["#4F7EFF", "#34D399", "#FBBF24", "#F87171", "#A78BFA", "#22D3EE", "#FB923C", "#64748B"];

  return (
    <div className={styles.tab}>
      <div className={styles.header}>
        <h3 className={styles.title}>Epics</h3>
        <button className={styles.createBtn} onClick={() => { resetForm(); setShowCreate(true); setEditingEpic(null); }}>
          <RiAddLine size={14} /> Create Epic
        </button>
      </div>

      {(showCreate || editingEpic) && (
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
            <input className={styles.input} type="date" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} />
          </div>
          <div className={styles.formActions}>
            <button type="submit" className={styles.saveBtn} disabled={createMut.isPending || updateMut.isPending}>
              {editingEpic ? "Update Epic" : "Create Epic"}
            </button>
            <button type="button" className={styles.cancelBtn} onClick={() => { resetForm(); setShowCreate(false); setEditingEpic(null); }}>
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
                <button
                  className={styles.epicEditBtn}
                  onClick={(e) => { e.stopPropagation(); startEdit(epic); }}
                >
                  <RiEditLine size={12} />
                </button>
              </div>
              <div className={styles.epicMeta}>
                <span>{epic.tasks} ticket{epic.tasks !== 1 ? "s" : ""}</span>
                {epic.startDate && epic.endDate && (
                  <span className={styles.epicDates}>
                    {epic.startDate.slice(0, 10)} → {epic.endDate.slice(0, 10)}
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
          onClose={() => setDrawerEpic(null)}
          size="md"
          title={drawerEpic.title}
          badge={
            <span className={styles.epicBadge} style={{ color: drawerEpic.color, background: `${drawerEpic.color}18`, border: `1px solid ${drawerEpic.color}33` }}>
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

            <h4 className={styles.drawerSectionTitle}>Linked Tickets</h4>
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

            <div className={styles.drawerActions}>
              <button className={styles.drawerDangerBtn} onClick={() => deleteMut.mutate(drawerEpic.id)} disabled={deleteMut.isPending}>
                <RiDeleteBinLine size={13} /> Delete Epic
              </button>
            </div>
          </div>
        </SideDrawer>
      )}
    </div>
  );
}
