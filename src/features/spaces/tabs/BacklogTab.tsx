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
  deleteSprint,
  fetchSprintDraft,
  updateTicket,
  updateTicketStatus,
  /* createSavedFilter, */
} from "@/services/api";
import type { SprintDraftResult } from "@/services/api";
import type { TicketCreate } from "@/types";
import SideDrawer from "@/components/ui/SideDrawer";
import { IssueTypeBadge } from "@/components/ui/Badge";
import styles from "./BacklogTab.module.css";

import {
  RiSearchLine,
  RiArrowUpDownLine,
  RiAddLine,
  RiSparklingLine,
  RiCloseLine,
  RiPlayCircleLine,
  RiCheckboxCircleLine,
  RiMore2Line,
  RiArrowRightLine,
  RiListCheck2,
  RiArrowGoBackLine,
  RiAlertLine,
  RiCloseCircleLine,
  RiArrowDownSLine,
} from "react-icons/ri";

type SortBy = "priority" | "created" | "updated" | "points" | "key";
const PRIORITY_ORDER = ["Critical", "High", "Medium", "Low"];

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Main Component                                                            */
/* ══════════════════════════════════════════════════════════════════════════ */

export default function BacklogTab({ project }: { project: Project }) {
  const qc = useQueryClient();
  const userRole = useAuthStore((s) => s.user?.role);
  const canManageSprints =
    userRole === "admin" ||
    userRole === "engineering_manager" ||
    userRole === "tech_lead";
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("priority");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [createForSprint, setCreateForSprint] = useState<string | undefined>();
  const [localTasks, setLocalTasks] = useState<ProjectTask[]>([]);
  const [movingTicketKey, setMovingTicketKey] = useState<string | null>(null);
  const [viewingTask, setViewingTask] = useState<ProjectTask | null>(null);
  /* const [showSaveFilter, setShowSaveFilter] = useState(false);
  const [filterName, setFilterName] = useState(""); */

  const [confirmDeleteSprintId, setConfirmDeleteSprintId] = useState<
    string | null
  >(null);
  const [startSprintModal, setStartSprintModal] =
    useState<ProjectSprint | null>(null);
  const [completeSprintModal, setCompleteSprintModal] =
    useState<ProjectSprint | null>(null);
  const [showCreateSprintModal, setShowCreateSprintModal] = useState(false);

  /* ── EOS Plan Sprint ── */
  const [aiPlanLoading, setAiPlanLoading] = useState(false);
  const [aiPlanResult, setAiPlanResult] = useState<SprintDraftResult | null>(
    null,
  );
  const [aiPlanError, setAiPlanError] = useState(false);

  const confirmEosMut = useMutation({
    mutationFn: () => {
      if (!aiPlanResult) throw new Error("No plan to confirm");
      const today = new Date().toISOString().split("T")[0];
      const twoWeeks = new Date(Date.now() + 14 * 86400000)
        .toISOString()
        .split("T")[0];
      return createSprint({
        name: `Sprint ${project.sprints.length + 1}`,
        start_date: today,
        end_date: twoWeeks,
        project_id: project.id,
        ticket_keys: aiPlanResult.tickets.map((t) => t.key),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["space-project", project.key] });
      qc.invalidateQueries({ queryKey: ["sprints"] });
      toast.success("Sprint created from EOS plan!");
      setAiPlanResult(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* ── Duplicate detection / quick create ── */
  const [quickCreateSprintId, setQuickCreateSprintId] = useState<string | null>(
    null,
  );
  const [defaultTitle, setDefaultTitle] = useState("");

  /* ── Derived data ── */
  const visibleSprints = useMemo(
    () => project.sprints.filter((s) => s.status !== "completed"),
    [project.sprints],
  );

  // Clear stale delete confirmation if the sprint is no longer visible (BUG-R5)
  useEffect(() => {
    if (
      confirmDeleteSprintId &&
      !visibleSprints.some((s) => s.id === confirmDeleteSprintId)
    ) {
      setConfirmDeleteSprintId(null);
    }
  }, [visibleSprints, confirmDeleteSprintId]);

  // Escape key dismisses inline delete confirm (BUG-R4)
  useEffect(() => {
    if (!confirmDeleteSprintId) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setConfirmDeleteSprintId(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmDeleteSprintId]);

  const backlogTasks: ProjectTask[] = useMemo(() => {
    const base = project.backlogTasks ?? [];
    return [...localTasks, ...base];
  }, [project.backlogTasks, localTasks]);

  // Use only active/planning sprints for duplicate detection — completed sprints cause false positives (BUG-10)
  const allTasksPool = useMemo(() => {
    const sprintTasks = visibleSprints.flatMap((s) => s.tasks);
    return [...backlogTasks, ...sprintTasks];
  }, [backlogTasks, visibleSprints]);

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
        return (
          PRIORITY_ORDER.indexOf(a.priority) -
          PRIORITY_ORDER.indexOf(b.priority)
        );
      if (sortBy === "points") return b.storyPoints - a.storyPoints;
      if (sortBy === "key") return a.key.localeCompare(b.key);
      return 0;
    });
  }

  /* ── Mutations ── */
  const moveToSprintMut = useMutation({
    mutationFn: ({
      sprintId,
      ticketKey,
    }: {
      sprintId: string;
      ticketKey: string;
    }) => {
      setMovingTicketKey(ticketKey);
      return addTicketToSprint(sprintId, ticketKey);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["space-project", project.key] });
      toast.success("Moved to sprint");
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setMovingTicketKey(null),
  });

  const moveToBacklogMut = useMutation({
    mutationFn: ({
      sprintId,
      ticketKey,
    }: {
      sprintId: string;
      ticketKey: string;
    }) => {
      setMovingTicketKey(ticketKey);
      return removeTicketFromSprint(sprintId, ticketKey);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["space-project", project.key] });
      toast.success("Moved to backlog");
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setMovingTicketKey(null),
  });

  const startSprintMut = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: {
        name: string;
        goal: string;
        start_date: string;
        end_date: string;
      };
    }) => startSprint(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["space-project", project.key] });
      qc.invalidateQueries({ queryKey: ["sprints"] });
      toast.success("Sprint started!");
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

  const deleteSprintMut = useMutation({
    mutationFn: (id: string) => deleteSprint(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["space-project", project.key] });
      qc.invalidateQueries({ queryKey: ["sprints"] });
      toast.success("Sprint deleted");
      setConfirmDeleteSprintId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createSprintMut = useMutation({
    mutationFn: (payload: {
      name: string;
      goal: string;
      start_date: string;
      end_date: string;
    }) => createSprint({ ...payload, project_id: project.id }),
    onSuccess: async (newSprint) => {
      if (selected.size > 0 && newSprint?.id) {
        const keys = Array.from(selected);
        // Use allSettled so a partial failure doesn't hide the sprint creation (BUG-04)
        const results = await Promise.allSettled(
          keys.map((k) => addTicketToSprint(newSprint.id, k)),
        );
        const failed = results.filter((r) => r.status === "rejected").length;
        setSelected(new Set());
        if (failed > 0) {
          toast.error(
            `Sprint created, but ${failed} ticket${failed > 1 ? "s" : ""} failed to assign`,
          );
        } else {
          toast.success(
            `Sprint created with ${keys.length} issue${keys.length > 1 ? "s" : ""}!`,
          );
        }
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
      toast.success("Ticket created!");
      setShowCreateDrawer(false);
      setCreateForSprint(undefined);
      // Clear optimistic task after re-fetch; .finally ensures cleanup even if re-fetch fails (BUG-R1)
      qc.invalidateQueries({
        queryKey: ["space-project", project.key],
      }).finally(() => setLocalTasks([]));
      qc.invalidateQueries({ queryKey: ["kanban-tickets"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setLocalTasks([]);
    },
  });

  /* saved filter — re-enable when UI is added
  const saveFilterMut = useMutation({
    mutationFn: (name: string) =>
      createSavedFilter({
        name,
        filters: { search, sortBy, pod: project.key },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-filters"] });
      toast.success("Filter saved");
      setShowSaveFilter(false);
      setFilterName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  */

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

  async function handleBulkMoveToSprint(sprintId: string) {
    if (!sprintId || selected.size === 0) return;
    const keys = Array.from(selected);
    const results = await Promise.allSettled(
      keys.map((k) => addTicketToSprint(sprintId, k)),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    const ok = keys.length - failed;
    qc.invalidateQueries({ queryKey: ["space-project", project.key] });
    setSelected(new Set());
    if (failed > 0) toast.error(`${ok} moved, ${failed} failed`);
    else toast.success(`Moved ${ok} ticket${ok > 1 ? "s" : ""} to sprint`);
  }

  async function handleBulkAssign(assignee: string) {
    if (!assignee || selected.size === 0) return;
    const keys = Array.from(selected);
    const results = await Promise.allSettled(
      keys.map((k) => updateTicket(k, { assignee })),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    const ok = keys.length - failed;
    qc.invalidateQueries({ queryKey: ["space-project", project.key] });
    setSelected(new Set());
    if (failed > 0) toast.error(`${ok} assigned, ${failed} failed`);
    else toast.success(`Assigned ${ok} ticket${ok > 1 ? "s" : ""}`);
  }

  async function handleBulkPriority(priority: string) {
    if (!priority || selected.size === 0) return;
    const keys = Array.from(selected);
    const results = await Promise.allSettled(
      keys.map((k) => updateTicket(k, { priority })),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    const ok = keys.length - failed;
    qc.invalidateQueries({ queryKey: ["space-project", project.key] });
    setSelected(new Set());
    if (failed > 0) toast.error(`${ok} updated, ${failed} failed`);
    else toast.success(`Priority updated for ${ok} ticket${ok > 1 ? "s" : ""}`);
  }

  async function handleBulkTransition(status: string) {
    if (!status || selected.size === 0) return;
    const keys = Array.from(selected);
    const results = await Promise.allSettled(
      keys.map((k) => updateTicketStatus(k, status)),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    const ok = keys.length - failed;
    qc.invalidateQueries({ queryKey: ["space-project", project.key] });
    setSelected(new Set());
    if (failed > 0) toast.error(`${ok} transitioned, ${failed} failed`);
    else toast.success(`Transitioned ${ok} ticket${ok > 1 ? "s" : ""}`);
  }

  async function handleEosPlanSprint() {
    setAiPlanLoading(true);
    setAiPlanResult(null);
    setAiPlanError(false);
    try {
      const result = await fetchSprintDraft(project.key);
      setAiPlanResult(result);
    } catch {
      toast.error("EOS sprint planning failed");
      setAiPlanError(true);
    } finally {
      setAiPlanLoading(false);
    }
  }

  const totalBacklogSP = backlogTasks.reduce((s, t) => s + t.storyPoints, 0);

  const epicColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    project?.epics?.forEach((e) => {
      map[e.id] = e.color;
    });
    return map;
  }, [project?.epics]);

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

          {/* {_showSaveFilter ? (
            <div className={styles.sortWrap}>
              <input
                className={styles.select}
                placeholder="Filter name"
                value={_filterName}
                onChange={(e) => setFilterName(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    _filterName.trim() &&
                    !_saveFilterMut.isPending
                  )
                    _saveFilterMut.mutate(_filterName.trim());
                  if (e.key === "Escape") {
                    setShowSaveFilter(false);
                    setFilterName("");
                  }
                }}
                autoFocus
                style={{ width: 120 }}
              />
              <button
                className={styles.clearBtn}
                disabled={_saveFilterMut.isPending || !_filterName.trim()}
                onClick={() => {
                  if (_filterName.trim())
                    _saveFilterMut.mutate(_filterName.trim());
                }}
              >
                Save
              </button>
              <button
                className={styles.clearBtn}
                onClick={() => {
                  setShowSaveFilter(false);
                  setFilterName("");
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              className={styles.clearBtn}
              onClick={() => setShowSaveFilter(true)}
              style={{ color: "var(--text-2)", fontWeight: 600 }}
            >
            </button>
          )} */}

          <button
            className={`${styles.eosBtn} ${aiPlanError ? styles.eosBtnError : ""}`}
            onClick={handleEosPlanSprint}
            disabled={aiPlanLoading}
          >
            {aiPlanLoading ? (
              <>
                <span className={styles.spinner} /> Planning…
              </>
            ) : aiPlanError ? (
              <>
                <RiAlertLine size={13} /> Retry EOS Plan
              </>
            ) : (
              <>
                <RiSparklingLine size={13} /> EOS Plan Sprint
              </>
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
                      style={{
                        transform: isCollapsed ? "rotate(-90deg)" : "none",
                      }}
                    >
                      <RiArrowDownSLine />
                    </span>
                  </button>
                  <div className={styles.sprintHeaderInfo}>
                    <div className={styles.sprintTitleRow}>
                      <span className={styles.sprintName}>{sprint.name}</span>
                      <span
                        className={`${styles.sprintStatusBadge} ${
                          sprint.status === "active"
                            ? styles.badgeActive
                            : styles.badgePlanning
                        }`}
                      >
                        {sprint.status === "active" ? "Active" : "Planning"}
                      </span>
                      {sprint.goal && (
                        <span className={styles.sprintGoal} title={sprint.goal}>
                          {sprint.goal.length > 55
                            ? sprint.goal.slice(0, 55) + "…"
                            : sprint.goal}
                        </span>
                      )}
                    </div>
                    <div className={styles.sprintMeta}>
                      <span className={styles.sprintIssueCount}>
                        {sprint.tasks.length} issue
                        {sprint.tasks.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: action buttons */}
                <div className={styles.sprintActions}>
                  {canManageSprints && sprint.status === "planning" && (
                    <>
                      {confirmDeleteSprintId === sprint.id ? (
                        <div className={styles.deleteConfirmInline}>
                          <span className={styles.deleteConfirmText}>
                            Delete sprint?
                          </span>
                          <button
                            className={styles.deleteConfirmYes}
                            disabled={deleteSprintMut.isPending}
                            onClick={() => deleteSprintMut.mutate(sprint.id)}
                          >
                            {deleteSprintMut.isPending ? (
                              <span className={styles.spinner} />
                            ) : (
                              "Delete"
                            )}
                          </button>
                          <button
                            className={styles.deleteConfirmNo}
                            onClick={() => setConfirmDeleteSprintId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          className={styles.deleteSprintBtn}
                          onClick={() => setConfirmDeleteSprintId(sprint.id)}
                          title="Delete sprint"
                        >
                          <RiCloseLine size={13} />
                        </button>
                      )}
                      <button
                        className={styles.startSprintBtn}
                        onClick={() => setStartSprintModal(sprint)}
                      >
                        <RiPlayCircleLine size={13} />
                        Start Sprint
                      </button>
                    </>
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
                            moveToSprintMut.mutate({
                              sprintId: sid,
                              ticketKey: task.key,
                            })
                          }
                          onMoveToBacklog={() =>
                            moveToBacklogMut.mutate({
                              sprintId: sprint.id,
                              ticketKey: task.key,
                            })
                          }
                          onClick={() => setViewingTask(task)}
                          isMoving={movingTicketKey === task.key}
                          epicColor={
                            task.epicId ? epicColorMap[task.epicId] : undefined
                          }
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
                  style={{
                    transform: collapsed.has("backlog")
                      ? "rotate(-90deg)"
                      : "none",
                  }}
                >
                  <RiArrowDownSLine />
                </span>
              </button>
              <div className={styles.sprintHeaderInfo}>
                <div className={styles.sprintTitleRow}>
                  <span className={styles.sprintName}>Backlog</span>
                  <span className={styles.sprintIssueCount}>
                    {backlogTasks.length} issue
                    {backlogTasks.length !== 1 ? "s" : ""}
                  </span>
                  {totalBacklogSP > 0 && (
                    <>
                      <span className={styles.metaDivider}>·</span>
                      <span className={styles.sprintPoints}>
                        {totalBacklogSP} pts
                      </span>
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
                {(() => {
                  const filteredBacklog = filterAndSort(backlogTasks);
                  return filteredBacklog.length === 0 ? (
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
                    filteredBacklog.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        selected={selected.has(task.key)}
                        onSelect={() => toggleSelect(task.key)}
                        sprints={visibleSprints}
                        currentSprintId={undefined}
                        onMoveToSprint={(sid) =>
                          moveToSprintMut.mutate({
                            sprintId: sid,
                            ticketKey: task.key,
                          })
                        }
                        onMoveToBacklog={undefined}
                        onClick={() => setViewingTask(task)}
                        isMoving={movingTicketKey === task.key}
                        epicColor={
                          task.epicId ? epicColorMap[task.epicId] : undefined
                        }
                      />
                    ))
                  );
                })()}
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
          onConfirm={(id, body) => startSprintMut.mutate({ id, body })}
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
            story_points: data.story_points
              ? Number(data.story_points)
              : undefined,
            labels: data.labels,
            status: data.status || "To Do",
            sprint_id: createForSprint,
          };
          const _ts = Date.now();
          const tempTask: ProjectTask = {
            id: `local-${_ts}-${Math.random().toString(36).slice(2, 6)}`,
            key: `${project.key}-L${_ts}-${Math.random().toString(36).slice(2, 6)}`,
            title: payload.title,
            status: _normalizeStatus(payload.status) as ProjectTask["status"],
            priority: (payload.priority || "Medium") as ProjectTask["priority"],
            type: _normalizeType(payload.issue_type) as ProjectTask["type"],
            assignee: payload.assignee || project.members[0]?.name || "",
            assigneeInitials: _initials(
              payload.assignee || project.members[0]?.name,
            ),
            assigneeColor: _hashColor(
              payload.assignee || project.members[0]?.name || "",
            ),
            storyPoints: payload.story_points || 0,
            createdAt: new Date().toISOString().split("T")[0],
            updatedAt: new Date().toISOString().split("T")[0],
            labels: payload.labels || [],
            pod: project.key,
            sprint: createForSprint ?? undefined,
          };
          setLocalTasks((prev) => [...prev, tempTask]);
          createMut.mutate(payload);
        }}
      />

      {/* ── Floating Bulk Action Bar ── */}
      {selected.size > 0 && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>{selected.size} selected</span>
          <div className={styles.bulkActions}>
            {visibleSprints.length > 0 && (
              <div className={styles.bulkWrap}>
                <select
                  className={styles.bulkSelect}
                  value=""
                  onChange={(e) => handleBulkMoveToSprint(e.target.value)}
                >
                  <option value="">Move to Sprint</option>
                  {visibleSprints.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className={styles.bulkWrap}>
              <select
                className={styles.bulkSelect}
                value=""
                onChange={(e) => handleBulkAssign(e.target.value)}
              >
                <option value="">Assign</option>
                {project.members.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.bulkWrap}>
              <select
                className={styles.bulkSelect}
                value=""
                onChange={(e) => handleBulkPriority(e.target.value)}
              >
                <option value="">Set Priority</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div className={styles.bulkWrap}>
              <select
                className={styles.bulkSelect}
                value=""
                onChange={(e) => handleBulkTransition(e.target.value)}
              >
                <option value="">Transition</option>
                <option value="To Do">To Do</option>
                <option value="In Progress">In Progress</option>
                <option value="In Review">In Review</option>
                <option value="Blocked">Blocked</option>
                <option value="Done">Done</option>
              </select>
            </div>
            <button
              className={styles.bulkClear}
              onClick={() => setSelected(new Set())}
            >
              <RiCloseCircleLine size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── EOS Plan Sprint Drawer ── */}
      <SideDrawer
        open={!!aiPlanResult}
        onClose={() => setAiPlanResult(null)}
        size="sm"
        title="EOS Sprint Plan"
        avatar={<RiSparklingLine size={18} color="var(--accent)" />}
        badge={
          aiPlanResult ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {aiPlanResult.nova_powered ? (
                <span className={styles.novaPoweredBadge}>AI</span>
              ) : (
                <span className={styles.novaFallbackBadge}>Deterministic</span>
              )}
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                {aiPlanResult.tickets.length} tickets ·{" "}
                {aiPlanResult.total_points} pts
              </span>
            </div>
          ) : undefined
        }
      >
        {aiPlanResult && (
          <>
            {aiPlanResult.rationale && (
              <p className={styles.eosDrawerRationale}>
                {aiPlanResult.rationale}
              </p>
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
                      <span
                        className={styles.eosTicketDot}
                        style={{ background: dotColor }}
                        title={t.priority}
                      />
                      <span className={styles.eosTicketTitle}>{t.summary}</span>
                      <span
                        className={styles.eosTicketSP}
                        title="AI suggested points"
                      >
                        {t.suggested_points}pt{" "}
                        <span
                          style={{
                            fontWeight: 400,
                            opacity: 0.55,
                            fontSize: 9,
                          }}
                        >
                          AI
                        </span>
                      </span>
                    </div>
                    {t.rationale && (
                      <p className={styles.eosTicketReason}>{t.rationale}</p>
                    )}
                  </div>
                );
              })}
            </div>
            {canManageSprints && (
              <div
                style={{
                  padding: "12px 12px 4px",
                  borderTop: "1px solid var(--border-2)",
                }}
              >
                <button
                  className={styles.eosBtn}
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => confirmEosMut.mutate()}
                  disabled={confirmEosMut.isPending}
                >
                  {confirmEosMut.isPending ? (
                    <>
                      <span className={styles.spinner} /> Creating Sprint…
                    </>
                  ) : (
                    <>
                      <RiAddLine size={13} /> Create Sprint from Plan
                    </>
                  )}
                </button>
              </div>
            )}
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
  isMoving,
  epicColor,
}: {
  task: ProjectTask;
  selected: boolean;
  onSelect: () => void;
  sprints: ProjectSprint[];
  currentSprintId: string | undefined;
  onMoveToSprint: (sprintId: string) => void;
  onMoveToBacklog: (() => void) | undefined;
  onClick?: () => void;
  isMoving?: boolean;
  epicColor?: string;
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

  // Memoized to avoid recompute on every render (BUG-22)
  const otherSprints = useMemo(
    () => sprints.filter((s) => s.id !== currentSprintId),
    [sprints, currentSprintId],
  );

  return (
    <div
      className={`${styles.row} ${selected ? styles.rowSelected : ""} ${menuOpen ? styles.rowMenuOpen : ""} ${isStale ? styles.rowStale : ""}`}
      style={{ "--priority-color": priorityColor } as React.CSSProperties}
      onClick={(e) => {
        const rect = (
          e.currentTarget as HTMLDivElement
        ).getBoundingClientRect();
        const x = e.clientX - rect.left - 12; // subtract row left padding
        if (x < 40) return; // skip clicks in the checkbox column + gap area
        onClick?.();
      }}
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
        <IssueTypeBadge type={task.type} />
        {epicColor && (
          <span
            className={styles.epicDot}
            style={{ background: epicColor }}
            title="Epic"
          />
        )}
        <span className={styles.titleText}>{task.title}</span>
        {isStale && (
          <span
            className={styles.staleBadge}
            title={`No updates in ${staleDays} days`}
          >
            <RiAlertLine size={9} /> {staleDays}d
          </span>
        )}
        {task.labels?.map((l) => (
          <span key={l} className={styles.labelTag}>
            {l}
          </span>
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
          <div
            className={styles.assigneeAvatar}
            style={{ background: task.assigneeColor }}
          >
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
              color:
                new Date(task.dueDate) < new Date()
                  ? "var(--red)"
                  : "var(--text-2)",
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
          onClick={() => !isMoving && setMenuOpen((v) => !v)}
          disabled={isMoving}
          title={isMoving ? "Moving…" : undefined}
        >
          {isMoving ? (
            <span className={styles.spinner} />
          ) : (
            <RiMore2Line size={14} />
          )}
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
                    disabled={isMoving}
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
                disabled={isMoving}
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
  const confirmedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const duplicates = useMemo(
    () => _findDuplicates(title, allTasks),
    [title, allTasks],
  );

  function handleConfirm() {
    if (!title.trim() || confirmedRef.current) return;
    confirmedRef.current = true; // guard against double-Enter (BUG-20)
    onConfirm(title.trim());
  }

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
            if (e.key === "Enter") handleConfirm();
            if (e.key === "Escape") onCancel();
          }}
        />
        {title.trim() && (
          <button className={styles.quickCreateBtn} onClick={handleConfirm}>
            Create →
          </button>
        )}
        <button className={styles.quickCreateCancel} onClick={onCancel}>
          ✕
        </button>
      </div>
      {duplicates.length > 0 && (
        <div className={styles.dupeBanner}>
          <RiAlertLine size={11} style={{ flexShrink: 0 }} />
          <span className={styles.dupeBannerLabel}>
            Similar tickets already exist:
          </span>
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
  onConfirm: (
    id: string,
    body: { name: string; goal: string; start_date: string; end_date: string },
  ) => void;
  isLoading: boolean;
}) {
  const today = new Date().toISOString().split("T")[0];
  const twoWeeks = new Date(Date.now() + 14 * 86400000)
    .toISOString()
    .split("T")[0];
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

          <label className={styles.formLabel}>
            Sprint Goal <span className={styles.optional}>(optional)</span>
          </label>
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
          <button
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            className={styles.primaryBtn}
            onClick={() =>
              onConfirm(sprint.id, {
                name,
                goal,
                start_date: startDate,
                end_date: endDate,
              })
            }
            disabled={isLoading || !name.trim() || endDate < startDate}
          >
            {isLoading ? (
              <>
                <span className={styles.spinner} /> Starting…
              </>
            ) : (
              <>
                <RiPlayCircleLine size={14} /> Start Sprint
              </>
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
  const donePts = sprint.donePoints ?? 0;
  const totalPts = sprint.totalPoints ?? 0;

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
            <span
              className={styles.completeStatNum}
              style={{ color: "var(--green)" }}
            >
              {doneCount}
            </span>
            <span className={styles.completeStatLbl}>Done</span>
          </div>
          <div className={styles.completeStat}>
            <span
              className={styles.completeStatNum}
              style={{ color: "var(--amber)" }}
            >
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
            <RiArrowGoBackLine
              size={14}
              style={{ flexShrink: 0, marginTop: 1 }}
            />
            <span>
              <strong>{incompleteCount}</strong> incomplete issue
              {incompleteCount !== 1 ? "s" : ""} will be moved to the{" "}
              <strong>Backlog</strong> automatically.
            </span>
          </div>
        )}

        {incompleteCount === 0 && (
          <div className={styles.allDoneNotice}>
            All issues are done. Great sprint!
          </div>
        )}

        <div className={styles.modalFooter}>
          <button
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            className={styles.completeBtn}
            onClick={() => onConfirm(sprint.id)}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className={styles.spinner} /> Completing…
              </>
            ) : (
              <>
                <RiCheckboxCircleLine size={14} /> Complete Sprint
              </>
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
  onConfirm: (p: {
    name: string;
    goal: string;
    start_date: string;
    end_date: string;
  }) => void;
  isLoading: boolean;
  sprintNumber: number;
}) {
  const today = new Date().toISOString().split("T")[0];
  const twoWeeks = new Date(Date.now() + 14 * 86400000)
    .toISOString()
    .split("T")[0];
  const [name, setName] = useState(`Sprint ${sprintNumber}`);
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(twoWeeks);
  const dateError =
    endDate < startDate ? "End date must be after start date" : null;

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

          <label className={styles.formLabel}>
            Sprint Goal <span className={styles.optional}>(optional)</span>
          </label>
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
          {dateError && (
            <p style={{ fontSize: 11, color: "var(--red)", margin: "4px 0 0" }}>
              {dateError}
            </p>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            className={styles.primaryBtn}
            onClick={() =>
              onConfirm({
                name,
                goal,
                start_date: startDate,
                end_date: endDate,
              })
            }
            disabled={isLoading || !name.trim() || !!dateError}
          >
            {isLoading ? (
              <>
                <span className={styles.spinner} /> Creating…
              </>
            ) : (
              <>
                <RiAddLine size={14} /> Create Sprint
              </>
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
  const now = new Date();
  const then = new Date(dateStr);
  // Use UTC midnight diff to avoid DST-caused off-by-one (BUG-21)
  const nowUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const thenUTC = Date.UTC(then.getFullYear(), then.getMonth(), then.getDate());
  return Math.max(0, Math.floor((nowUTC - thenUTC) / 86_400_000));
}

function _findDuplicates(title: string, tasks: ProjectTask[]): ProjectTask[] {
  if (title.trim().length < 3) return [];
  const words = title
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
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
    "linear-gradient(135deg,#f59e0b,#fbbf24)",
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
