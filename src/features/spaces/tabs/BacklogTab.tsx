import React, { useState, useMemo } from "react";
import Tooltip from "@mui/material/Tooltip";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import type { Project, ProjectTask } from "../spacesData";
import { getPriorityColor, getTaskStatusColor } from "../spacesData";
import CreateTicketDrawer from "@/features/tickets/CreateTicketDrawer";
import { createTicket, addTicketToSprint, novaQuery } from "@/services/api";
import type { TicketCreate } from "@/types";
import styles from "./BacklogTab.module.css";

import {
  RiSearchLine,
  RiFilter3Line,
  RiArrowUpDownLine,
  RiAddLine,
  RiSparklingLine,
  RiCloseLine,
} from "react-icons/ri";

const ISSUE_TYPE_ICONS: Record<string, string> = {
  Story: "🟢",
  Bug: "🔴",
  Task: "🔵",
  Epic: "⚡",
  Subtask: "◾",
};

type GroupBy = "status" | "priority" | "assignee" | "type" | "none";
type SortBy = "priority" | "created" | "updated" | "points" | "key";

const STATUS_ORDER = ["To Do", "In Progress", "In Review", "Blocked", "Done"];
const PRIORITY_ORDER = ["Critical", "High", "Medium", "Low"];

export default function BacklogTab({ project }: { project: Project }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [sortBy, setSortBy] = useState<SortBy>("priority");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(STATUS_ORDER),
  );
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [createDefaultStatus] = useState("To Do");
  const [localTasks, setLocalTasks] = useState<ProjectTask[]>([]);
  const [viewingTask, setViewingTask] = useState<ProjectTask | null>(null);

  /* ── AI Prioritize ── */
  const [aiPriLoading, setAiPriLoading] = useState(false);
  const [aiPriResult, setAiPriResult] = useState<string | null>(null);

  async function handleAiPrioritize() {
    if (backlogTasks.length === 0) {
      toast.error("No backlog tasks to prioritize");
      return;
    }
    setAiPriLoading(true);
    setAiPriResult(null);
    try {
      const taskList = backlogTasks
        .slice(0, 30)
        .map(
          (t, i) =>
            `${i + 1}. [${t.key}] ${t.title} (${t.priority}, ${t.type}, ${t.storyPoints}pts, ${t.status})`,
        )
        .join("\n");
      const res = await novaQuery(
        `You are a sprint planning assistant. Suggest a priority order for this backlog.\n\nBacklog:\n${taskList}\n\nRespond with a numbered list: the ticket key, then one sentence explaining why it should be prioritized. Focus on blockers, high priority, and bugs first.`,
      );
      setAiPriResult(res.answer);
    } catch {
      toast.error("EOS prioritization failed");
    } finally {
      setAiPriLoading(false);
    }
  }

  const moveMut = useMutation({
    mutationFn: ({
      sprintId,
      ticketKey,
    }: {
      sprintId: string;
      ticketKey: string;
    }) => addTicketToSprint(sprintId, ticketKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["space-project", project.key] });
      toast.success("Moved to sprint");
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
      setTimeout(() => setLocalTasks([]), 400);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setLocalTasks([]);
    },
  });

  function handleMoveToSprint(sprintId: string, ticketKey: string) {
    moveMut.mutate({ sprintId, ticketKey });
  }

  function handleBulkMoveToSprint(sprintId: string) {
    if (selected.size === 0) return;
    const keys = Array.from(selected);
    Promise.all(keys.map((k) => addTicketToSprint(sprintId, k)))
      .then(() => {
        qc.invalidateQueries({ queryKey: ["space-project", project.key] });
        toast.success(
          `Moved ${keys.length} ticket${keys.length > 1 ? "s" : ""} to sprint`,
        );
        setSelected(new Set());
      })
      .catch((e) => toast.error(e.message));
  }

  const sprints = project.sprints.filter((s) => s.id !== "backlog");

  // Prefer dedicated backlog tasks; fall back to all sprint tasks for compatibility
  const allTasks: ProjectTask[] = useMemo(() => {
    const base =
      project.backlogTasks && project.backlogTasks.length > 0
        ? project.backlogTasks
        : project.sprints.flatMap((s) => s.tasks);
    return [...localTasks, ...base];
  }, [project, localTasks]);

  const backlogTasks = useMemo(() => {
    let tasks = allTasks.filter((t) => {
      if (search) {
        const q = search.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          t.key.toLowerCase().includes(q) ||
          (t.assignee || "").toLowerCase().includes(q)
        );
      }
      return true;
    });

    // Sort
    tasks = [...tasks].sort((a, b) => {
      if (sortBy === "priority")
        return (
          PRIORITY_ORDER.indexOf(a.priority) -
          PRIORITY_ORDER.indexOf(b.priority)
        );
      if (sortBy === "points") return b.storyPoints - a.storyPoints;
      if (sortBy === "key") return a.key.localeCompare(b.key);
      return 0;
    });

    return tasks;
  }, [allTasks, search, sortBy]);

  // Group tasks
  const grouped = useMemo(() => {
    const map = new Map<string, ProjectTask[]>();

    if (groupBy === "none") {
      map.set("All Tasks", backlogTasks);
      return map;
    }

    const keys =
      groupBy === "status"
        ? STATUS_ORDER
        : groupBy === "priority"
          ? PRIORITY_ORDER
          : groupBy === "type"
            ? ["Story", "Bug", "Task", "Epic", "Subtask"]
            : [...new Set(backlogTasks.map((t) => t.assignee || "—"))].sort();

    keys.forEach((k) => {
      const tasks = backlogTasks.filter((t) => {
        if (groupBy === "status") return t.status === k;
        if (groupBy === "priority") return t.priority === k;
        if (groupBy === "type") return t.type === k;
        return (t.assignee || "—") === k;
      });
      if (tasks.length > 0) map.set(k, tasks);
    });

    return map;
  }, [backlogTasks, groupBy]);

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const totalSP = backlogTasks.reduce((s, t) => s + t.storyPoints, 0);

  return (
    <div className={styles.tab}>
      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <RiSearchLine size={15} style={{ opacity: 0.5 }} />
          <input
            className={styles.searchInput}
            placeholder="Search tasks, keys, assignees…"
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
          {/* Group by */}
          <div className={styles.selectWrap}>
            <RiFilter3Line size={14} />
            <select
              className={styles.select}
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            >
              <option value="status">Group: Status</option>
              <option value="priority">Group: Priority</option>
              <option value="assignee">Group: Assignee</option>
              <option value="type">Group: Type</option>
              <option value="none">No Grouping</option>
            </select>
          </div>

          {/* Sort by */}
          <div className={styles.selectWrap}>
            <RiArrowUpDownLine size={14} />
            <select
              className={styles.select}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
            >
              <option value="priority">Sort: Priority</option>
              <option value="points">Sort: Story Points</option>
              <option value="key">Sort: Key</option>
              <option value="created">Sort: Created</option>
            </select>
          </div>

          {selected.size > 0 && sprints.length > 0 && (
            <div className={styles.selectWrap}>
              <select
                className={styles.select}
                value=""
                onChange={(e) => handleBulkMoveToSprint(e.target.value)}
                disabled={moveMut.isPending}
              >
                <option value="">Move to sprint…</option>
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            className={styles.aiPriBtn}
            onClick={handleAiPrioritize}
            disabled={aiPriLoading}
          >
            {aiPriLoading ? (
              <>
                <span className={styles.aiPriSpinner} /> Analysing…
              </>
            ) : (
              <>
                <RiSparklingLine size={12} /> AI Prioritize
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── AI Priority Panel ── */}
      {aiPriResult && (
        <div className={styles.aiPriPanel}>
          <div className={styles.aiPriHeader}>
            <span className={styles.aiPriTitle}>
              <RiSparklingLine size={13} /> EOS Priority Suggestion
            </span>
            <button
              className={styles.aiPriClose}
              onClick={() => setAiPriResult(null)}
            >
              <RiCloseLine size={16} />
            </button>
          </div>
          <div className={styles.aiPriText}>{aiPriResult}</div>
        </div>
      )}

      {/* ── Stats strip ── */}
      <div className={styles.statsStrip}>
        <div className={styles.stripItem}>
          <span className={styles.stripVal}>{backlogTasks.length}</span>
          <span className={styles.stripLbl}>Issues</span>
        </div>
        <div className={styles.stripDivider} />
        <div className={styles.stripItem}>
          <span className={styles.stripVal} style={{ color: "var(--amber)" }}>
            {backlogTasks.filter((t) => t.status === "In Progress").length}
          </span>
          <span className={styles.stripLbl}>In Progress</span>
        </div>
        <div className={styles.stripDivider} />
        <div className={styles.stripItem}>
          <span className={styles.stripVal} style={{ color: "var(--red)" }}>
            {backlogTasks.filter((t) => t.status === "Blocked").length}
          </span>
          <span className={styles.stripLbl}>Blocked</span>
        </div>
        <div className={styles.stripDivider} />
        <div className={styles.stripItem}>
          <span className={styles.stripVal}>{totalSP}</span>
          <span className={styles.stripLbl}>Story Points</span>
        </div>
        {selected.size > 0 && (
          <>
            <div className={styles.stripDivider} />
            <div className={styles.stripItem}>
              <span
                className={styles.stripVal}
                style={{ color: "var(--accent)" }}
              >
                {selected.size}
              </span>
              <span className={styles.stripLbl}>Selected</span>
            </div>
          </>
        )}
      </div>

      {/* ── Table header ── */}
      <div className={styles.tableHeader}>
        <div className={styles.thCheck} />
        <div className={styles.thKey}>Key</div>
        <div className={styles.thTitle}>Summary</div>
        <div className={styles.thType}>Type</div>
        <div className={styles.thPriority}>Priority</div>
        <div className={styles.thStatus}>Status</div>
        <div className={styles.thAssignee}>Assignee</div>
        <div className={styles.thSP}>SP</div>
        <div className={styles.thDue}>Due</div>
        <div className={styles.thAction} />
      </div>

      {/* ── Groups ── */}
      <div className={styles.groups}>
        {Array.from(grouped.entries()).map(([groupKey, tasks]) => {
          const isExpanded = expandedGroups.has(groupKey);
          const groupSP = tasks.reduce((s, t) => s + t.storyPoints, 0);

          return (
            <div key={groupKey} className={styles.group}>
              {/* Group header */}
              <button
                className={styles.groupHeader}
                onClick={() => toggleGroup(groupKey)}
              >
                <span
                  className={styles.groupArrow}
                  style={{ transform: isExpanded ? "rotate(90deg)" : "none" }}
                >
                  ›
                </span>
                <span className={styles.groupLabel}>{groupKey}</span>
                <span className={styles.groupCount}>{tasks.length}</span>
                <span className={styles.groupSP}>{groupSP} pts</span>
              </button>

              {/* Rows */}
              {isExpanded && (
                <div className={styles.rows}>
                  {tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      selected={selected.has(task.id)}
                      onSelect={() => toggleSelect(task.id)}
                      sprints={sprints}
                      onMoveToSprint={handleMoveToSprint}
                      onClick={() => setViewingTask(task)}
                    />
                  ))}
                  {/* Add issue row */}
                  {/* <div
                    className={styles.addRow}
                    onClick={() => setShowCreateDrawer(true)}
                  >
                    <RiAddLine size={13} color="var(--text-3)" />
                    <span className={styles.addRowText}>Add issue</span>
                  </div> */}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {viewingTask && (
        <CreateTicketDrawer
          open={Boolean(viewingTask)}
          onClose={() => {
            setViewingTask(null);
            qc.invalidateQueries({ queryKey: ["space-project", project.key] });
          }}
          ticketKey={viewingTask.key}
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
          }}
          members={project.members}
        />
      )}

      <CreateTicketDrawer
        open={showCreateDrawer}
        onClose={() => setShowCreateDrawer(false)}
        defaultStatus={createDefaultStatus}
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
            status: data.status || createDefaultStatus,
          };
          const tempTask: ProjectTask = {
            id: `local-${Date.now()}`,
            key: `${project.key}-L${Date.now() % 1000}`,
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
          };
          setLocalTasks((prev) => [...prev, tempTask]);
          createMut.mutate(payload);
        }}
      />
    </div>
  );
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

const TaskRow = React.memo(function TaskRow({
  task,
  selected,
  onSelect,
  sprints,
  onMoveToSprint,
  onClick,
}: {
  task: ProjectTask;
  selected: boolean;
  onSelect: () => void;
  sprints: Project["sprints"];
  onMoveToSprint: (sprintId: string, ticketKey: string) => void;
  onClick?: () => void;
}) {
  const priorityColor = getPriorityColor(task.priority);
  const statusColor = getTaskStatusColor(task.status);

  return (
    <div
      className={`${styles.row} ${selected ? styles.rowSelected : ""}`}
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
        <span className={styles.issueTypeIcon}>
          {ISSUE_TYPE_ICONS[task.type] ?? "🔵"}
        </span>
        <span className={styles.titleText}>{task.title}</span>
        {task.labels?.map((l) => (
          <span key={l} className={styles.labelTag}>
            {l}
          </span>
        ))}
      </div>
      <div className={styles.tdType}>
        <span className={styles.typeChip}>{task.type}</span>
      </div>
      <div className={styles.tdPriority}>
        <span
          className={styles.priorityDot}
          style={{ background: priorityColor }}
        />
        <span className={styles.priorityLabel} style={{ color: priorityColor }}>
          {task.priority}
        </span>
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
        <span className={styles.spBadge}>{task.storyPoints}</span>
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
      <div
        className={styles.tdAction}
        style={{ display: "flex", alignItems: "center", gap: 8 }}
      >
        {sprints.length > 0 && (
          <select
            className={styles.select}
            style={{ fontSize: 11, padding: "2px 6px" }}
            value=""
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              if (e.target.value) {
                onMoveToSprint(e.target.value, task.key);
              }
            }}
          >
            <option value="">To sprint…</option>
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
});
