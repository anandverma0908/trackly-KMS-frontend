import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

const WIP_LIMIT = 5;

function daysSince(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000),
  );
}
import Tooltip from "@mui/material/Tooltip";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import type { Project, ProjectTask } from "../spacesData";
import { getPriorityColor } from "../spacesData";
import CreateTicketDrawer from "@/features/tickets/CreateTicketDrawer";
import TicketDetailDrawer from "@/features/tickets/TicketDetailDrawer";
import BoardConfigPanel from "@/features/spaces/components/BoardConfigPanel";
import { createTicket, updateTicketStatus, createSavedFilter } from "@/services/api";
import type { TicketCreate } from "@/types";
import styles from "./ActiveSprintsTab.module.css";

import {
  RiSearchLine,
  RiUserLine,
  RiFilter3Line,
  RiSparklingLine,
  RiAlertLine,
  RiSettings3Line,
} from "react-icons/ri";
import { IssueTypeBadge } from "@/components/ui/Badge";

const AI_FILTERS = [
  {
    id: "blockers" as const,
    label: "Blockers",
    color: "var(--red)",
    icon: "🚫",
  },
  {
    id: "high-priority" as const,
    label: "High Priority",
    color: "var(--amber)",
    icon: "⚡",
  },
  { id: "overdue" as const, label: "Overdue", color: "var(--red)", icon: "⏰" },
  { id: "bugs" as const, label: "Bugs", color: "var(--purple)", icon: "🐛" },
];

const COLUMNS = [
  { id: "To Do", label: "To Do", color: "var(--text-3)", emoji: "📋" },
  {
    id: "In Progress",
    label: "In Progress",
    color: "var(--amber)",
    emoji: "⚡",
  },
  { id: "In Review", label: "In Review", color: "var(--purple)", emoji: "👁️" },
  { id: "Blocked", label: "Blocked", color: "var(--red)", emoji: "🚫" },
  { id: "Done", label: "Done", color: "var(--green)", emoji: "✅" },
];

type AIFilter =
  | "blockers"
  | "high-priority"
  | "overdue"
  | "bugs"
  | "my-tasks"
  | null;

