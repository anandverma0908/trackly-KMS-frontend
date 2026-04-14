import { useState, useMemo } from "react";
import Tooltip from "@mui/material/Tooltip";
import type { Project, ProjectTask } from "../spacesData";
import { getPriorityColor, getTaskStatusColor } from "../spacesData";
import styles from "./BacklogTab.module.css";

import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import SortIcon from "@mui/icons-material/Sort";
import AddIcon from "@mui/icons-material/Add";

const ISSUE_TYPE_ICONS: Record<string, string> = {
  Story:   "🟢",
  Bug:     "🔴",
  Task:    "🔵",
  Epic:    "⚡",
  Subtask: "◾",
};

type GroupBy = "status" | "priority" | "assignee" | "type" | "none";
type SortBy  = "priority" | "created" | "updated" | "points" | "key";

const STATUS_ORDER = ["To Do", "In Progress", "In Review", "Blocked", "Done"];
const PRIORITY_ORDER = ["Critical", "High", "Medium", "Low"];

export default function BacklogTab({ project }: { project: Project }) {
  const [search, setSearch]   = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [sortBy, setSortBy]   = useState<SortBy>("priority");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(STATUS_ORDER));

  // All tasks across all sprints (backlog = not in active sprint + future sprint tasks)
  const allTasks: ProjectTask[] = useMemo(() => {
    return project.sprints.flatMap((s) => s.tasks);
  }, [project]);

  const backlogTasks = useMemo(() => {
    let tasks = allTasks.filter((t) => {
      if (search) {
        const q = search.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          t.key.toLowerCase().includes(q) ||
          t.assignee.toLowerCase().includes(q)
        );
      }
      return true;
    });

    // Sort
    tasks = [...tasks].sort((a, b) => {
      if (sortBy === "priority")
        return PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
      if (sortBy === "points") return b.storyPoints - a.storyPoints;
      if (sortBy === "key")    return a.key.localeCompare(b.key);
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
      groupBy === "status"   ? STATUS_ORDER :
      groupBy === "priority" ? PRIORITY_ORDER :
      groupBy === "type"     ? ["Story", "Bug", "Task", "Epic", "Subtask"] :
      [...new Set(backlogTasks.map((t) => t.assignee))].sort();

    keys.forEach((k) => {
      const tasks = backlogTasks.filter((t) => {
        if (groupBy === "status")   return t.status === k;
        if (groupBy === "priority") return t.priority === k;
        if (groupBy === "type")     return t.type === k;
        return t.assignee === k;
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
          <SearchIcon sx={{ fontSize: 15, opacity: 0.5 }} />
          <input
            className={styles.searchInput}
            placeholder="Search tasks, keys, assignees…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className={styles.clearBtn} onClick={() => setSearch("")}>✕</button>
          )}
        </div>

        <div className={styles.toolbarRight}>
          {/* Group by */}
          <div className={styles.selectWrap}>
            <FilterListIcon sx={{ fontSize: 14 }} />
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
            <SortIcon sx={{ fontSize: 14 }} />
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

          <button className="btn btn-primary btn-sm">
            <AddIcon sx={{ fontSize: 15 }} />
            Create Issue
          </button>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className={styles.statsStrip}>
        <div className={styles.stripItem}>
          <span className={styles.stripVal}>{backlogTasks.length}</span>
          <span className={styles.stripLbl}>Issues</span>
        </div>
        <div className={styles.stripDivider} />
        <div className={styles.stripItem}>
          <span className={styles.stripVal} style={{ color: "var(--amber)" }}>
            {backlogTasks.filter(t => t.status === "In Progress").length}
          </span>
          <span className={styles.stripLbl}>In Progress</span>
        </div>
        <div className={styles.stripDivider} />
        <div className={styles.stripItem}>
          <span className={styles.stripVal} style={{ color: "var(--red)" }}>
            {backlogTasks.filter(t => t.status === "Blocked").length}
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
              <span className={styles.stripVal} style={{ color: "var(--accent)" }}>{selected.size}</span>
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
      </div>

      {/* ── Groups ── */}
      <div className={styles.groups}>
        {Array.from(grouped.entries()).map(([groupKey, tasks]) => {
          const isExpanded = expandedGroups.has(groupKey);
          const groupSP    = tasks.reduce((s, t) => s + t.storyPoints, 0);

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
                    />
                  ))}
                  {/* Add issue row */}
                  <div className={styles.addRow}>
                    <AddIcon sx={{ fontSize: 13, color: "var(--text-3)" }} />
                    <span className={styles.addRowText}>Add issue</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskRow({
  task, selected, onSelect,
}: {
  task: ProjectTask;
  selected: boolean;
  onSelect: () => void;
}) {
  const priorityColor = getPriorityColor(task.priority);
  const statusColor   = getTaskStatusColor(task.status);

  return (
    <div className={`${styles.row} ${selected ? styles.rowSelected : ""}`}>
      <div className={styles.tdCheck}>
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
        {task.labels?.map((l) => (
          <span key={l} className={styles.labelTag}>{l}</span>
        ))}
      </div>
      <div className={styles.tdType}>
        <span className={styles.typeChip}>{task.type}</span>
      </div>
      <div className={styles.tdPriority}>
        <span className={styles.priorityDot} style={{ background: priorityColor }} />
        <span className={styles.priorityLabel} style={{ color: priorityColor }}>{task.priority}</span>
      </div>
      <div className={styles.tdStatus}>
        <span
          className={styles.statusChip}
          style={{ color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}33` }}
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
              color: new Date(task.dueDate) < new Date() ? "var(--red)" : "var(--text-2)",
            }}
          >
            {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        ) : (
          <span className={styles.noDue}>—</span>
        )}
      </div>
    </div>
  );
}
