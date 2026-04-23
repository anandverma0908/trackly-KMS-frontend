import React, { useState, useMemo, useRef, useEffect } from "react";
import Tooltip from "@mui/material/Tooltip";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAuthStore } from "@/features/auth/useAuthStore";
import type { Project, ProjectTask, ProjectSprint } from "../spacesData";
import { getPriorityColor, getTaskStatusColor } from "../spacesData";
import CreateTicketDrawer from "@/features/tickets/CreateTicketDrawer";
import {
  createTicket,
  addTicketToSprint,
  removeTicketFromSprint,
  startSprint,
  completeSprint,
  createSprint,
  fetchSprintDraft,
} from "@/services/api";
import type { SprintDraftResult } from "@/services/api";
import type { TicketCreate } from "@/types";
import SideDrawer from "@/components/ui/SideDrawer";
import styles from "./BacklogTab.module.css";

import {
  RiSearchLine,
  RiArrowUpDownLine,
  RiAddLine,
  RiSparklingLine,
  RiCloseLine,
  RiPlayCircleLine,
  RiCheckboxCircleLine,
  RiCalendarLine,
  RiMore2Line,
  RiArrowRightLine,
  RiListCheck2,
  RiArrowGoBackLine,
  RiAlertLine,
  RiCheckLine,
} from "react-icons/ri";

const ISSUE_TYPE_ICONS: Record<string, string> = {
  Story: "🟢",
  Bug: "🔴",
  Task: "🔵",
  Epic: "⚡",
  Subtask: "◾",
};

type SortBy = "priority" | "created" | "updated" | "points" | "key";
const PRIORITY_ORDER = ["Critical", "High", "Medium", "Low"];

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Velocity Ring SVG                                                         */
/* ══════════════════════════════════════════════════════════════════════════ */

function VelocityRing({ done, total, size = 34 }: { done: number; total: number; size?: number }) {
  const r = (size - 5) / 2;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(done / total, 1) : 0;
  const color = pct >= 1 ? "var(--green)" : pct >= 0.5 ? "var(--accent)" : "var(--amber)";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-2)" strokeWidth={3} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={3}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Sprint Health                                                             */
/* ══════════════════════════════════════════════════════════════════════════ */

function computeSprintHealth(sprint: ProjectSprint) {
  if (sprint.status !== "active" || !sprint.startDate || !sprint.endDate) return null;
  const now = new Date();
  const start = new Date(sprint.startDate);
  const end = new Date(sprint.endDate);
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
  const daysElapsed = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / 86_400_000));
  const daysLeft = Math.max(0, totalDays - daysElapsed);
  const done = sprint.donePoints;
  const total = sprint.totalPoints;
  const remaining = total - done;
  const pace = done / daysElapsed;
  const neededPace = daysLeft > 0 ? remaining / daysLeft : remaining > 0 ? 0 : pace;
  const probability = Math.min(100, Math.round((neededPace > 0 ? pace / neededPace : 1) * 100));
  const status = probability >= 80 ? "on-track" : probability >= 50 ? "at-risk" : "behind";
  const color = status === "on-track" ? "var(--green)" : status === "at-risk" ? "var(--amber)" : "var(--red)";
  return { probability, status, color, daysLeft, done, total };
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Main Component                                                            */
/* ══════════════════════════════════════════════════════════════════════════ */