/* ── Flow Metrics Strip ── */
function FlowMetricsStrip({ tasks }: { tasks: ProjectTask[] }) {
  const inProgress = tasks.filter((t) => t.status === "In Progress");
  const blocked = tasks.filter((t) => t.status === "Blocked");
  const inReview = tasks.filter((t) => t.status === "In Review");
  const avgAge =
    inProgress.length > 0
      ? Math.round(
          inProgress.reduce((a, t) => a + daysSince(t.updatedAt), 0) /
            inProgress.length,
        )
      : 0;
  const bottleneck = [
    { label: "In Progress", count: inProgress.length },
    { label: "In Review", count: inReview.length },
    { label: "Blocked", count: blocked.length },
  ].sort((a, b) => b.count - a.count)[0];

  return (
    <div className={styles.flowStrip}>
      <span className={styles.flowStripLabel}>
        <RiSparklingLine size={11} /> EOS Flow
      </span>
      <div className={styles.flowMetrics}>
        <div
          className={`${styles.flowMetric} ${inProgress.length > WIP_LIMIT ? styles.flowMetricWarn : ""}`}
        >
          <span className={styles.flowMetricVal}>{inProgress.length}</span>
          <span className={styles.flowMetricLbl}>
            in progress{inProgress.length > WIP_LIMIT ? " ⚠" : ""}
          </span>
        </div>
        <div className={styles.flowDivider} />
        <div className={styles.flowMetric}>
          <span className={styles.flowMetricVal}>{avgAge}d</span>
          <span className={styles.flowMetricLbl}>avg WIP age</span>
        </div>
        <div className={styles.flowDivider} />
        <div
          className={`${styles.flowMetric} ${blocked.length > 0 ? styles.flowMetricDanger : ""}`}
        >
          <span className={styles.flowMetricVal}>{blocked.length}</span>
          <span className={styles.flowMetricLbl}>blocked</span>
        </div>
        <div className={styles.flowDivider} />
        <div className={styles.flowMetric}>
          <span className={styles.flowMetricVal}>{inReview.length}</span>
          <span className={styles.flowMetricLbl}>in review</span>
        </div>
        <div className={styles.flowDivider} />
        <div
          className={`${styles.flowMetric} ${bottleneck.count > WIP_LIMIT ? styles.flowMetricWarn : ""}`}
        >
          <span className={styles.flowMetricVal}>{bottleneck.label}</span>
          <span className={styles.flowMetricLbl}>
            bottleneck ({bottleneck.count})
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ActiveSprintsTab({
  project,
  externalCreateOpen,
  setExternalCreateOpen,
}: {
  project: Project;
  externalCreateOpen?: boolean;
  setExternalCreateOpen?: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const activeSprints = useMemo(
    () =>
      project.sprints.filter(
        (s) => s.status === "active" || s.status === "planning",
      ),
    [project],
  );

  const selectedSprint = useMemo(
    () => activeSprints[0] ?? project.sprints[0],
    [activeSprints, project],
  );

  const epicColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    project.epics?.forEach((e) => { map[e.id] = e.color; });
    return map;
  }, [project.epics]);

  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    new Set(),
  );
  const [search, setSearch] = useState("");
  const [myTasksActive, setMyTasksActive] = useState(false);
  const [aiFilter, setAiFilter] = useState<AIFilter>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const createOpen = externalCreateOpen ?? showCreateModal;
  const [createColumn, _setCreateColumn] = useState("To Do");
  const [viewTicket, setViewTicket] = useState<ProjectTask | null>(null);
  // Optimistic local status overrides for drag-and-drop
  const [localStatuses, setLocalStatuses] = useState<
    Record<string, ProjectTask["status"]>
  >({});
  // Temporary buffer for optimistically created tasks
  const [localTasks, setLocalTasks] = useState<ProjectTask[]>([]);
  const [draggedTask, setDraggedTask] = useState<ProjectTask | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [showSaveFilter, setShowSaveFilter] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [showBoardConfig, setShowBoardConfig] = useState(false);

  const statusMut = useMutation({
    mutationFn: ({ key, status }: { key: string; status: string }) =>
      updateTicketStatus(key, status),
    onSuccess: (_data, { key }) => {
      setLocalStatuses((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      qc.invalidateQueries({ queryKey: ["space-project", project.key] });
    },
    onError: (_err, { key }) => {
      setLocalStatuses((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      toast.error("Failed to update status");
    },
  });

  const saveFilterMut = useMutation({
    mutationFn: (name: string) => createSavedFilter({
      name,
      filters: { search, pod: project.key },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-filters"] });
      toast.success("Filter saved");
      setShowSaveFilter(false);
      setFilterName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createMut = useMutation({
    mutationFn: createTicket,
    onSuccess: () => {
      setLocalTasks([]);
      qc.invalidateQueries({ queryKey: ["space-project", project.key] });
      qc.invalidateQueries({ queryKey: ["kanban-tickets"] });
      toast.success("Ticket created!");
      setShowCreateModal(false);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setLocalTasks([]);
    },
  });

  // Combine sprint tasks with optimistic status overrides + locally created tasks
  const allSprintTasks = useMemo(() => {
    if (!selectedSprint) return [];
    const sprintTasks = selectedSprint.tasks.map((t) => ({
      ...t,
      status: (localStatuses[t.key] ?? t.status) as ProjectTask["status"],
    }));
    return [
      ...sprintTasks,
      ...localTasks.filter((t) => t.sprint === selectedSprint.id),
    ];
  }, [selectedSprint, localStatuses, localTasks]);

  function toggleMember(name: string) {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let tasks = allSprintTasks;

    // Member filter
    if (selectedMembers.size > 0) {
      tasks = tasks.filter((t) => selectedMembers.has(t.assignee));
    }

    // Search
    if (search) {
      const q = search.toLowerCase();
      tasks = tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.key.toLowerCase().includes(q) ||
          (t.assignee || "").toLowerCase().includes(q),
      );
    }

    // My tasks (mock — use first member as "me")
    if (myTasksActive) {
      const me = project.members[0]?.name ?? "";
      tasks = tasks.filter((t) => t.assignee === me);
    }

    // AI filters
    if (aiFilter === "blockers")
      tasks = tasks.filter((t) => t.status === "Blocked");
    if (aiFilter === "high-priority")
      tasks = tasks.filter(
        (t) => t.priority === "Critical" || t.priority === "High",
      );
    if (aiFilter === "overdue")
      tasks = tasks.filter(
        (t) =>
          t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "Done",
      );
    if (aiFilter === "bugs") tasks = tasks.filter((t) => t.type === "Bug");

    return tasks;
  }, [
    allSprintTasks,
    selectedMembers,
    search,
    myTasksActive,
    aiFilter,
    project,
  ]);

  // Group by column
  const columns = useMemo(() => {
    return COLUMNS.map((col) => ({
      ...col,
      tasks: filteredTasks.filter((t) => t.status === col.id),
    }));
  }, [filteredTasks]);

  // Drag handlers
  function handleDragStart(task: ProjectTask) {
    setDraggedTask(task);
  }
  function handleDragEnd() {
    setDraggedTask(null);
    setDragOverCol(null);
  }
  function handleDragOver(e: React.DragEvent, colId: string) {
    e.preventDefault();
    setDragOverCol(colId);
  }
  function handleDrop(e: React.DragEvent, colId: string) {
    e.preventDefault();
    if (!draggedTask) return;
    const newStatus = colId as ProjectTask["status"];
    if (draggedTask.status === newStatus) {
      setDraggedTask(null);
      setDragOverCol(null);
      return;
    }
    setLocalStatuses((prev) => ({ ...prev, [draggedTask.key]: newStatus }));
    statusMut.mutate({ key: draggedTask.key, status: newStatus });
    setDraggedTask(null);
    setDragOverCol(null);
  }

  function handleCreateTask(
    data: Partial<ProjectTask> & { status: string; title: string },
  ) {
    const payload: TicketCreate = {
      title: data.title || "",
      description: data.description || "",
      issue_type: (data.type as string) || "Task",
      priority: (data.priority as string) || "Medium",
      assignee: data.assignee,
      pod: project.key,
      story_points: data.storyPoints ? Number(data.storyPoints) : undefined,
      labels: data.labels,
      status: data.status,
      sprint_id: selectedSprint?.id,
    };
    const tempTask: ProjectTask = {
      id: `local-${Date.now()}`,
      key: `${project.key}-L${Date.now() % 1000}`,
      title: payload.title,
      status: payload.status as ProjectTask["status"],
      priority: (payload.priority || "Medium") as ProjectTask["priority"],
      type: _normalizeType(payload.issue_type) as ProjectTask["type"],
      assignee: payload.assignee || project.members[0]?.name || "",
      assigneeInitials: _initials(payload.assignee || project.members[0]?.name),
      assigneeColor: _hashColor(
        payload.assignee || project.members[0]?.name || "",
      ),
      storyPoints: payload.story_points || 0,
      createdAt: new Date().toISOString().split("T")[0],
      updatedAt: new Date().toISOString().split("T")[0],
      sprint: selectedSprint?.id,
      labels: payload.labels || [],
    };
    setLocalTasks((prev) => [...prev, tempTask]);
    createMut.mutate(payload);
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
    const MEMBER_COLORS = [
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
    return MEMBER_COLORS[Math.abs(h) % MEMBER_COLORS.length];
  }

  if (!selectedSprint) {
    return (
      <div className={styles.empty}>
        <span style={{ fontSize: 40 }}>🏃</span>
        <div className={styles.emptyTitle}>No active sprints</div>
        <div className={styles.emptyDesc}>
          Start a sprint from the Backlog tab to see tasks here.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.tab}>
      {/* ── Sprint selector + info ── */}
      {/* <div className={styles.sprintBar}>
        <div className={styles.sprintLeft}>
          {activeSprints.length > 1 ? (
            <div className={styles.sprintSelect}>
              <select
                className={styles.sprintDropdown}
                value={selectedSprint.id}
                onChange={(e) => {
                  const s = project.sprints.find(
                    (sp) => sp.id === e.target.value,
                  );
                  if (s) setSelectedSprint(s);
                }}
              >
                {activeSprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <RiArrowDownSLine size={16} color="var(--text-3)" />
            </div>
          ) : (
            <div className={styles.sprintName}>{selectedSprint.name}</div>
          )}
          <div className={styles.sprintDates}>
            {selectedSprint.startDate} → {selectedSprint.endDate}
          </div>
          <div className={styles.sprintGoal}>Goal: {selectedSprint.goal}</div>
        </div>

        <div className={styles.sprintRight}>
          <div className={styles.sprintStats}>
            <div className={styles.sStat}>
              <span
                className={styles.sStatVal}
                style={{ color: "var(--green)" }}
              >
                {selectedSprint.donePoints}
              </span>
              <span className={styles.sStatLbl}>Done pts</span>
            </div>
            <div className={styles.sStatDiv} />
            <div className={styles.sStat}>
              <span className={styles.sStatVal}>
                {selectedSprint.totalPoints}
              </span>
              <span className={styles.sStatLbl}>Total pts</span>
            </div>
            <div className={styles.sStatDiv} />
            <div className={styles.sStat}>
              <span
                className={styles.sStatVal}
                style={{ color: project.color }}
              >
                {sprintPct}%
              </span>
              <span className={styles.sStatLbl}>Complete</span>
            </div>
          </div>
          <LinearProgress
            variant="determinate"
            value={sprintPct}
            sx={{
              width: 160,
              height: 5,
              borderRadius: 100,
              backgroundColor: "var(--surface-2)",
              "& .MuiLinearProgress-bar": {
                background: `linear-gradient(90deg, ${project.color}, ${project.color}aa)`,
                borderRadius: 100,
              },
            }}
          />
        </div>
      </div> */}

      {/* ── Flow Metrics Strip ── */}
      <FlowMetricsStrip tasks={allSprintTasks} />

      {/* ── Toolbar: member chips + search + my tasks + AI filters + create ── */}
      <div className={styles.toolbar}>
        {/* Member avatar filter chips */}
        <div className={styles.memberChips}>
          {project.members.slice(0, 6).map((m, idx) => {
            const isActive = selectedMembers.has(m.name);
            return (
              <Tooltip
                key={m.id}
                title={`${m.name} · ${m.role}`}
                arrow
                placement="bottom"
              >
                <button
                  className={`${styles.memberChip} ${isActive ? styles.memberChipActive : ""}`}
                  onClick={() => toggleMember(m.name)}
                  style={{
                    marginLeft: idx === 0 ? 0 : -10,
                    zIndex: isActive ? 30 : 20 - idx,
                  }}
                >
                  <div
                    className={styles.memberChipAvatar}
                    style={{
                      background: m.color,
                      outline: isActive
                        ? `2px solid ${project.color}`
                        : undefined,
                      outlineOffset: 2,
                    }}
                  >
                    {m.initials}
                  </div>
                </button>
              </Tooltip>
            );
          })}
          {project.members.length > 6 && (
            <div
              className={styles.memberChipAvatar}
              style={{
                background: "var(--surface-2)",
                marginLeft: -10,
                zIndex: 0,
                color: "var(--text-2)",
                fontSize: 11,
              }}
            >
              +{project.members.length - 6}
            </div>
          )}
          {selectedMembers.size > 0 && (
            <button
              className={styles.clearMembersBtn}
              onClick={() => setSelectedMembers(new Set())}
            >
              Clear
            </button>
          )}
        </div>

        <div className={styles.toolbarRight}>
          {/* Search */}
          <div className={styles.searchWrap}>
            <RiSearchLine size={14} style={{ opacity: 0.5 }} />
            <input
              className={styles.searchInput}
              placeholder="Search tasks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className={styles.searchClear}
                onClick={() => setSearch("")}
              >
                ✕
              </button>
            )}
          </div>
          <button
            className={styles.clearAllBtn}
            onClick={() => setShowBoardConfig(true)}
            title="Board settings"
          >
            <RiSettings3Line size={14} />
          </button>

          {/* My Tasks */}
          <Tooltip title="Show only my tasks" arrow>
            <button
              className={`${styles.myTasksBtn} ${myTasksActive ? styles.myTasksBtnActive : ""}`}
              onClick={() => setMyTasksActive((v) => !v)}
            >
              <RiUserLine size={14} />
              <span>My Tasks</span>
            </button>
          </Tooltip>

          {/* AI filters */}
          {/* <div className={styles.aiFiltersWrap}>
            <RiSparklingLine size={13} color="var(--accent)" />
            <span className={styles.aiLabel}>EOS:</span>
            {AI_FILTERS.map((f) => (
              <button
                key={f.id}
                className={`${styles.aiChip} ${aiFilter === f.id ? styles.aiChipActive : ""}`}
                style={
                  aiFilter === f.id
                    ? {
                        color: f.color,
                        borderColor: f.color,
                        background: `${f.color}18`,
                      }
                    : {}
                }
                onClick={() => setAiFilter(aiFilter === f.id ? null : f.id)}
              >
                <span>{f.icon}</span>
                {f.label}
              </button>
            ))}
          </div> */}
        </div>
      </div>

      {/* ── Active filters summary ── */}
      {(selectedMembers.size > 0 || myTasksActive || aiFilter || search) && (
        <div className={styles.activeFilters}>
          <RiFilter3Line size={13} color="var(--text-3)" />
          <span className={styles.activeFiltersLabel}>Filtering:</span>
          {selectedMembers.size > 0 && (
            <span className={styles.activeFilterChip}>
              {selectedMembers.size} member{selectedMembers.size > 1 ? "s" : ""}
            </span>
          )}
          {myTasksActive && (
            <span className={styles.activeFilterChip}>My Tasks</span>
          )}
          {aiFilter && (
            <span className={styles.activeFilterChip}>
              {AI_FILTERS.find((filter) => filter.id === aiFilter)?.label ?? aiFilter}
            </span>
          )}
          {search && (
            <span className={styles.activeFilterChip}>"{search}"</span>
          )}
          <span className={styles.activeFilterCount}>
            {filteredTasks.length} tasks shown
          </span>
          <button
            className={styles.clearAllBtn}
            onClick={() => {
              setSelectedMembers(new Set());
              setMyTasksActive(false);
              setAiFilter(null);
              setSearch("");
            }}
          >
            Clear all
          </button>
          {showSaveFilter ? (
            <>
              <input
                className={styles.searchInput}
                placeholder="Filter name"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filterName.trim()) saveFilterMut.mutate(filterName.trim());
                  if (e.key === "Escape") { setShowSaveFilter(false); setFilterName(""); }
                }}
                autoFocus
                style={{ width: 120, marginLeft: 8 }}
              />
              <button className={styles.clearAllBtn} onClick={() => { if (filterName.trim()) saveFilterMut.mutate(filterName.trim()); }}>Save</button>
              <button className={styles.clearAllBtn} onClick={() => { setShowSaveFilter(false); setFilterName(""); }}>Cancel</button>
            </>
          ) : (
            <button className={styles.clearAllBtn} onClick={() => setShowSaveFilter(true)}>
              Save Filter
            </button>
          )}
        </div>
      )}

      {/* ── Kanban Board ── */}
      <div className={styles.board}>
        {columns.map((col) => (
          <div
            key={col.id}
            className={`${styles.column} ${dragOverCol === col.id ? styles.columnDragOver : ""}`}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDrop={(e) => handleDrop(e, col.id)}
            onDragLeave={() => setDragOverCol(null)}
          >
            {/* Column header */}
            <div className={styles.colHeader}>
              <span
                className={styles.colDot}
                style={{ background: col.color }}
              />
              <span className={styles.colLabel}>{col.label}</span>
              {(col.id === "In Progress" || col.id === "Blocked") &&
                col.tasks.length > WIP_LIMIT && (
                  <span
                    className={styles.wipWarning}
                    title={`WIP limit exceeded (${col.tasks.length}/${WIP_LIMIT})`}
                  >
                    <RiAlertLine size={11} />
                  </span>
                )}
              <span
                className={styles.colCount}
                style={
                  col.id === "In Progress" && col.tasks.length > WIP_LIMIT
                    ? {
                        color: "var(--amber)",
                        background: "rgba(251,191,36,0.12)",
                      }
                    : {}
                }
              >
                {col.tasks.length}
              </span>
            </div>

            {/* Progress micro-bar */}
            <div className={styles.colBar}>
              <div
                className={styles.colBarFill}
                style={{
                  width: `${
                    allSprintTasks.length > 0
                      ? (allSprintTasks.filter((t) => t.status === col.id)
                          .length /
                          allSprintTasks.length) *
                        100
                      : 0
                  }%`,
                  // background: col.color,
                }}
              />
            </div>

            {/* Cards */}
            <div className={styles.cardList}>
              <AnimatePresence>
                {col.tasks.map((task) => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    projectColor={project.color}
                    onDragStart={() => handleDragStart(task)}
                    onDragEnd={handleDragEnd}
                    onView={setViewTicket}
                    epicColor={task.epicId ? epicColorMap[task.epicId] : undefined}
                  />
                ))}
              </AnimatePresence>

              {col.tasks.length === 0 && (
                <div className={styles.emptyCol}>
                  {dragOverCol === col.id ? (
                    <span style={{ color: col.color }}>Drop here</span>
                  ) : (
                    "No tasks"
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Create task drawer ── */}
      <CreateTicketDrawer
        open={createOpen}
        onClose={() => {
          setShowCreateModal(false);
          setExternalCreateOpen?.(false);
        }}
        defaultStatus={createColumn}
        defaultPod={project.key}
        sprintName={selectedSprint.name}
        members={project.members}
        onCreated={(data) => {
          handleCreateTask({
            title: data.title || "",
            description: data.description || "",
            type: data.issue_type as any,
            priority: data.priority as any,
            assignee: data.assignee,
            storyPoints: data.story_points
              ? Number(data.story_points)
              : undefined,
            status: (data.status ?? createColumn) as ProjectTask["status"],
            dueDate: data.due_date,
            labels: data.labels,
          });
        }}
      />
      {viewTicket && (
        <TicketDetailDrawer
          open={Boolean(viewTicket)}
          onClose={() => setViewTicket(null)}
          ticketKey={viewTicket.key}
          members={project.members}
          epics={project.epics}
          sprints={project.sprints.map((s) => ({ id: s.id, name: s.name }))}
          onUpdated={() => {
            qc.invalidateQueries({ queryKey: ["space-project", project.key] });
          }}
        />
      )}

      {/* ── Board Config Panel ── */}
      <BoardConfigPanel
        pod={project.key}
        open={showBoardConfig}
        onClose={() => setShowBoardConfig(false)}
      />
    </div>
  );
}

/* ── Kanban Card ── */
function KanbanCard({
  task,
  onDragStart,
  onDragEnd,
  onView,
  epicColor,
}: {
  task: ProjectTask;
  projectColor?: string;
  onDragStart: () => void;
  onDragEnd: () => void;
  onView?: (task: ProjectTask) => void;
  epicColor?: string;
}) {
  const priorityColor = getPriorityColor(task.priority);

  const age = daysSince(task.updatedAt);
  const isDone = task.status === "Done";
  const agingClass =
    !isDone && age > 14
      ? styles.cardAgingRed
      : !isDone && age > 5
        ? styles.cardAgingAmber
        : "";

  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const daysUntilDue = dueDate
    ? Math.ceil((dueDate.getTime() - Date.now()) / 86_400_000)
    : null;

  const eosHint = (() => {
    if (task.status === "Blocked")
      return `Blocked · ${age} day${age !== 1 ? "s" : ""} in this status`;
    if (!isDone && age > 14)
      return `Stale for ${age} days — no recent activity`;
    if (daysUntilDue !== null && daysUntilDue <= 3 && !isDone)
      return daysUntilDue <= 0
        ? `Overdue by ${Math.abs(daysUntilDue)} day(s)`
        : `Due in ${daysUntilDue} day(s) — needs attention`;
    if (
      (task.priority === "Critical" || task.priority === "High") &&
      age > 3 &&
      !isDone
    )
      return `${task.priority} priority · ${age} days without update`;
    return `Last updated ${age} day${age !== 1 ? "s" : ""} ago · ${task.status}`;
  })();

  return (
    <motion.div
      className={`${styles.kanbanCard} ${agingClass}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      layout
      onClick={() => onView?.(task)}
    >
      {/* Header */}
      <div className={styles.cardHeader}>
        <span className={styles.cardKey}>{task.key}</span>
        <div className={styles.cardHeaderRight}>
          {epicColor && (
            <span className={styles.epicDot} style={{ background: epicColor }} title="Epic" />
          )}
          <IssueTypeBadge type={task.type} />
        </div>
      </div>

      {/* Title */}
      <p className={styles.cardTitle}>{task.title}</p>

      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className={styles.cardLabels}>
          {task.labels.map((l) => (
            <span key={l} className={styles.cardLabel}>
              {l}
            </span>
          ))}
        </div>
      )}

      {/* Footer — matches KanbanBoard layout */}
      <div className={styles.cardFooter}>
        <span
          className={styles.priorityDot}
          style={{ background: priorityColor }}
          title={task.priority}
        />
        {task.dueDate && (
          <span
            className={styles.dueBadge}
            style={{
              color:
                new Date(task.dueDate) < new Date() && !isDone
                  ? "var(--red)"
                  : "var(--text-3)",
            }}
          >
            {new Date(task.dueDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
        {task.storyPoints > 0 && (
          <span className={styles.spBubble}>{task.storyPoints}</span>
        )}
        <div className={styles.cardSpacer} />
        <Tooltip title={task.assignee} arrow>
          <div className={styles.assigneeChip}>{task.assigneeInitials}</div>
        </Tooltip>
      </div>

      {/* Blocked banner */}
      {task.status === "Blocked" && (
        <div className={styles.blockedBanner}>Blocked</div>
      )}

      {/* EOS enrichment hint — visible on hover */}
      <div className={styles.eosHint}>
        <RiSparklingLine size={9} style={{ flexShrink: 0 }} />
        {eosHint}
      </div>
    </motion.div>
  );
}
