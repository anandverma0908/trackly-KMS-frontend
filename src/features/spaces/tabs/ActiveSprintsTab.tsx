import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Tooltip from "@mui/material/Tooltip";
import LinearProgress from "@mui/material/LinearProgress";
import {
  RiSearchLine,
  RiUserLine,
  RiFilter3Line,
  RiSparklingLine,
  RiAlertLine,
  RiSettings3Line,
  RiAddLine,
  RiArrowLeftLine,
  RiBookOpenLine,
  RiArrowDownSLine,
  RiCloseLine,
} from "react-icons/ri";

import type { Project, ProjectTask } from "../spacesData";
import { getPriorityColor } from "../spacesData";
import CreateTicketDrawer from "@/features/tickets/CreateTicketDrawer";
import BoardConfigPanel from "@/features/spaces/components/BoardConfigPanel";
import { useAuthStore } from "@/features/auth/useAuthStore";
import { useDebounce } from "@/hooks";
import { validateFilterName, normalizeStatus } from "@/utils/validation";
import {
  createTicket,
  updateTicketStatus,
  createSavedFilter,
  fetchStories,
  fetchBoardConfig,
} from "@/services/api";
import type { StoryItem, BoardConfig } from "@/services/api";
import type { TicketCreate } from "@/types";
import styles from "./ActiveSprintsTab.module.css";
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
] as const;

type AIFilter = (typeof AI_FILTERS)[number]["id"] | "my-tasks" | null;

const DEFAULT_COLUMNS: (BoardConfig["columns"][number] & { color: string })[] =
  [
    {
      id: "To Do",
      name: "To Do",
      status_mapping: ["To Do", "Open", "Reopened"],
      color: "var(--text-3)",
    },
    {
      id: "In Progress",
      name: "In Progress",
      status_mapping: ["In Progress"],
      color: "var(--amber)",
    },
    {
      id: "In Review",
      name: "In Review",
      status_mapping: ["In Review"],
      color: "var(--purple)",
    },
    {
      id: "Blocked",
      name: "Blocked",
      status_mapping: ["Blocked"],
      color: "var(--red)",
    },
    {
      id: "Done",
      name: "Done",
      status_mapping: ["Done", "Closed", "Resolved"],
      color: "var(--green)",
    },
  ];

function getColumnColor(colId: string): string {
  const map: Record<string, string> = {
    "To Do": "var(--text-3)",
    "In Progress": "var(--amber)",
    "In Review": "var(--purple)",
    Blocked: "var(--red)",
    Done: "var(--green)",
  };
  return map[colId] ?? "var(--text-3)";
}

const DEFAULT_WIP_LIMITS: Record<string, number> = {
  "In Progress": 5,
  Blocked: 5,
  "In Review": 5,
};

function daysSince(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

function _normalizeType(t: string | undefined): string {
  if (!t) return "Task";
  const l = t.toLowerCase().trim();
  if (l === "bug" || l === "bugfix") return "Bug";
  if (l === "story") return "Story";
  if (l === "epic") return "Epic";
  if (l === "subtask") return "Subtask";
  if (l === "task") return "Task";
  if (l === "improvement") return "Improvement";
  // partial matches only after exact matches
  if (l.includes("bug")) return "Bug";
  if (l.includes("story")) return "Story";
  if (l.includes("epic")) return "Epic";
  if (l.includes("subtask")) return "Subtask";
  return "Task";
}

function _initials(name: string | undefined): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/).filter(Boolean);
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

