import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Tooltip from "@mui/material/Tooltip";
import LinearProgress from "@mui/material/LinearProgress";
import type { Project, ProjectTask, ProjectSprint } from "../spacesData";
import { getPriorityColor } from "../spacesData";
import styles from "./ActiveSprintsTab.module.css";

import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import PersonIcon from "@mui/icons-material/Person";
import FilterListIcon from "@mui/icons-material/FilterList";
import FlagIcon from "@mui/icons-material/Flag";
import BugReportIcon from "@mui/icons-material/BugReport";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import BlockIcon from "@mui/icons-material/Block";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CloseIcon from "@mui/icons-material/Close";

const COLUMNS = [
  { id: "To Do",       label: "To Do",       color: "var(--text-3)",  emoji: "📋" },
  { id: "In Progress", label: "In Progress", color: "var(--amber)",   emoji: "⚡" },
  { id: "In Review",   label: "In Review",   color: "var(--purple)",  emoji: "👁️" },
  { id: "Blocked",     label: "Blocked",     color: "var(--red)",     emoji: "🚫" },
  { id: "Done",        label: "Done",        color: "var(--green)",   emoji: "✅" },
];

type AIFilter = "blockers" | "high-priority" | "overdue" | "bugs" | "my-tasks" | null;

const AI_FILTERS: { id: AIFilter; label: string; icon: React.ReactNode; color: string }[] = [
  { id: "blockers",      label: "Blockers",      icon: <BlockIcon sx={{ fontSize: 12 }} />,      color: "var(--red)" },
  { id: "high-priority", label: "High Priority", icon: <FlagIcon sx={{ fontSize: 12 }} />,       color: "var(--amber)" },
  { id: "overdue",       label: "Overdue",       icon: <TaskAltIcon sx={{ fontSize: 12 }} />,    color: "var(--red)" },
  { id: "bugs",          label: "Bugs Only",     icon: <BugReportIcon sx={{ fontSize: 12 }} />,  color: "var(--purple)" },
];

interface CreateTaskModalProps {
  sprintName: string;
  columnStatus: string;
  project: Project;
  onClose: () => void;
  onCreate: (task: Partial<ProjectTask> & { status: string }) => void;
}