export default function BacklogTab({ project }: { project: Project }) {
  const qc = useQueryClient();
  const userRole = useAuthStore((s) => s.user?.role);
  const canManageSprints = userRole === "admin" || userRole === "engineering_manager" || userRole === "tech_lead";
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("priority");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [createForSprint, setCreateForSprint] = useState<string | undefined>();
  const [localTasks, setLocalTasks] = useState<ProjectTask[]>([]);
  const [viewingTask, setViewingTask] = useState<ProjectTask | null>(null);

  const [startSprintModal, setStartSprintModal] = useState<ProjectSprint | null>(null);
  const [completeSprintModal, setCompleteSprintModal] = useState<ProjectSprint | null>(null);
  const [showCreateSprintModal, setShowCreateSprintModal] = useState(false);

  /* ── EOS Plan Sprint ── */
  const [aiPlanLoading, setAiPlanLoading] = useState(false);
  const [aiPlanResult, setAiPlanResult] = useState<SprintDraftResult | null>(null);

  /* ── Duplicate detection / quick create ── */
  const [quickCreateSprintId, setQuickCreateSprintId] = useState<string | null>(null);
  const [defaultTitle, setDefaultTitle] = useState("");

  /* ── Derived data ── */
  const visibleSprints = useMemo(
    () => project.sprints.filter((s) => s.status !== "completed"),
    [project.sprints],
  );

  const backlogTasks: ProjectTask[] = useMemo(() => {
    const base = project.backlogTasks ?? [];
    return [...localTasks, ...base];
  }, [project.backlogTasks, localTasks]);

  const allTasksPool = useMemo(() => {
    const sprintTasks = project.sprints.flatMap((s) => s.tasks);
    return [...backlogTasks, ...sprintTasks];
  }, [backlogTasks, project.sprints]);

  function filterAndSort(tasks: ProjectTask[]): ProjectTask[] {
    let result = tasks;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.key.toLowerCase().includes(q) ||
          (t.assignee || "").toLowerCase().includes(q),
      );
    }
    return [...result].sort((a, b) => {
      if (sortBy === "priority")
        return PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
      if (sortBy === "points") return b.storyPoints - a.storyPoints;
      if (sortBy === "key") return a.key.localeCompare(b.key);
      return 0;
    });
  }

  /* ── Mutations ── */
  const moveToSprintMut = useMutation({
    mutationFn: ({ sprintId, ticketKey }: { sprintId: string; ticketKey: string }) =>
      addTicketToSprint(sprintId, ticketKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["space-project", project.key] });
      toast.success("Moved to sprint");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveToBacklogMut = useMutation({
    mutationFn: ({ sprintId, ticketKey }: { sprintId: string; ticketKey: string }) =>
      removeTicketFromSprint(sprintId, ticketKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["space-project", project.key] });
      toast.success("Moved to backlog");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startSprintMut = useMutation({
    mutationFn: (id: string) => startSprint(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["space-project", project.key] });
      qc.invalidateQueries({ queryKey: ["sprints"] });
      toast.success("Sprint started! 🚀");
      setStartSprintModal(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const completeSprintMut = useMutation({
    mutationFn: (id: string) => completeSprint(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["space-project", project.key] });
      qc.invalidateQueries({ queryKey: ["sprints"] });
      toast.success("Sprint completed!");
      setCompleteSprintModal(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createSprintMut = useMutation({
    mutationFn: (payload: { name: string; goal: string; start_date: string; end_date: string }) =>
      createSprint({ ...payload, project_id: project.id }),
    onSuccess: async (newSprint) => {
      if (selected.size > 0 && newSprint?.id) {
        const keys = Array.from(selected);
        await Promise.all(keys.map((k) => addTicketToSprint(newSprint.id, k)));
        setSelected(new Set());
        toast.success(`Sprint created with ${keys.length} issue${keys.length > 1 ? "s" : ""}!`);
      } else {
        toast.success("Sprint created!");
      }
      qc.invalidateQueries({ queryKey: ["space-project", project.key] });
      qc.invalidateQueries({ queryKey: ["sprints"] });
      setShowCreateSprintModal(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createMut = useMutation({
    mutationFn: createTicket,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["space-project", project.key] });
      qc.invalidateQueries({ queryKey: ["kanban-tickets"] });
      toast.success("Ticket created!");
      setShowCreateDrawer(false);
      setCreateForSprint(undefined);
      setTimeout(() => setLocalTasks([]), 400);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setLocalTasks([]);
    },
  });

  /* ── Handlers ── */
  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelect(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function handleBulkMoveToSprint(sprintId: string) {
    if (selected.size === 0) return;
    const keys = Array.from(selected);
    Promise.all(keys.map((k) => addTicketToSprint(sprintId, k)))
      .then(() => {
        qc.invalidateQueries({ queryKey: ["space-project", project.key] });
        toast.success(`Moved ${keys.length} ticket${keys.length > 1 ? "s" : ""} to sprint`);
        setSelected(new Set());
      })
      .catch((e) => toast.error(e.message));
  }

  async function handleEosPlanSprint() {
    setAiPlanLoading(true);
    setAiPlanResult(null);
    try {
      const result = await fetchSprintDraft(project.key);
      setAiPlanResult(result);
    } catch {
      toast.error("EOS sprint planning failed");
    } finally {
      setAiPlanLoading(false);
    }
  }

  const totalBacklogSP = backlogTasks.reduce((s, t) => s + t.storyPoints, 0);

  return (
    <div className={styles.tab}>

      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <RiSearchLine size={14} style={{ opacity: 0.4, flexShrink: 0 }} />
          <input
            className={styles.searchInput}
            placeholder="Search tickets, keys, assignees…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className={styles.clearBtn} onClick={() => setSearch("")}>
              ✕
            </button>
          )}
        </div>

        <div className={styles.toolbarRight}>
          <div className={styles.sortWrap}>
            <RiArrowUpDownLine size={12} style={{ opacity: 0.5 }} />
            <select
              className={styles.select}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
            >
              <option value="priority">Priority</option>
              <option value="points">Story Points</option>
              <option value="key">Key</option>
            </select>
          </div>

          {selected.size > 0 && visibleSprints.length > 0 && (
            <div className={styles.sortWrap}>
              <select
                className={styles.select}
                value=""
                onChange={(e) => handleBulkMoveToSprint(e.target.value)}
              >
                <option value="">Move {selected.size} to sprint…</option>
                {visibleSprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            className={styles.eosBtn}
            onClick={handleEosPlanSprint}
            disabled={aiPlanLoading}
          >
            {aiPlanLoading ? (
              <><span className={styles.spinner} /> Planning…</>
            ) : (
              <><RiSparklingLine size={13} /> EOS Plan Sprint</>
            )}
          </button>
        </div>
      </div>

      {/* ── Sprint Sections ── */}
      <div className={styles.boardContainer}>

        {visibleSprints.length === 0 && (
          <div className={styles.emptySprintsHint}>
            <RiListCheck2 size={28} style={{ opacity: 0.25 }} />
            <p>No active sprints yet. Create a sprint to start planning.</p>
          </div>
        )}

        {visibleSprints.map((sprint) => {
          const tasks = filterAndSort(sprint.tasks);
          const isCollapsed = collapsed.has(sprint.id);
          return (
            <div key={sprint.id} className={styles.sprintSection}>

              {/* ── Sprint Header ── */}
              <div className={styles.sprintHeader}>

                {/* Left: collapse + name + meta */}
                <div className={styles.sprintHeaderLeft}>
                  <button
                    className={styles.sprintCollapseBtn}
                    onClick={() => toggleCollapse(sprint.id)}
                  >
                    <span
                      className={styles.collapseArrow}
                      style={{ transform: isCollapsed ? "rotate(-90deg)" : "none" }}
                    >
                      ▾
                    </span>
                  </button>
                  <div className={styles.sprintHeaderInfo}>
                    <div className={styles.sprintTitleRow}>
                      <span className={styles.sprintName}>{sprint.name}</span>
                      <span
                        className={`${styles.sprintStatusBadge} ${
                          sprint.status === "active" ? styles.badgeActive : styles.badgePlanning
                        }`}
                      >
                        {sprint.status === "active" ? "Active" : "Planning"}
                      </span>
                      {sprint.goal && (
                        <span className={styles.sprintGoal} title={sprint.goal}>
                          {sprint.goal.length > 55 ? sprint.goal.slice(0, 55) + "…" : sprint.goal}
                        </span>
                      )}
                    </div>
                    <div className={styles.sprintMeta}>
                      <span className={styles.sprintIssueCount}>
                        {sprint.tasks.length} issue{sprint.tasks.length !== 1 ? "s" : ""}
                      </span>
                      {(sprint.startDate || sprint.endDate) && (
                        <>
                          <span className={styles.metaDivider}>·</span>
                          <span className={styles.sprintDates}>
                            <RiCalendarLine size={10} />
                            {sprint.startDate
                              ? new Date(sprint.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                              : "—"}
                            {" – "}
                            {sprint.endDate
                              ? new Date(sprint.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                              : "—"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Center: EOS health (active) or velocity ring (planning) */}
                {(() => {
                  const health = computeSprintHealth(sprint);
                  if (health) {
                    return (
                      <div className={styles.sprintHeaderCenter}>
                        <VelocityRing done={sprint.donePoints} total={sprint.totalPoints} />
                        <div className={styles.healthInfo}>
                          <div className={styles.healthTopRow}>
                            <span className={styles.healthProb} style={{ color: health.color }}>
                              {health.probability}%
                            </span>
                            <span
                              className={styles.healthBadge}
                              style={{ color: health.color, background: `${health.color}18`, border: `1px solid ${health.color}33` }}
                            >
                              {health.status === "on-track"
                                ? <><RiCheckLine size={9} /> On Track</>
                                : health.status === "at-risk"
                                ? <><RiAlertLine size={9} /> At Risk</>
                                : <><RiAlertLine size={9} /> Behind</>}
                            </span>
                          </div>
                          <span className={styles.healthMeta}>
                            {health.done}/{health.total} pts · {health.daysLeft}d left
                          </span>
                        </div>
                      </div>
                    );
                  }
                  if (sprint.totalPoints > 0) {
                    return (
                      <div className={styles.sprintHeaderCenter}>
                        <VelocityRing done={sprint.donePoints} total={sprint.totalPoints} />
                        <div className={styles.velocityLabel}>
                          <span className={styles.velocityDone}>{sprint.donePoints}</span>
                          <span className={styles.velocityTotal}>/{sprint.totalPoints} pts</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Right: action buttons */}
                <div className={styles.sprintActions}>
                  {canManageSprints && sprint.status === "planning" && (
                    <button
                      className={styles.startSprintBtn}
                      onClick={() => setStartSprintModal(sprint)}
                    >
                      <RiPlayCircleLine size={13} />
                      Start Sprint
                    </button>
                  )}
                  {canManageSprints && sprint.status === "active" && (
                    <button
                      className={styles.completeSprintBtn}
                      onClick={() => setCompleteSprintModal(sprint)}
                    >
                      <RiCheckboxCircleLine size={13} />
                      Complete Sprint
                    </button>
                  )}
                </div>
              </div>

              {/* ── Sprint Table ── */}
              {!isCollapsed && (
                <div className={styles.sectionTable}>
                  <TableHeader />
                  <div className={styles.rows}>
                    {tasks.length === 0 ? (
                      <div className={styles.emptyRows}>
                        No issues in this sprint.{" "}
                        <span
                          className={styles.emptyRowsLink}
                          onClick={() => {
                            setCreateForSprint(sprint.id);
                            setShowCreateDrawer(true);
                          }}
                        >
                          Add one
                        </span>
                      </div>
                    ) : (
                      tasks.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          selected={selected.has(task.key)}
                          onSelect={() => toggleSelect(task.key)}
                          sprints={visibleSprints}
                          currentSprintId={sprint.id}
                          onMoveToSprint={(sid) =>
                            moveToSprintMut.mutate({ sprintId: sid, ticketKey: task.key })
                          }
                          onMoveToBacklog={() =>
                            moveToBacklogMut.mutate({ sprintId: sprint.id, ticketKey: task.key })
                          }
                          onClick={() => setViewingTask(task)}
                        />
                      ))
                    )}
                    {quickCreateSprintId === sprint.id ? (
                      <QuickCreateRow
                        allTasks={allTasksPool}
                        onConfirm={(title) => {
                          setDefaultTitle(title);
                          setCreateForSprint(sprint.id);
                          setShowCreateDrawer(true);
                          setQuickCreateSprintId(null);
                        }}
                        onCancel={() => setQuickCreateSprintId(null)}
                      />
                    ) : (
                      <div
                        className={styles.addRow}
                        onClick={() => setQuickCreateSprintId(sprint.id)}
                      >
                        <RiAddLine size={12} color="var(--text-3)" />
                        <span className={styles.addRowText}>Create issue</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* ── Backlog Section ── */}
        <div className={`${styles.sprintSection} ${styles.backlogSection}`}>
          <div className={`${styles.sprintHeader} ${styles.backlogHeader}`}>
            <div className={styles.sprintHeaderLeft}>
              <button
                className={styles.sprintCollapseBtn}
                onClick={() => toggleCollapse("backlog")}
              >
                <span
                  className={styles.collapseArrow}
                  style={{ transform: collapsed.has("backlog") ? "rotate(-90deg)" : "none" }}
                >
                  ▾
                </span>
              </button>
              <div className={styles.sprintHeaderInfo}>
                <div className={styles.sprintTitleRow}>
                  <span className={styles.sprintName}>Backlog</span>
                  <span className={styles.sprintIssueCount}>
                    {backlogTasks.length} issue{backlogTasks.length !== 1 ? "s" : ""}
                  </span>
                  {totalBacklogSP > 0 && (
                    <>
                      <span className={styles.metaDivider}>·</span>
                      <span className={styles.sprintPoints}>{totalBacklogSP} pts</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.sprintActions}>
              {canManageSprints && (
                <button
                  className={styles.createSprintBtn}
                  onClick={() => setShowCreateSprintModal(true)}
                >
                  <RiAddLine size={13} />
                  Create Sprint
                </button>
              )}
            </div>
          </div>

          {!collapsed.has("backlog") && (
            <div className={styles.sectionTable}>
              <TableHeader />
              <div className={styles.rows}>
                {filterAndSort(backlogTasks).length === 0 ? (
                  <div className={styles.emptyRows}>
                    Backlog is empty.{" "}
                    <span
                      className={styles.emptyRowsLink}
                      onClick={() => {
                        setCreateForSprint(undefined);
                        setShowCreateDrawer(true);
                      }}
                    >
                      Create an issue
                    </span>
                  </div>
                ) : (
                  filterAndSort(backlogTasks).map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      selected={selected.has(task.key)}
                      onSelect={() => toggleSelect(task.key)}
                      sprints={visibleSprints}
                      currentSprintId={undefined}
                      onMoveToSprint={(sid) =>
                        moveToSprintMut.mutate({ sprintId: sid, ticketKey: task.key })
                      }
                      onMoveToBacklog={undefined}
                      onClick={() => setViewingTask(task)}
                      isBacklog
                    />
                  ))
                )}
                {quickCreateSprintId === "backlog" ? (
                  <QuickCreateRow
                    allTasks={allTasksPool}
                    onConfirm={(title) => {
                      setDefaultTitle(title);
                      setCreateForSprint(undefined);
                      setShowCreateDrawer(true);
                      setQuickCreateSprintId(null);
                    }}
                    onCancel={() => setQuickCreateSprintId(null)}
                  />
                ) : (
                  <div
                    className={styles.addRow}
                    onClick={() => setQuickCreateSprintId("backlog")}
                  >
                    <RiAddLine size={12} color="var(--text-3)" />
                    <span className={styles.addRowText}>Create issue</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {startSprintModal && (
        <StartSprintModal
          sprint={startSprintModal}
          onClose={() => setStartSprintModal(null)}
          onConfirm={(id) => startSprintMut.mutate(id)}
          isLoading={startSprintMut.isPending}
        />
      )}

      {completeSprintModal && (
        <CompleteSprintModal
          sprint={completeSprintModal}
          onClose={() => setCompleteSprintModal(null)}
          onConfirm={(id) => completeSprintMut.mutate(id)}
          isLoading={completeSprintMut.isPending}
        />
      )}

      {showCreateSprintModal && (
        <CreateSprintModal
          onClose={() => setShowCreateSprintModal(false)}
          onConfirm={(payload) => createSprintMut.mutate(payload)}
          isLoading={createSprintMut.isPending}
          sprintNumber={project.sprints.length + 1}
        />
      )}

      {/* ── Ticket Detail Drawer ── */}
      {viewingTask && (
        <CreateTicketDrawer
          open={Boolean(viewingTask)}
          onClose={() => setViewingTask(null)}
          ticketKey={viewingTask.key}
          defaultPod={project.key}
          initialData={{
            title: viewingTask.title,
            description: viewingTask.description,
            issue_type: viewingTask.type,
            priority: viewingTask.priority,
            status: viewingTask.status,
            assignee: viewingTask.assignee,
            story_points: viewingTask.storyPoints,
            labels: viewingTask.labels,
            due_date: viewingTask.dueDate,
            pod: project.key,
          }}
          members={project.members}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["space-project", project.key] });
          }}
        />
      )}

      {/* ── Create Ticket Drawer ── */}
      <CreateTicketDrawer
        open={showCreateDrawer}
        onClose={() => {
          setShowCreateDrawer(false);
          setCreateForSprint(undefined);
          setDefaultTitle("");
        }}
        initialData={defaultTitle ? { title: defaultTitle } : undefined}
        defaultStatus="To Do"
        defaultPod={project.key}
        members={project.members}
        onCreated={(data) => {
          const payload: TicketCreate = {
            title: data.title || "",
            description: data.description || "",
            issue_type: data.issue_type || "Task",
            priority: data.priority || "Medium",
            assignee: data.assignee,
            pod: project.key,
            story_points: data.story_points ? Number(data.story_points) : undefined,
            labels: data.labels,
            status: data.status || "To Do",
            sprint_id: createForSprint,
          };
          const tempTask: ProjectTask = {
            id: `local-${Date.now()}`,
            key: `${project.key}-L${Date.now() % 1000}`,
            title: payload.title,
            status: _normalizeStatus(payload.status) as ProjectTask["status"],
            priority: (payload.priority || "Medium") as ProjectTask["priority"],
            type: _normalizeType(payload.issue_type) as ProjectTask["type"],
            assignee: payload.assignee || project.members[0]?.name || "",
            assigneeInitials: _initials(payload.assignee || project.members[0]?.name),
            assigneeColor: _hashColor(payload.assignee || project.members[0]?.name || ""),
            storyPoints: payload.story_points || 0,
            createdAt: new Date().toISOString().split("T")[0],
            updatedAt: new Date().toISOString().split("T")[0],
            labels: payload.labels || [],
          };
          setLocalTasks((prev) => [...prev, tempTask]);
          createMut.mutate(payload);
        }}
      />

      {/* ── EOS Plan Sprint Drawer ── */}
      <SideDrawer
        open={!!aiPlanResult}
        onClose={() => setAiPlanResult(null)}
        size="sm"
        title="EOS Sprint Plan"
        avatar={<RiSparklingLine size={18} color="var(--accent)" />}
        badge={aiPlanResult ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {aiPlanResult.nova_powered
              ? <span className={styles.novaPoweredBadge}>AI</span>
              : <span className={styles.novaFallbackBadge}>Deterministic</span>}
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>
              {aiPlanResult.tickets.length} tickets · {aiPlanResult.total_points} pts
            </span>
          </div>
        ) : undefined}
      >
        {aiPlanResult && (
          <>
            {aiPlanResult.rationale && (
              <p className={styles.eosDrawerRationale}>{aiPlanResult.rationale}</p>
            )}
            <div className={styles.eosDrawerTickets}>
              {aiPlanResult.tickets.map((t) => {
                const dotColor =
                  t.priority === "Critical" || t.priority === "Highest"
                    ? "var(--red)"
                    : t.priority === "High"
                    ? "var(--amber)"
                    : "var(--accent)";
                return (
                  <div key={t.key} className={styles.eosTicket}>
                    <div className={styles.eosTicketTop}>
                      <span className={styles.eosTicketKey}>{t.key}</span>
                      <span className={styles.eosTicketDot} style={{ background: dotColor }} title={t.priority} />
                      <span className={styles.eosTicketTitle}>{t.summary}</span>
                      <span className={styles.eosTicketSP}>{t.suggested_points}pt</span>
                    </div>
                    {t.rationale && (
                      <p className={styles.eosTicketReason}>{t.rationale}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </SideDrawer>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Table Header                                                              */
/* ══════════════════════════════════════════════════════════════════════════ */

function TableHeader() {
  return (
    <div className={styles.tableHeader}>
      <div className={styles.thCheck} />
      <div className={styles.thKey}>Key</div>
      <div className={styles.thTitle}>Summary</div>
      <div className={styles.thStatus}>Status</div>
      <div className={styles.thAssignee}>Assignee</div>
      <div className={styles.thSP}>SP</div>
      <div className={styles.thDue}>Due</div>
      <div className={styles.thAction} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Task Row                                                                  */
/* ══════════════════════════════════════════════════════════════════════════ */

const TaskRow = React.memo(function TaskRow({
  task,
  selected,
  onSelect,
  sprints,
  currentSprintId,
  onMoveToSprint,
  onMoveToBacklog,
  onClick,
  isBacklog,
}: {
  task: ProjectTask;
  selected: boolean;
  onSelect: () => void;
  sprints: ProjectSprint[];
  currentSprintId: string | undefined;
  onMoveToSprint: (sprintId: string) => void;
  onMoveToBacklog: (() => void) | undefined;
  onClick?: () => void;
  isBacklog?: boolean;
}) {
  const priorityColor = getPriorityColor(task.priority);
  const statusColor = getTaskStatusColor(task.status);
  const staleDays = _daysSince(task.updatedAt);
  const isStale = staleDays >= 30;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [menuOpen]);

  const otherSprints = sprints.filter((s) => s.id !== currentSprintId);

  return (
    <div
      className={`${styles.row} ${selected ? styles.rowSelected : ""} ${menuOpen ? styles.rowMenuOpen : ""} ${isStale && isBacklog ? styles.rowStale : ""}`}
      style={{ "--priority-color": priorityColor } as React.CSSProperties}
      onClick={onClick}
    >
      <div className={styles.tdCheck} onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={selected}
          onChange={onSelect}
        />
      </div>
      <div className={styles.tdKey}>
        <span className={styles.keyBadge}>{task.key}</span>
      </div>
      <div className={styles.tdTitle}>
        <span className={styles.issueTypeIcon}>{ISSUE_TYPE_ICONS[task.type] ?? "🔵"}</span>
        <span className={styles.titleText}>{task.title}</span>
        {isStale && (
          <span className={styles.staleBadge} title={`No updates in ${staleDays} days`}>
            <RiAlertLine size={9} /> {staleDays}d
          </span>
        )}
        {task.labels?.map((l) => (
          <span key={l} className={styles.labelTag}>{l}</span>
        ))}
      </div>
      <div className={styles.tdStatus}>
        <span
          className={styles.statusChip}
          style={{
            color: statusColor,
            background: `${statusColor}18`,
            border: `1px solid ${statusColor}33`,
          }}
        >
          {task.status}
        </span>
      </div>
      <div className={styles.tdAssignee}>
        <Tooltip title={task.assignee} arrow>
          <div className={styles.assigneeAvatar} style={{ background: task.assigneeColor }}>
            {task.assigneeInitials}
          </div>
        </Tooltip>
      </div>
      <div className={styles.tdSP}>
        <span className={styles.spBadge}>{task.storyPoints || "—"}</span>
      </div>
      <div className={styles.tdDue}>
        {task.dueDate ? (
          <span
            className={styles.dueDate}
            style={{
              color: new Date(task.dueDate) < new Date() ? "var(--red)" : "var(--text-2)",
            }}
          >
            {new Date(task.dueDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        ) : (
          <span className={styles.noDue}>—</span>
        )}
      </div>

      {/* Actions dropdown */}
      <div
        className={styles.tdAction}
        ref={menuRef}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className={styles.actionMenuBtn}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <RiMore2Line size={14} />
        </button>
        {menuOpen && (
          <div className={styles.actionMenu}>
            {otherSprints.length > 0 && (
              <>
                <div className={styles.menuLabel}>Move to sprint</div>
                {otherSprints.map((s) => (
                  <button
                    key={s.id}
                    className={styles.menuItem}
                    onClick={() => {
                      onMoveToSprint(s.id);
                      setMenuOpen(false);
                    }}
                  >
                    <RiArrowRightLine size={12} />
                    {s.name}
                  </button>
                ))}
                {onMoveToBacklog && <div className={styles.menuDivider} />}
              </>
            )}
            {onMoveToBacklog && (
              <button
                className={styles.menuItem}
                onClick={() => {
                  onMoveToBacklog();
                  setMenuOpen(false);
                }}
              >
                <RiArrowGoBackLine size={12} />
                Send to Backlog
              </button>
            )}
            {otherSprints.length === 0 && !onMoveToBacklog && (
              <div className={styles.menuEmpty}>No actions available</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Quick Create Row                                                          */
/* ══════════════════════════════════════════════════════════════════════════ */

function QuickCreateRow({
  allTasks,
  onConfirm,
  onCancel,
}: {
  allTasks: ProjectTask[];
  onConfirm: (title: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const duplicates = useMemo(() => _findDuplicates(title, allTasks), [title, allTasks]);

  return (
    <div className={styles.quickCreateWrap}>
      <div className={styles.quickCreateInputRow}>
        <RiAddLine size={13} color="var(--accent)" style={{ flexShrink: 0 }} />
        <input
          ref={inputRef}
          className={styles.quickCreateInput}
          placeholder="Issue title… (Enter to open, Esc to cancel)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && title.trim()) onConfirm(title.trim());
            if (e.key === "Escape") onCancel();
          }}
        />
        {title.trim() && (
          <button className={styles.quickCreateBtn} onClick={() => onConfirm(title.trim())}>
            Create →
          </button>
        )}
        <button className={styles.quickCreateCancel} onClick={onCancel}>✕</button>
      </div>
      {duplicates.length > 0 && (
        <div className={styles.dupeBanner}>
          <RiAlertLine size={11} style={{ flexShrink: 0 }} />
          <span className={styles.dupeBannerLabel}>Similar tickets already exist:</span>
          {duplicates.map((d) => (
            <span key={d.key} className={styles.dupeChip}>
              <span className={styles.dupeKey}>{d.key}</span>
              {d.title.length > 45 ? d.title.slice(0, 45) + "…" : d.title}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Start Sprint Modal                                                        */
/* ══════════════════════════════════════════════════════════════════════════ */

function StartSprintModal({
  sprint,
  onClose,
  onConfirm,
  isLoading,
}: {
  sprint: ProjectSprint;
  onClose: () => void;
  onConfirm: (id: string) => void;
  isLoading: boolean;
}) {
  const today = new Date().toISOString().split("T")[0];
  const twoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
  const [name, setName] = useState(sprint.name);
  const [goal, setGoal] = useState(sprint.goal || "");
  const [startDate, setStartDate] = useState(sprint.startDate || today);
  const [endDate, setEndDate] = useState(sprint.endDate || twoWeeks);
  const issueCount = sprint.tasks.length;
  const totalSP = sprint.tasks.reduce((s, t) => s + t.storyPoints, 0);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Start Sprint</h2>
          <button className={styles.modalClose} onClick={onClose}>
            <RiCloseLine size={18} />
          </button>
        </div>

        <div className={styles.modalSummary}>
          <span className={styles.summaryStat}>
            <strong>{issueCount}</strong> issue{issueCount !== 1 ? "s" : ""}
          </span>
          <span className={styles.summaryStat}>
            <strong>{totalSP}</strong> story points
          </span>
        </div>

        <div className={styles.modalBody}>
          <label className={styles.formLabel}>Sprint Name</label>
          <input
            className={styles.formInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label className={styles.formLabel}>Sprint Goal <span className={styles.optional}>(optional)</span></label>
          <textarea
            className={styles.formTextarea}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="What is the team trying to achieve in this sprint?"
            rows={3}
          />

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Start Date</label>
              <input
                type="date"
                className={styles.formInput}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>End Date</label>
              <input
                type="date"
                className={styles.formInput}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button
            className={styles.primaryBtn}
            onClick={() => onConfirm(sprint.id)}
            disabled={isLoading}
          >
            {isLoading ? (
              <><span className={styles.spinner} /> Starting…</>
            ) : (
              <><RiPlayCircleLine size={14} /> Start Sprint</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Complete Sprint Modal                                                     */
/* ══════════════════════════════════════════════════════════════════════════ */

function CompleteSprintModal({
  sprint,
  onClose,
  onConfirm,
  isLoading,
}: {
  sprint: ProjectSprint;
  onClose: () => void;
  onConfirm: (id: string) => void;
  isLoading: boolean;
}) {
  const doneCount = sprint.tasks.filter((t) => t.status === "Done").length;
  const incompleteCount = sprint.tasks.length - doneCount;
  const donePts = sprint.donePoints;
  const totalPts = sprint.totalPoints;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Complete Sprint</h2>
          <button className={styles.modalClose} onClick={onClose}>
            <RiCloseLine size={18} />
          </button>
        </div>

        <div className={styles.completeSprintStats}>
          <div className={styles.completeStat}>
            <span className={styles.completeStatNum} style={{ color: "var(--green)" }}>
              {doneCount}
            </span>
            <span className={styles.completeStatLbl}>Done</span>
          </div>
          <div className={styles.completeStat}>
            <span className={styles.completeStatNum} style={{ color: "var(--amber)" }}>
              {incompleteCount}
            </span>
            <span className={styles.completeStatLbl}>Incomplete</span>
          </div>
          <div className={styles.completeStat}>
            <span className={styles.completeStatNum}>
              {donePts}/{totalPts}
            </span>
            <span className={styles.completeStatLbl}>Pts done</span>
          </div>
        </div>

        {incompleteCount > 0 && (
          <div className={styles.incompleteNotice}>
            <RiArrowGoBackLine size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              <strong>{incompleteCount}</strong> incomplete issue{incompleteCount !== 1 ? "s" : ""} will be
              moved to the <strong>Backlog</strong> automatically.
            </span>
          </div>
        )}

        {incompleteCount === 0 && (
          <div className={styles.allDoneNotice}>
            All issues are done. Great sprint!
          </div>
        )}

        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button
            className={styles.completeBtn}
            onClick={() => onConfirm(sprint.id)}
            disabled={isLoading}
          >
            {isLoading ? (
              <><span className={styles.spinner} /> Completing…</>
            ) : (
              <><RiCheckboxCircleLine size={14} /> Complete Sprint</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Create Sprint Modal                                                       */
/* ══════════════════════════════════════════════════════════════════════════ */

function CreateSprintModal({
  onClose,
  onConfirm,
  isLoading,
  sprintNumber,
}: {
  onClose: () => void;
  onConfirm: (p: { name: string; goal: string; start_date: string; end_date: string }) => void;
  isLoading: boolean;
  sprintNumber: number;
}) {
  const today = new Date().toISOString().split("T")[0];
  const twoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
  const [name, setName] = useState(`Sprint ${sprintNumber}`);
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(twoWeeks);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Create Sprint</h2>
          <button className={styles.modalClose} onClick={onClose}>
            <RiCloseLine size={18} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <label className={styles.formLabel}>Sprint Name</label>
          <input
            className={styles.formInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label className={styles.formLabel}>Sprint Goal <span className={styles.optional}>(optional)</span></label>
          <textarea
            className={styles.formTextarea}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="What is the team trying to achieve in this sprint?"
            rows={3}
          />

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Start Date</label>
              <input
                type="date"
                className={styles.formInput}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>End Date</label>
              <input
                type="date"
                className={styles.formInput}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button
            className={styles.primaryBtn}
            onClick={() => onConfirm({ name, goal, start_date: startDate, end_date: endDate })}
            disabled={isLoading || !name.trim()}
          >
            {isLoading ? (
              <><span className={styles.spinner} /> Creating…</>
            ) : (
              <><RiAddLine size={14} /> Create Sprint</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Utils                                                                     */
/* ══════════════════════════════════════════════════════════════════════════ */

function _daysSince(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000));
}

function _findDuplicates(title: string, tasks: ProjectTask[]): ProjectTask[] {
  if (title.trim().length < 3) return [];
  const words = title.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  return tasks
    .filter((t) => words.some((w) => t.title.toLowerCase().includes(w)))
    .slice(0, 3);
}

function _normalizeStatus(s: string | undefined): string {
  if (!s) return "To Do";
  const l = s.toLowerCase();
  if (["done", "closed", "resolved"].includes(l)) return "Done";
  if (l === "blocked") return "Blocked";
  if (l.includes("review") || l.includes("qa")) return "In Review";
  if (l.includes("progress") || l.includes("development")) return "In Progress";
  return "To Do";
}
function _normalizeType(t: string | undefined): string {
  if (!t) return "Task";
  const l = t.toLowerCase();
  if (l.includes("bug")) return "Bug";
  if (l.includes("story")) return "Story";
  if (l.includes("epic")) return "Epic";
  if (l.includes("subtask")) return "Subtask";
  return "Task";
}
function _initials(name: string | undefined): string {
  if (!name) return "??";
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}
function _hashColor(name: string): string {
  const COLORS = [
    "linear-gradient(135deg,#4F7EFF,#818CF8)",
    "linear-gradient(135deg,#34D399,#10B981)",
    "linear-gradient(135deg,#FBBF24,#F59E0B)",
    "linear-gradient(135deg,#F87171,#FCA5A5)",
    "linear-gradient(135deg,#A78BFA,#C4B5FD)",
    "linear-gradient(135deg,#22D3EE,#67E8F9)",
    "linear-gradient(135deg,#64748B,#94A3B8)",
    "linear-gradient(135deg,#FB923C,#FDBA74)",
  ];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return COLORS[Math.abs(h) % COLORS.length];
}