/* ── Swimlane Grouping ── */
function groupBySwimlane(
  tasks: ProjectTask[],
  swimlane: string,
): { key: string; label: string; tasks: ProjectTask[] }[] {
  if (swimlane === "none" || !swimlane)
    return [{ key: "__all__", label: "", tasks }];

  const groups = new Map<string, ProjectTask[]>();
  for (const task of tasks) {
    let key = "";
    if (swimlane === "assignee") key = task.assignee || "Unassigned";
    else if (swimlane === "epic") key = task.epicId || "No Epic";
    else if (swimlane === "priority") key = task.priority || "None";
    else key = "Other";

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(task);
  }

  return Array.from(groups.entries()).map(([key, items]) => ({
    key,
    label: key,
    tasks: items,
  }));
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
  const user = useAuthStore((s) => s.user);
  const currentUserName = user?.name ?? "";

  const activeSprints = useMemo(
    () =>
      project.sprints.filter(
        (s) => s.status === "active" || s.status === "planning",
      ),
    [project],
  );

  const [selectedSprintId, setSelectedSprintId] = useState<string | undefined>(
    undefined,
  );
  const selectedSprint = useMemo(() => {
    if (selectedSprintId) {
      const found = project.sprints.find((s) => s.id === selectedSprintId);
      if (found) return found;
    }
    return activeSprints[0] ?? project.sprints[0];
  }, [selectedSprintId, activeSprints, project]);

  const epicColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    project.epics?.forEach((e) => {
      map[e.id] = e.color;
    });
    return map;
  }, [project.epics]);

  // Board config
  const { data: boardConfig } = useQuery({
    queryKey: ["board-config", project.key],
    queryFn: () => fetchBoardConfig(project.key),
    enabled: !!project.key,
    staleTime: 1000 * 60 * 5,
  });

  const columnsConfig = useMemo(() => {
    if (boardConfig?.columns && boardConfig.columns.length > 0) {
      return boardConfig.columns.map((c) => ({
        ...c,
        color: getColumnColor(c.id),
      }));
    }
    return DEFAULT_COLUMNS;
  }, [boardConfig]);

  const wipLimits = useMemo(() => {
    if (
      boardConfig?.wip_limits &&
      Object.keys(boardConfig.wip_limits).length > 0
    ) {
      return boardConfig.wip_limits;
    }
    return DEFAULT_WIP_LIMITS;
  }, [boardConfig]);

  const swimlane = useMemo(
    () => boardConfig?.swimlane_by ?? "none",
    [boardConfig],
  );

  // Stories strip state
  const [storiesOpen, setStoriesOpen] = useState(true);
  const [focusedStory, setFocusedStory] = useState<StoryItem | null>(null);
  const [showAllStories, setShowAllStories] = useState(false);
  const [drawerStoryKey, setDrawerStoryKey] = useState<string | null>(null);

  const {
    data: storiesData,
    isLoading: storiesLoading,
    isError: storiesError,
  } = useQuery({
    queryKey: ["pod-stories", project.key, selectedSprint?.id],
    queryFn: () => fetchStories(project.key, selectedSprint?.id),
    enabled: !!selectedSprint,
  });

  const allStories = storiesData?.stories ?? [];
  const everythingElse = storiesData?.everything_else;

  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    new Set(),
  );
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [myTasksActive, setMyTasksActive] = useState(false);
  const [aiFilter, setAiFilter] = useState<AIFilter>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const createOpen = externalCreateOpen || showCreateModal;
  const [createColumn, setCreateColumn] = useState("To Do");
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
  const [lastMoved, setLastMoved] = useState<{
    key: string;
    prevStatus: string;
  } | null>(null);

  const statusMut = useMutation({
    mutationFn: ({ key, status }: { key: string; status: string }) =>
      updateTicketStatus(key, status),
    onSuccess: (_data, { key }) => {
      setLocalStatuses((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setLastMoved(null);
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
    mutationFn: (name: string) =>
      createSavedFilter({
        name,
        filters: {
          search: debouncedSearch,
          pod: project.key,
          members: Array.from(selectedMembers),
          myTasks: myTasksActive,
          aiFilter,
          sprintId: selectedSprint?.id,
          storyId: focusedStory?.id,
        },
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
      status: (localStatuses[t.key] ??
        normalizeStatus(t.status)) as ProjectTask["status"],
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

    // Exclude stories and epics from the kanban board
    tasks = tasks.filter((t) => t.type !== "Story" && t.type !== "Epic");

    // Story focus
    if (focusedStory) {
      const storyTaskIds = new Set(focusedStory.tasks.map((t) => t.id));
      tasks = tasks.filter((t) => storyTaskIds.has(t.id));
    }

    // Member filter
    if (selectedMembers.size > 0) {
      tasks = tasks.filter((t) => selectedMembers.has(t.assignee));
    }

    // Search
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      tasks = tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.key.toLowerCase().includes(q) ||
          (t.assignee || "").toLowerCase().includes(q),
      );
    }

    // My tasks (use authenticated user)
    if (myTasksActive && currentUserName) {
      tasks = tasks.filter((t) => t.assignee === currentUserName);
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
    debouncedSearch,
    myTasksActive,
    aiFilter,
    currentUserName,
    focusedStory,
  ]);

  // Map statuses to columns using status_mapping
  const statusToColumn = useMemo(() => {
    const map = new Map<string, string>();
    for (const col of columnsConfig) {
      for (const status of col.status_mapping) {
        map.set(status, col.id);
      }
      // Also map the column id itself
      map.set(col.id, col.id);
    }
    return map;
  }, [columnsConfig]);

  const getTaskColumnId = useCallback(
    (task: ProjectTask): string => {
      const mapped = statusToColumn.get(task.status);
      if (mapped) return mapped;
      // Try normalized status
      const normalized = normalizeStatus(task.status);
      const normalizedMapped = statusToColumn.get(normalized);
      if (normalizedMapped) return normalizedMapped;
      // Fallback to first column
      return columnsConfig[0]?.id ?? "To Do";
    },
    [statusToColumn, columnsConfig],
  );

  // Group by column
  const columns = useMemo(() => {
    return columnsConfig.map((col) => ({
      ...col,
      tasks: filteredTasks.filter((t) => getTaskColumnId(t) === col.id),
    }));
  }, [filteredTasks, columnsConfig, getTaskColumnId]);

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
    setLastMoved({ key: draggedTask.key, prevStatus: draggedTask.status });
    setLocalStatuses((prev) => ({ ...prev, [draggedTask.key]: newStatus }));
    statusMut.mutate({ key: draggedTask.key, status: newStatus });
    setDraggedTask(null);
    setDragOverCol(null);
  }

  function undoLastMove() {
    if (!lastMoved) return;
    setLocalStatuses((prev) => ({
      ...prev,
      [lastMoved.key]: lastMoved.prevStatus as ProjectTask["status"],
    }));
    statusMut.mutate({ key: lastMoved.key, status: lastMoved.prevStatus });
    setLastMoved(null);
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
    const now = Date.now();
    const tempTask: ProjectTask = {
      id: `local-${now}-${Math.random().toString(36).slice(2, 7)}`,
      key: `${project.key}-L${now % 10000}`,
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

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (showBoardConfig) setShowBoardConfig(false);
        else if (showSaveFilter) setShowSaveFilter(false);
        else if (focusedStory) setFocusedStory(null);
        else if (viewTicket) setViewTicket(null);
        else if (drawerStoryKey) setDrawerStoryKey(null);
        else if (createOpen) {
          setShowCreateModal(false);
          setExternalCreateOpen?.(false);
        }
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "z" &&
        lastMoved
      ) {
        e.preventDefault();
        undoLastMove();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        document
          .querySelector<HTMLInputElement>(`.${styles.searchInput}`)
          ?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    showBoardConfig,
    showSaveFilter,
    focusedStory,
    viewTicket,
    drawerStoryKey,
    createOpen,
    lastMoved,
    setExternalCreateOpen,
  ]);

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

  const inProgress = allSprintTasks.filter((t) => t.status === "In Progress");
  const blocked = allSprintTasks.filter((t) => t.status === "Blocked");
  const sprintPct =
    selectedSprint.totalPoints > 0
      ? Math.round(
          (selectedSprint.donePoints / selectedSprint.totalPoints) * 100,
        )
      : 0;

  const visibleMembers = project.members.slice(0, 6);
  const overflowMembers = project.members.slice(6);

  return (
    <div className={styles.tab}>
      {/* ── Toolbar: filters + search + EOS badges + create ── */}
      <div className={styles.toolbar}>
        <div className={styles.memberChips}>
          {visibleMembers.map((m, idx) => {
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
          {overflowMembers.length > 0 && (
            <Tooltip
              title={overflowMembers
                .map((m) => `${m.name} · ${m.role}`)
                .join("\n")}
              arrow
              placement="bottom"
            >
              <div
                className={styles.memberChipAvatar}
                style={{
                  background: "var(--surface-2)",
                  marginLeft: -10,
                  zIndex: 0,
                  color: "var(--text-2)",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                +{overflowMembers.length}
              </div>
            </Tooltip>
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
          {/* EOS compact badges */}
          {inProgress.length > 0 && (
            <span
              className={styles.eosBadge}
              style={{
                color:
                  inProgress.length > (wipLimits["In Progress"] ?? 5)
                    ? "var(--amber)"
                    : "var(--text-2)",
              }}
            >
              ⚡ {inProgress.length} in progress
              {inProgress.length > (wipLimits["In Progress"] ?? 5) ? " ⚠" : ""}
            </span>
          )}
          {blocked.length > 0 && (
            <span className={styles.eosBadge} style={{ color: "var(--red)" }}>
              🚫 {blocked.length} blocked
            </span>
          )}

          {/* Search */}
          <div className={styles.searchWrap}>
            <RiSearchLine size={14} style={{ opacity: 0.5 }} />
            <input
              className={styles.searchInput}
              placeholder="Search tasks… (Ctrl+F)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className={styles.searchClear}
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <RiCloseLine size={12} />
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

          <Tooltip title="Show only my tasks" arrow>
            <button
              className={`${styles.myTasksBtn} ${myTasksActive ? styles.myTasksBtnActive : ""}`}
              onClick={() => setMyTasksActive((v) => !v)}
              disabled={!currentUserName}
            >
              <RiUserLine size={14} />
              <span>My Tasks</span>
            </button>
          </Tooltip>

          <button
            className={styles.createBtn}
            onClick={() => {
              setCreateColumn(columnsConfig[0]?.id ?? "To Do");
              setShowCreateModal(true);
            }}
          >
            <RiAddLine size={14} /> Create Task
          </button>
        </div>
      </div>

      {/* ── Active filters summary ── */}
      {(selectedMembers.size > 0 ||
        myTasksActive ||
        aiFilter ||
        search ||
        focusedStory) && (
        <div className={styles.activeFilters}>
          <RiFilter3Line size={13} color="var(--text-3)" />
          <span className={styles.activeFiltersLabel}>Filtering:</span>
          {selectedSprint && (
            <span className={styles.activeFilterChip}>
              {selectedSprint.name}
            </span>
          )}
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
              {AI_FILTERS.find((f) => f.id === aiFilter)?.label ?? aiFilter}
            </span>
          )}
          {search && (
            <span className={styles.activeFilterChip}>"{search}"</span>
          )}
          {focusedStory && (
            <span className={styles.activeFilterChip}>
              Story: {focusedStory.key}
            </span>
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
              setFocusedStory(null);
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
                  if (e.key === "Enter" && filterName.trim()) {
                    const errors = validateFilterName(filterName.trim());
                    if (errors.length > 0) {
                      toast.error(errors[0].message);
                      return;
                    }
                    saveFilterMut.mutate(filterName.trim());
                  }
                  if (e.key === "Escape") {
                    setShowSaveFilter(false);
                    setFilterName("");
                  }
                }}
                autoFocus
                style={{ width: 120, marginLeft: 8 }}
              />
              <button
                className={styles.clearAllBtn}
                onClick={() => {
                  const errors = validateFilterName(filterName.trim());
                  if (errors.length > 0) {
                    toast.error(errors[0].message);
                    return;
                  }
                  if (filterName.trim())
                    saveFilterMut.mutate(filterName.trim());
                }}
              >
                Save
              </button>
              <button
                className={styles.clearAllBtn}
                onClick={() => {
                  setShowSaveFilter(false);
                  setFilterName("");
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              className={styles.clearAllBtn}
              onClick={() => setShowSaveFilter(true)}
            >
              Save Filter
            </button>
          )}
        </div>
      )}

      {/* ── Stories Strip ── */}
      {storiesLoading && (
        <div className={styles.storiesStrip}>
          <div className={styles.storiesStripHeader}>
            <span className={styles.storiesToggle}>
              <RiBookOpenLine size={12} />
              <span>Stories</span>
              <span className={styles.storiesCount}>…</span>
            </span>
          </div>
          <div style={{ padding: 12, color: "var(--text-3)", fontSize: 12 }}>
            Loading stories…
          </div>
        </div>
      )}
      {storiesError && (
        <div className={styles.storiesStrip}>
          <div className={styles.storiesStripHeader}>
            <span className={styles.storiesToggle}>
              <RiBookOpenLine size={12} />
              <span>Stories</span>
            </span>
          </div>
          <div style={{ padding: 12, color: "var(--red)", fontSize: 12 }}>
            Failed to load stories.{" "}
            <button
              className={styles.clearAllBtn}
              onClick={() =>
                qc.invalidateQueries({
                  queryKey: ["pod-stories", project.key, selectedSprint?.id],
                })
              }
            >
              Retry
            </button>
          </div>
        </div>
      )}
      {!storiesLoading && !storiesError && allStories.length > 0 && (
        <div className={styles.storiesStrip}>
          <div className={styles.storiesStripHeader}>
            <button
              className={styles.storiesToggle}
              onClick={() => setStoriesOpen((v) => !v)}
            >
              <RiBookOpenLine size={12} />
              <span>Stories</span>
              <span className={styles.storiesCount}>{allStories.length}</span>
              <span className={styles.storiesChevron}>
                {storiesOpen ? "▾" : "▸"}
              </span>
            </button>
            {focusedStory && (
              <button
                className={styles.storiesClearFocus}
                onClick={() => setFocusedStory(null)}
              >
                <RiArrowLeftLine size={11} /> Back to all tasks
              </button>
            )}
          </div>

          <AnimatePresence initial={false}>
            {storiesOpen && (
              <motion.div
                className={styles.storiesList}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {(showAllStories ? allStories : allStories.slice(0, 5)).map(
                  (story) => {
                    const isFocused = focusedStory?.id === story.id;
                    const insightColor =
                      story.eosInsight.color === "green"
                        ? "var(--green)"
                        : story.eosInsight.color === "red"
                          ? "var(--red)"
                          : story.eosInsight.color === "amber"
                            ? "var(--amber)"
                            : "var(--accent)";

                    return (
                      <div
                        key={story.id}
                        className={`${styles.storyRow} ${isFocused ? styles.storyRowFocused : ""}`}
                        onClick={() => setDrawerStoryKey(story.key)}
                      >
                        <div className={styles.storyRowLeft}>
                          <span className={styles.storyKey}>{story.key}</span>
                          <Tooltip title={story.title} arrow placement="top">
                            <span className={styles.storyTitle}>
                              {story.title}
                            </span>
                          </Tooltip>
                        </div>

                        <div className={styles.storyRowMid}>
                          <div className={styles.storyProgressBar}>
                            <div
                              className={styles.storyProgressFill}
                              style={{ width: `${story.progressPct}%` }}
                            />
                          </div>
                          <span className={styles.storyProgressPct}>
                            {story.progressPct}%
                          </span>
                          <span className={styles.storyTaskCount}>
                            {story.doneTasks}/{story.totalTasks} tasks
                          </span>
                        </div>

                        <div className={styles.storyRowRight}>
                          <Tooltip
                            title={story.eosInsight.text}
                            arrow
                            placement="top"
                          >
                            <span
                              className={styles.storyInsightBadge}
                              style={{
                                color: insightColor,
                                borderColor: `${insightColor}40`,
                                background: `${insightColor}12`,
                              }}
                            >
                              <RiSparklingLine size={9} />
                              {story.eosInsight.label}
                            </span>
                          </Tooltip>
                          {story.assignee && (
                            <Tooltip
                              title={story.assignee}
                              arrow
                              placement="top"
                            >
                              <div
                                className={styles.storyAssignee}
                                style={{ background: story.assigneeColor }}
                              >
                                {story.assigneeInitials}
                              </div>
                            </Tooltip>
                          )}
                          <span
                            className={styles.storyZoomBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              setFocusedStory(isFocused ? null : story);
                            }}
                            title={
                              isFocused
                                ? "Clear filter"
                                : "Filter board to this story"
                            }
                          >
                            {isFocused ? "✕" : "→"}
                          </span>
                        </div>
                      </div>
                    );
                  },
                )}

                {/* Everything else row */}
                {everythingElse && everythingElse.totalTasks > 0 && (
                  <div
                    className={`${styles.storyRow} ${styles.storyRowEverything} ${focusedStory?.id === "__everything__" ? styles.storyRowFocused : ""}`}
                    onClick={() => {
                      if (focusedStory?.id === "__everything__") {
                        setFocusedStory(null);
                      } else {
                        setFocusedStory({
                          id: "__everything__",
                          key: "",
                          title: "Everything else",
                          status: "To Do",
                          priority: "Medium",
                          assignee: "",
                          assigneeInitials: "",
                          assigneeColor: "",
                          epicId: undefined,
                          storyPoints: 0,
                          totalTasks: everythingElse.totalTasks,
                          doneTasks: everythingElse.doneTasks,
                          blockedTasks: 0,
                          progressPct: Math.round(
                            (everythingElse.doneTasks /
                              Math.max(1, everythingElse.totalTasks)) *
                              100,
                          ),
                          eosInsight: {
                            label: "Unlinked",
                            color: "amber",
                            text: "Tasks not linked to any story.",
                          },
                          tasks: everythingElse.tasks,
                        });
                      }
                    }}
                  >
                    <div className={styles.storyRowLeft}>
                      <span
                        className={styles.storyTitle}
                        style={{ color: "var(--text-2)" }}
                      >
                        Everything else
                      </span>
                    </div>
                    <div className={styles.storyRowMid}>
                      <div className={styles.storyProgressBar}>
                        <div
                          className={styles.storyProgressFill}
                          style={{
                            width: `${Math.round((everythingElse.doneTasks / Math.max(1, everythingElse.totalTasks)) * 100)}%`,
                            background: "var(--text-3)",
                          }}
                        />
                      </div>
                      <span className={styles.storyTaskCount}>
                        {everythingElse.totalTasks} work items
                      </span>
                    </div>
                    <div className={styles.storyRowRight}>
                      <span className={styles.storyZoomBtn}>
                        {focusedStory?.id === "__everything__" ? "✕" : "→"}
                      </span>
                    </div>
                  </div>
                )}

                {allStories.length > 5 && (
                  <button
                    className={styles.storiesShowMore}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAllStories((v) => !v);
                    }}
                  >
                    {showAllStories
                      ? "Show less"
                      : `Show ${allStories.length - 5} more stories`}
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Kanban Board ── */}
      <div className={styles.boardWrap}>
        {/* Zoom breadcrumb */}
        {focusedStory && (
          <div className={styles.zoomBreadcrumb}>
            <button
              className={styles.zoomBack}
              onClick={() => setFocusedStory(null)}
            >
              <RiArrowLeftLine size={13} /> {selectedSprint.name}
            </button>
            <span className={styles.zoomSep}>›</span>
            <span className={styles.zoomStoryTitle}>
              {focusedStory.key && (
                <span className={styles.zoomStoryKey}>{focusedStory.key}</span>
              )}
              {focusedStory.title}
            </span>
            <span className={styles.zoomTaskCount}>
              {focusedStory.totalTasks} tasks · {focusedStory.progressPct}% done
            </span>
          </div>
        )}

        {/* Undo banner */}
        {lastMoved && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              background: "var(--accent-glow)",
              borderRadius: 6,
              fontSize: 12,
              marginBottom: 8,
            }}
          >
            <span style={{ color: "var(--text-2)" }}>
              Moved <strong>{lastMoved.key}</strong> to a new column.
            </span>
            <button
              className={styles.clearAllBtn}
              onClick={undoLastMove}
              style={{ fontSize: 12 }}
            >
              Undo (Ctrl+Z)
            </button>
          </div>
        )}

        {/* Empty state for filtered results */}
        {filteredTasks.length === 0 && allSprintTasks.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 40,
              gap: 8,
              color: "var(--text-3)",
            }}
          >
            <span style={{ fontSize: 32 }}>🔍</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              No tasks match your filters
            </span>
            <button
              className={styles.clearAllBtn}
              onClick={() => {
                setSelectedMembers(new Set());
                setMyTasksActive(false);
                setAiFilter(null);
                setSearch("");
                setFocusedStory(null);
              }}
              style={{ fontSize: 13 }}
            >
              Clear all filters
            </button>
          </div>
        )}

        {filteredTasks.length > 0 && (
          <div className={styles.board}>
            {columns.map((col) => {
              const colWip = wipLimits[col.id] ?? wipLimits[col.name] ?? 5;
              const isOverWip = col.tasks.length > colWip;
              const swimlaneGroups =
                swimlane !== "none"
                  ? groupBySwimlane(col.tasks, swimlane)
                  : [{ key: "__all__", label: "", tasks: col.tasks }];

              return (
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
                    <span className={styles.colLabel}>{col.name}</span>
                    {isOverWip && (
                      <span
                        className={styles.wipWarning}
                        title={`WIP limit exceeded (${col.tasks.length}/${colWip})`}
                      >
                        <RiAlertLine size={11} />
                      </span>
                    )}
                    <span
                      className={styles.colCount}
                      style={
                        isOverWip
                          ? {
                              color: "var(--amber)",
                              background: "rgba(251,191,36,0.12)",
                            }
                          : {}
                      }
                    >
                      {col.tasks.length}
                    </span>
                    <button
                      className={styles.clearAllBtn}
                      style={{
                        marginLeft: "auto",
                        fontSize: 16,
                        lineHeight: 1,
                      }}
                      onClick={() => {
                        setCreateColumn(col.id);
                        setShowCreateModal(true);
                      }}
                      title={`Create task in ${col.name}`}
                    >
                      <RiAddLine size={14} />
                    </button>
                  </div>

                  {/* Progress micro-bar */}
                  <div className={styles.colBar}>
                    <div
                      className={styles.colBarFill}
                      style={{
                        width: `${
                          allSprintTasks.length > 0
                            ? (allSprintTasks.filter(
                                (t) => getTaskColumnId(t) === col.id,
                              ).length /
                                allSprintTasks.length) *
                              100
                            : 0
                        }%`,
                      }}
                    />
                  </div>

                  {/* Cards */}
                  <div className={styles.cardList}>
                    {swimlaneGroups.map((group) => (
                      <div key={group.key}>
                        {swimlane !== "none" && group.label && (
                          <div
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: 0.05,
                              color: "var(--text-3)",
                              padding: "4px 0",
                              borderBottom: "1px dashed var(--border-2)",
                              marginBottom: 4,
                            }}
                          >
                            {group.label}
                          </div>
                        )}
                        <AnimatePresence>
                          {group.tasks.map((task) => (
                            <KanbanCard
                              key={task.id}
                              task={task}
                              projectColor={project.color}
                              onDragStart={() => handleDragStart(task)}
                              onDragEnd={handleDragEnd}
                              onView={setViewTicket}
                              epicColor={
                                task.epicId
                                  ? epicColorMap[task.epicId]
                                  : undefined
                              }
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    ))}

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
              );
            })}
          </div>
        )}
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
        <CreateTicketDrawer
          open={Boolean(viewTicket)}
          onClose={() => setViewTicket(null)}
          ticketKey={viewTicket.key}
          members={project.members}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["space-project", project.key] });
          }}
        />
      )}
      {drawerStoryKey && (
        <CreateTicketDrawer
          open={Boolean(drawerStoryKey)}
          onClose={() => setDrawerStoryKey(null)}
          ticketKey={drawerStoryKey}
          members={project.members}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["space-project", project.key] });
            qc.invalidateQueries({ queryKey: ["pod-stories", project.key] });
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
            <span
              className={styles.epicDot}
              style={{ background: epicColor }}
              title="Epic"
            />
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

      {/* Footer */}
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
        <Tooltip title={task.assignee || "Unassigned"} arrow>
          <div className={styles.assigneeChip}>
            {task.assigneeInitials || "??"}
          </div>
        </Tooltip>
      </div>

      {/* Blocked banner */}
      {task.status === "Blocked" && (
        <div className={styles.blockedBanner}>Blocked</div>
      )}

      {/* EOS enrichment hint */}
      <div className={styles.eosHint}>
        <RiSparklingLine size={9} style={{ flexShrink: 0 }} />
        {eosHint}
      </div>
    </motion.div>
  );
}