function CreateTaskModal({ sprintName, columnStatus, project, onClose, onCreate }: CreateTaskModalProps) {
  const [title, setTitle]         = useState("");
  const [type, setType]           = useState("Task");
  const [priority, setPriority]   = useState("Medium");
  const [assignee, setAssignee]   = useState("");
  const [points, setPoints]       = useState(3);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate({ title, type: type as any, priority: priority as any, assignee, storyPoints: points, status: columnStatus as any });
    onClose();
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <motion.div
        className={styles.modal}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>Create Issue</div>
          <div className={styles.modalSub}>{sprintName} · {columnStatus}</div>
          <button className={styles.modalClose} onClick={onClose}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </button>
        </div>
        <form className={styles.modalBody} onSubmit={handleSubmit}>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Summary *</label>
            <input
              className={styles.formInput}
              placeholder="Short description of the issue…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Type</label>
              <select className={styles.formSelect} value={type} onChange={(e) => setType(e.target.value)}>
                {["Story", "Bug", "Task", "Epic", "Subtask"].map(t => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Priority</label>
              <select className={styles.formSelect} value={priority} onChange={(e) => setPriority(e.target.value)}>
                {["Critical", "High", "Medium", "Low"].map(p => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Assignee</label>
              <select className={styles.formSelect} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">Unassigned</option>
                {project.members.map(m => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Story Points</label>
              <input
                className={styles.formInput}
                type="number"
                min={1}
                max={21}
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
              />
            </div>
          </div>
          <div className={styles.modalActions}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm">Create Issue</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function ActiveSprintsTab({ project }: { project: Project }) {
  const activeSprints = useMemo(
    () => project.sprints.filter(s => s.status === "active" || s.status === "planning"),
    [project]
  );

  const [selectedSprint, setSelectedSprint] = useState<ProjectSprint>(activeSprints[0] ?? project.sprints[0]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [search, setSearch]                   = useState("");
  const [myTasksActive, setMyTasksActive]     = useState(false);
  const [aiFilter, setAiFilter]               = useState<AIFilter>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createColumn, setCreateColumn]       = useState("To Do");
  const [localTasks, setLocalTasks]           = useState<ProjectTask[]>([]);
  const [draggedTask, setDraggedTask]         = useState<ProjectTask | null>(null);
  const [dragOverCol, setDragOverCol]         = useState<string | null>(null);

  // Combine sprint tasks + locally created tasks
  const allSprintTasks = useMemo(() => {
    if (!selectedSprint) return [];
    return [...selectedSprint.tasks, ...localTasks.filter(t => t.sprint === selectedSprint.id)];
  }, [selectedSprint, localTasks]);

  function toggleMember(name: string) {
    setSelectedMembers(prev => {
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
      tasks = tasks.filter(t => selectedMembers.has(t.assignee));
    }

    // Search
    if (search) {
      const q = search.toLowerCase();
      tasks = tasks.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.key.toLowerCase().includes(q) ||
        t.assignee.toLowerCase().includes(q)
      );
    }

    // My tasks (mock — use first member as "me")
    if (myTasksActive) {
      const me = project.members[0]?.name ?? "";
      tasks = tasks.filter(t => t.assignee === me);
    }

    // AI filters
    if (aiFilter === "blockers")      tasks = tasks.filter(t => t.status === "Blocked");
    if (aiFilter === "high-priority") tasks = tasks.filter(t => t.priority === "Critical" || t.priority === "High");
    if (aiFilter === "overdue")       tasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "Done");
    if (aiFilter === "bugs")          tasks = tasks.filter(t => t.type === "Bug");

    return tasks;
  }, [allSprintTasks, selectedMembers, search, myTasksActive, aiFilter, project]);

  // Group by column
  const columns = useMemo(() => {
    return COLUMNS.map(col => ({
      ...col,
      tasks: filteredTasks.filter(t => t.status === col.id),
    }));
  }, [filteredTasks]);

  // Drag handlers
  function handleDragStart(task: ProjectTask) { setDraggedTask(task); }
  function handleDragEnd()                     { setDraggedTask(null); setDragOverCol(null); }
  function handleDragOver(e: React.DragEvent, colId: string) {
    e.preventDefault();
    setDragOverCol(colId);
  }
  function handleDrop(e: React.DragEvent, colId: string) {
    e.preventDefault();
    if (!draggedTask) return;
    // Update task status (in local state if it's a local task, otherwise note it)
    setLocalTasks(prev => {
      const existing = prev.find(t => t.id === draggedTask.id);
      if (existing) {
        return prev.map(t => t.id === draggedTask.id ? { ...t, status: colId as any } : t);
      }
      // Clone from sprint tasks with new status
      return [...prev, { ...draggedTask, id: `${draggedTask.id}-moved`, status: colId as any }];
    });
    setDraggedTask(null);
    setDragOverCol(null);
  }

  function handleCreateTask(data: Partial<ProjectTask> & { status: string }) {
    const newTask: ProjectTask = {
      id: `local-${Date.now()}`,
      key: `${project.key}-L${Date.now() % 1000}`,
      title: data.title ?? "New Issue",
      status: data.status as any,
      priority: data.priority as any ?? "Medium",
      type: data.type as any ?? "Task",
      assignee: data.assignee ?? project.members[0]?.name ?? "",
      assigneeInitials: data.assignee
        ? (project.members.find(m => m.name === data.assignee)?.initials ?? "??")
        : project.members[0]?.initials ?? "??",
      assigneeColor: data.assignee
        ? (project.members.find(m => m.name === data.assignee)?.color ?? "var(--accent)")
        : project.members[0]?.color ?? "var(--accent)",
      storyPoints: data.storyPoints ?? 3,
      createdAt: new Date().toISOString().split("T")[0],
      updatedAt: new Date().toISOString().split("T")[0],
      sprint: selectedSprint?.id,
    };
    setLocalTasks(prev => [...prev, newTask]);
  }

  const sprintPct = selectedSprint
    ? Math.round((selectedSprint.donePoints / Math.max(selectedSprint.totalPoints, 1)) * 100)
    : 0;

  if (!selectedSprint) {
    return (
      <div className={styles.empty}>
        <span style={{ fontSize: 40 }}>🏃</span>
        <div className={styles.emptyTitle}>No active sprints</div>
        <div className={styles.emptyDesc}>Start a sprint from the Backlog tab to see tasks here.</div>
      </div>
    );
  }

  return (
    <div className={styles.tab}>
      {/* ── Sprint selector + info ── */}
      <div className={styles.sprintBar}>
        <div className={styles.sprintLeft}>
          {activeSprints.length > 1 ? (
            <div className={styles.sprintSelect}>
              <select
                className={styles.sprintDropdown}
                value={selectedSprint.id}
                onChange={(e) => {
                  const s = project.sprints.find(sp => sp.id === e.target.value);
                  if (s) setSelectedSprint(s);
                }}
              >
                {activeSprints.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <ExpandMoreIcon sx={{ fontSize: 16, color: "var(--text-3)" }} />
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
              <span className={styles.sStatVal} style={{ color: "var(--green)" }}>{selectedSprint.donePoints}</span>
              <span className={styles.sStatLbl}>Done pts</span>
            </div>
            <div className={styles.sStatDiv} />
            <div className={styles.sStat}>
              <span className={styles.sStatVal}>{selectedSprint.totalPoints}</span>
              <span className={styles.sStatLbl}>Total pts</span>
            </div>
            <div className={styles.sStatDiv} />
            <div className={styles.sStat}>
              <span className={styles.sStatVal} style={{ color: project.color }}>{sprintPct}%</span>
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
      </div>

      {/* ── Toolbar: member chips + search + my tasks + AI filters + create ── */}
      <div className={styles.toolbar}>
        {/* Member avatar filter chips */}
        <div className={styles.memberChips}>
          {project.members.map((m) => {
            const isActive = selectedMembers.has(m.name);
            return (
              <Tooltip key={m.id} title={`Filter by ${m.name}`} arrow>
                <button
                  className={`${styles.memberChip} ${isActive ? styles.memberChipActive : ""}`}
                  onClick={() => toggleMember(m.name)}
                  style={isActive ? { outline: `2px solid ${project.color}`, outlineOffset: 2 } : {}}
                >
                  <div
                    className={styles.memberChipAvatar}
                    style={{ background: m.color }}
                  >
                    {m.initials}
                  </div>
                </button>
              </Tooltip>
            );
          })}
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
            <SearchIcon sx={{ fontSize: 14, opacity: 0.5 }} />
            <input
              className={styles.searchInput}
              placeholder="Search tasks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className={styles.searchClear} onClick={() => setSearch("")}>✕</button>
            )}
          </div>

          {/* My Tasks */}
          <Tooltip title="Show only my tasks" arrow>
            <button
              className={`${styles.myTasksBtn} ${myTasksActive ? styles.myTasksBtnActive : ""}`}
              onClick={() => setMyTasksActive(v => !v)}
            >
              <PersonIcon sx={{ fontSize: 14 }} />
              <span>My Tasks</span>
            </button>
          </Tooltip>

          {/* AI filters */}
          <div className={styles.aiFiltersWrap}>
            <AutoAwesomeIcon sx={{ fontSize: 13, color: "var(--accent)" }} />
            <span className={styles.aiLabel}>AI:</span>
            {AI_FILTERS.map((f) => (
              <button
                key={f.id}
                className={`${styles.aiChip} ${aiFilter === f.id ? styles.aiChipActive : ""}`}
                style={aiFilter === f.id ? { color: f.color, borderColor: f.color, background: `${f.color}18` } : {}}
                onClick={() => setAiFilter(aiFilter === f.id ? null : f.id)}
              >
                {f.icon}
                {f.label}
              </button>
            ))}
          </div>

          {/* Create task */}
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { setCreateColumn("To Do"); setShowCreateModal(true); }}
          >
            <AddIcon sx={{ fontSize: 15 }} />
            Create Task
          </button>
        </div>
      </div>

      {/* ── Active filters summary ── */}
      {(selectedMembers.size > 0 || myTasksActive || aiFilter || search) && (
        <div className={styles.activeFilters}>
          <FilterListIcon sx={{ fontSize: 13, color: "var(--text-3)" }} />
          <span className={styles.activeFiltersLabel}>Filtering:</span>
          {selectedMembers.size > 0 && (
            <span className={styles.activeFilterChip}>
              {selectedMembers.size} member{selectedMembers.size > 1 ? "s" : ""}
            </span>
          )}
          {myTasksActive && <span className={styles.activeFilterChip}>My Tasks</span>}
          {aiFilter && <span className={styles.activeFilterChip}>{aiFilter}</span>}
          {search && <span className={styles.activeFilterChip}>"{search}"</span>}
          <span className={styles.activeFilterCount}>{filteredTasks.length} tasks shown</span>
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
              <div className={styles.colHeaderLeft}>
                <span className={styles.colEmoji}>{col.emoji}</span>
                <span className={styles.colLabel} style={{ color: col.color }}>{col.label}</span>
                <span className={styles.colCount} style={{ background: `${col.color}22`, color: col.color }}>
                  {col.tasks.length}
                </span>
              </div>
              <Tooltip title={`Add to ${col.label}`} arrow>
                <button
                  className={styles.colAddBtn}
                  onClick={() => { setCreateColumn(col.id); setShowCreateModal(true); }}
                >
                  <AddIcon sx={{ fontSize: 14 }} />
                </button>
              </Tooltip>
            </div>

            {/* Progress micro-bar */}
            <div className={styles.colBar}>
              <div
                className={styles.colBarFill}
                style={{
                  width: `${allSprintTasks.length > 0
                    ? (allSprintTasks.filter(t => t.status === col.id).length / allSprintTasks.length) * 100
                    : 0}%`,
                  background: col.color,
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
                  />
                ))}
              </AnimatePresence>

              {col.tasks.length === 0 && (
                <div className={styles.emptyCol}>
                  {dragOverCol === col.id
                    ? <span style={{ color: col.color }}>Drop here</span>
                    : "No tasks"
                  }
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Create task modal ── */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateTaskModal
            sprintName={selectedSprint.name}
            columnStatus={createColumn}
            project={project}
            onClose={() => setShowCreateModal(false)}
            onCreate={handleCreateTask}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Kanban Card ── */
function KanbanCard({
  task, onDragStart, onDragEnd,
}: {
  task: ProjectTask;
  projectColor?: string;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const priorityColor = getPriorityColor(task.priority);

  const typeIcons: Record<string, string> = {
    Story: "🟢", Bug: "🔴", Task: "🔵", Epic: "⚡", Subtask: "◾",
  };

  return (
    <motion.div
      className={styles.kanbanCard}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      layout
      whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}
    >
      {/* Priority indicator */}
      <div className={styles.cardPriorityBar} style={{ background: priorityColor }} />

      {/* Header */}
      <div className={styles.cardHeader}>
        <span className={styles.cardKey}>{task.key}</span>
        <span className={styles.cardTypeIcon}>{typeIcons[task.type] ?? "🔵"}</span>
      </div>

      {/* Title */}
      <div className={styles.cardTitle}>{task.title}</div>

      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className={styles.cardLabels}>
          {task.labels.map(l => (
            <span key={l} className={styles.cardLabel}>{l}</span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className={styles.cardFooter}>
        <div className={styles.cardMeta}>
          <span
            className={styles.priorityBadge}
            style={{ color: priorityColor, background: `${priorityColor}18` }}
          >
            {task.priority}
          </span>
          {task.dueDate && (
            <span
              className={styles.dueBadge}
              style={{
                color: new Date(task.dueDate) < new Date() && task.status !== "Done"
                  ? "var(--red)" : "var(--text-3)",
              }}
            >
              {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
        <div className={styles.cardRight}>
          <span className={styles.spBubble}>{task.storyPoints}</span>
          <Tooltip title={task.assignee} arrow>
            <div
              className={styles.assigneeChip}
              style={{ background: task.assigneeColor }}
            >
              {task.assigneeInitials}
            </div>
          </Tooltip>
        </div>
      </div>

      {/* Blocked banner */}
      {task.status === "Blocked" && (
        <div className={styles.blockedBanner}>
          🚫 Blocked
        </div>
      )}
    </motion.div>
  );
}
