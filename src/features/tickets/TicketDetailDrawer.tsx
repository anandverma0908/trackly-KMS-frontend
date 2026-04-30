import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import SideDrawer from "@/components/ui/SideDrawer";
import {
  fetchTicket,
  updateTicket,
  updateTicketStatus,
  fetchTicketComments,
  createComment,
  fetchTicketWorklogs,
  fetchTicketActivity,
  fetchTicketLinks,
  createTicketLink,
  deleteTicketLink,
  searchTickets,
  linkTicketToEpic,
  fetchSubtasks,
  createSubtask,
  unlinkSubtask,
  fetchCustomFields,
  fetchOrgUsers,
} from "@/services/api";
import type { Ticket, TicketComment, TicketActivity } from "@/types";
import type { TicketLink } from "@/services/api";
import type { ProjectMember, ProjectEpic } from "@/features/spaces/spacesData";
import styles from "./TicketDetailDrawer.module.css";

import {
  RiLink,
  RiAddLine,
  RiDeleteBinLine,
  RiTimeLine,
  RiMessage3Line,
  RiListCheck2,
  RiSparklingLine,
  RiCheckboxCircleLine,
  RiCheckboxBlankCircleLine,
} from "react-icons/ri";

type DetailTab = "activity" | "subtasks" | "links";

const LINK_TYPE_OPTIONS = ["blocks", "is blocked by", "duplicates", "relates to", "clones"];
const STATUS_OPTIONS = ["To Do", "In Progress", "In Review", "Blocked", "Done"];
const PRIORITY_OPTIONS = ["Critical", "High", "Medium", "Low"];

export default function TicketDetailDrawer({
  open,
  onClose,
  ticketKey,
  members = [],
  epics = [],
  sprints = [],
  onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  ticketKey: string;
  members?: ProjectMember[];
  epics?: ProjectEpic[];
  sprints?: { id: string; name: string }[];
  onUpdated?: () => void;
}) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<DetailTab>("activity");

  /* ── Fetch ticket ── */
  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", ticketKey],
    queryFn: () => fetchTicket(ticketKey),
    enabled: open && !!ticketKey,
  });

  /* ── Local edit state ── */
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  /* ── Mutations ── */
  const updateMut = useMutation({
    mutationFn: (payload: Partial<Ticket>) => updateTicket(ticketKey, payload as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", ticketKey] });
      qc.invalidateQueries({ queryKey: ["space-project"] });
      onUpdated?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: (status: string) => updateTicketStatus(ticketKey, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", ticketKey] });
      qc.invalidateQueries({ queryKey: ["space-project"] });
      onUpdated?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function startEdit(field: string, value: string) {
    setEditField(field);
    setEditValue(value);
  }

  function commitEdit(field: string) {
    if (!editValue.trim() && field !== "description") {
      setEditField(null);
      return;
    }
    const payload: Record<string, any> = {};
    if (field === "title") payload.summary = editValue;
    else if (field === "story_points") payload.story_points = Number(editValue) || 0;
    else if (field === "due_date") payload.due_date = editValue || null;
    else payload[field] = editValue;
    updateMut.mutate(payload);
    setEditField(null);
  }

  function handleKeyDown(e: React.KeyboardEvent, field: string) {
    if (e.key === "Enter") commitEdit(field);
    if (e.key === "Escape") setEditField(null);
  }

  if (isLoading || !ticket) {
    return (
      <SideDrawer open={open} onClose={onClose} size="lg" title="Loading…">
        <div className={styles.loading}>Loading ticket details…</div>
      </SideDrawer>
    );
  }

  const statusColor = (() => {
    const s = ticket.status;
    if (s === "Done") return "var(--green)";
    if (s === "Blocked") return "var(--red)";
    if (s === "In Progress") return "var(--amber)";
    if (s === "In Review") return "var(--purple)";
    return "var(--text-3)";
  })();

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      size="lg"
      title={ticket.key}
      badge={
        <span
          className={styles.statusBadge}
          style={{ color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}33` }}
        >
          {ticket.status}
        </span>
      }
    >
      <div className={styles.container}>
        {/* ── Left Panel ── */}
        <div className={styles.leftPanel}>
          {/* Title */}
          <div className={styles.fieldBlock}>
            {editField === "title" ? (
              <input
                className={styles.titleInput}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => commitEdit("title")}
                onKeyDown={(e) => handleKeyDown(e, "title")}
                autoFocus
              />
            ) : (
              <h2 className={styles.title} onClick={() => startEdit("title", ticket.summary)}>
                {ticket.summary}
              </h2>
            )}
          </div>

          {/* Description */}
          <div className={styles.fieldBlock}>
            <label className={styles.fieldLabel}>Description</label>
            {editField === "description" ? (
              <textarea
                className={styles.descInput}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => commitEdit("description")}
                onKeyDown={(e) => handleKeyDown(e, "description")}
                autoFocus
                rows={6}
              />
            ) : (
              <div className={styles.description} onClick={() => startEdit("description", ticket.description || "")}>
                {ticket.description || <span className={styles.placeholder}>Add a description…</span>}
              </div>
            )}
          </div>

          {/* Inline Fields Grid */}
          <div className={styles.fieldsGrid}>
            <InlineSelect
              label="Priority"
              value={ticket.priority || "Medium"}
              options={PRIORITY_OPTIONS}
              onChange={(v) => updateMut.mutate({ priority: v })}
            />
            <InlineSelect
              label="Status"
              value={ticket.status || "To Do"}
              options={STATUS_OPTIONS}
              onChange={(v) => statusMut.mutate(v)}
            />
            <InlineSelect
              label="Assignee"
              value={ticket.assignee || ""}
              options={members.map((m) => m.name)}
              onChange={(v) => updateMut.mutate({ assignee: v })}
              allowClear
            />
            <InlineSelect
              label="Epic"
              value={ticket.epic || ""}
              options={epics.map((e) => e.id)}
              optionLabels={epics.reduce((acc, e) => { acc[e.id] = e.title; return acc; }, {} as Record<string, string>)}
              onChange={(v) => linkTicketToEpic(ticketKey, v || null).then(() => {
                qc.invalidateQueries({ queryKey: ["ticket", ticketKey] });
                qc.invalidateQueries({ queryKey: ["space-project"] });
              })}
              allowClear
            />
            <InlineSelect
              label="Sprint"
              value={ticket.sprint_id || ""}
              options={sprints.map((s) => s.id)}
              optionLabels={sprints.reduce((acc, s) => { acc[s.id] = s.name; return acc; }, {} as Record<string, string>)}
              onChange={(v) => updateMut.mutate({ sprint_id: v || null })}
              allowClear
            />
            <InlineField
              label="Story Points"
              value={String(ticket.story_points || "")}
              onCommit={(v) => updateMut.mutate({ story_points: Number(v) || 0 })}
            />
            <InlineField
              label="Due Date"
              value={ticket.due_date ? ticket.due_date.slice(0, 10) : ""}
              onCommit={(v) => updateMut.mutate({ due_date: v || undefined })}
              type="date"
            />
          </div>

          {/* Custom Fields */}
          <CustomFieldsSection ticket={ticket} updateMut={updateMut} />
        </div>

        {/* ── Right Panel ── */}
        <div className={styles.rightPanel}>
          <div className={styles.tabBar}>
            <button className={`${styles.tabBtn} ${activeTab === "activity" ? styles.tabActive : ""}`} onClick={() => setActiveTab("activity")}>
              <RiMessage3Line size={13} /> Activity
            </button>
            <button className={`${styles.tabBtn} ${activeTab === "subtasks" ? styles.tabActive : ""}`} onClick={() => setActiveTab("subtasks")}>
              <RiListCheck2 size={13} /> Sub-tasks
            </button>
            <button className={`${styles.tabBtn} ${activeTab === "links" ? styles.tabActive : ""}`} onClick={() => setActiveTab("links")}>
              <RiLink size={13} /> Linked Issues
            </button>
          </div>

          <div className={styles.tabContent}>
            {activeTab === "activity" && <ActivityTab ticketKey={ticketKey} />}
            {activeTab === "subtasks" && <SubtasksTab ticketKey={ticketKey} />}
            {activeTab === "links" && <LinksTab ticketKey={ticketKey} />}
          </div>
        </div>
      </div>
    </SideDrawer>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Inline Field Components                                                   */
/* ══════════════════════════════════════════════════════════════════════════ */

function InlineField({
  label,
  value,
  onCommit,
  type = "text",
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  type?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);

  useEffect(() => { setLocal(value); }, [value]);

  if (editing) {
    return (
      <div className={styles.inlineField}>
        <label className={styles.inlineLabel}>{label}</label>
        <input
          type={type}
          className={styles.inlineInput}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => { onCommit(local); setEditing(false); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { onCommit(local); setEditing(false); }
            if (e.key === "Escape") { setLocal(value); setEditing(false); }
          }}
          autoFocus
        />
      </div>
    );
  }

  return (
    <div className={styles.inlineField} onClick={() => setEditing(true)}>
      <label className={styles.inlineLabel}>{label}</label>
      <div className={styles.inlineValue}>{value || <span className={styles.placeholder}>—</span>}</div>
    </div>
  );
}

function InlineSelect({
  label,
  value,
  options,
  optionLabels,
  onChange,
  allowClear,
}: {
  label: string;
  value: string;
  options: string[];
  optionLabels?: Record<string, string>;
  onChange: (v: string) => void;
  allowClear?: boolean;
}) {
  return (
    <div className={styles.inlineField}>
      <label className={styles.inlineLabel}>{label}</label>
      <select
        className={styles.inlineSelect}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {allowClear && <option value="">—</option>}
        {options.map((o) => (
          <option key={o} value={o}>{optionLabels?.[o] ?? o}</option>
        ))}
      </select>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Activity Tab (Comments + Worklogs)                                        */
/* ══════════════════════════════════════════════════════════════════════════ */

function ActivityTab({ ticketKey }: { ticketKey: string }) {
  const qc = useQueryClient();
  const { data: comments = [] } = useQuery({
    queryKey: ["ticket-comments", ticketKey],
    queryFn: () => fetchTicketComments(ticketKey),
    enabled: !!ticketKey,
  });
  const { data: worklogs = [] } = useQuery({
    queryKey: ["ticket-worklogs", ticketKey],
    queryFn: () => fetchTicketWorklogs(ticketKey),
    enabled: !!ticketKey,
  });
  const { data: activity = [] } = useQuery({
    queryKey: ["ticket-activity", ticketKey],
    queryFn: () => fetchTicketActivity(ticketKey),
    enabled: !!ticketKey,
  });

  const [commentText, setCommentText] = useState("");
  const [mentionSuggestions, setMentionSuggestions] = useState<{ id: string; name: string }[]>([]);
  const [mentionIdx, setMentionIdx] = useState(0);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  const { data: orgUsers = [] } = useQuery({
    queryKey: ["org-users"],
    queryFn: fetchOrgUsers,
    staleTime: 60_000,
  });

  const commentMut = useMutation({
    mutationFn: (body: string) => createComment(ticketKey, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-comments", ticketKey] });
      qc.invalidateQueries({ queryKey: ["ticket-activity", ticketKey] });
      setCommentText("");
      setMentionSuggestions([]);
      setMentionSuggestions([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleCommentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setCommentText(val);
    // Detect @mention trigger
    const cursor = e.target.selectionStart ?? val.length;
    const textToCursor = val.slice(0, cursor);
    const match = textToCursor.match(/@([\w.]*)$/);
    if (match) {
      const q = match[1].toLowerCase();
      const filtered = orgUsers
        .filter((u) => u.name.toLowerCase().includes(q) || u.name.toLowerCase().replace(" ", ".").includes(q))
        .slice(0, 6);
      setMentionSuggestions(filtered);
      setMentionIdx(0);
    } else {
      setMentionSuggestions([]);
      setMentionSuggestions([]);
    }
  }

  function handleCommentKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionSuggestions.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIdx((i) => Math.min(i + 1, mentionSuggestions.length - 1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setMentionIdx((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(mentionSuggestions[mentionIdx]); return; }
      if (e.key === "Escape") { setMentionSuggestions([]); setMentionSuggestions([]); return; }
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (commentText.trim()) commentMut.mutate(commentText);
    }
  }

  function insertMention(user: { name: string }) {
    const el = commentRef.current;
    if (!el) return;
    const cursor = el.selectionStart ?? commentText.length;
    const before = commentText.slice(0, cursor).replace(/@[\w.]*$/, `@${user.name.replace(" ", ".")} `);
    const after  = commentText.slice(cursor);
    const next   = before + after;
    setCommentText(next);
    setMentionSuggestions([]);
    setMentionSuggestions([]);
    setTimeout(() => { el.focus(); el.setSelectionRange(before.length, before.length); }, 0);
  }

  const allItems = useMemo(() => {
    const items: { type: "comment" | "worklog" | "activity"; date: string; data: any }[] = [];
    comments.forEach((c) => items.push({ type: "comment", date: c.created_at, data: c }));
    worklogs.forEach((w) => items.push({ type: "worklog", date: w.log_date, data: w }));
    activity.forEach((a) => items.push({ type: "activity", date: a.created_at, data: a }));
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [comments, worklogs, activity]);

  return (
    <div className={styles.activityTab}>
      {/* Add comment */}
      <div className={styles.composeBox} style={{ position: "relative" }}>
        <textarea
          ref={commentRef}
          className={styles.composeInput}
          placeholder="Write a comment… Use @name to mention someone"
          value={commentText}
          onChange={handleCommentChange}
          onKeyDown={handleCommentKeyDown}
          rows={2}
        />
        {/* @mention autocomplete dropdown */}
        {mentionSuggestions.length > 0 && (
          <div style={{
            position: "absolute", bottom: "100%", left: 0, zIndex: 200,
            background: "var(--surface)", border: "1px solid var(--border-2)",
            borderRadius: 8, boxShadow: "var(--shadow-lg)", minWidth: 200, overflow: "hidden",
          }}>
            {mentionSuggestions.map((u, i) => (
              <button
                key={u.id}
                onMouseDown={(e) => { e.preventDefault(); insertMention(u); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                  padding: "7px 12px", fontSize: 13, textAlign: "left",
                  background: i === mentionIdx ? "var(--surface-2)" : "transparent",
                  color: "var(--text)", border: "none", cursor: "pointer",
                }}
              >
                <span style={{
                  width: 24, height: 24, borderRadius: "50%", fontSize: 11, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "var(--accent-glow)", color: "var(--accent)",
                }}>{u.name[0]}</span>
                {u.name}
              </button>
            ))}
          </div>
        )}
        <div className={styles.composeActions}>
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>⌘↵ to send</span>
          <button className={styles.composeBtn} onClick={() => commentMut.mutate(commentText)} disabled={!commentText.trim() || commentMut.isPending}>
            <RiMessage3Line size={12} /> Comment
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className={styles.timeline}>
        {allItems.map((item, idx) => (
          <div key={idx} className={styles.timelineItem}>
            {item.type === "comment" && <CommentRow comment={item.data} />}
            {item.type === "worklog" && <WorklogRow worklog={item.data} />}
            {item.type === "activity" && <ActivityRow activity={item.data} />}
          </div>
        ))}
        {allItems.length === 0 && <div className={styles.emptyTab}>No activity yet.</div>}
      </div>
    </div>
  );
}

function renderWithMentions(text: string) {
  const parts = text.split(/(@[\w.]+)/g);
  return parts.map((part, i) =>
    /^@[\w.]+$/.test(part)
      ? <span key={i} style={{ color: "var(--accent)", fontWeight: 600 }}>{part}</span>
      : part
  );
}

function CommentRow({ comment }: { comment: TicketComment }) {
  return (
    <div className={styles.commentRow}>
      <div className={styles.commentAvatar}>{(comment.author || "?")[0]}</div>
      <div className={styles.commentBody}>
        <div className={styles.commentHeader}>
          <span className={styles.commentAuthor}>{comment.author}</span>
          <span className={styles.commentDate}>{new Date(comment.created_at).toLocaleDateString()}</span>
        </div>
        <p className={styles.commentText}>{renderWithMentions(comment.content)}</p>
      </div>
    </div>
  );
}

function WorklogRow({ worklog }: { worklog: any }) {
  return (
    <div className={styles.activityRow}>
      <RiTimeLine size={13} color="var(--accent)" />
      <span className={styles.activityText}>
        <strong>{worklog.author}</strong> logged <strong>{worklog.hours}h</strong>
        {worklog.comment && <> — {worklog.comment}</>}
      </span>
      <span className={styles.activityDate}>{worklog.log_date}</span>
    </div>
  );
}

function ActivityRow({ activity }: { activity: TicketActivity }) {
  return (
    <div className={styles.activityRow}>
      <RiSparklingLine size={13} color="var(--text-3)" />
      <span className={styles.activityText}>
        <strong>{activity.actor}</strong> {activity.action}
        {activity.field && (
          <> on <strong>{activity.field}</strong></>
        )}
      </span>
      <span className={styles.activityDate}>{new Date(activity.created_at).toLocaleDateString()}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Sub-tasks Tab                                                             */
/* ══════════════════════════════════════════════════════════════════════════ */

function SubtasksTab({ ticketKey }: { ticketKey: string }) {
  const qc = useQueryClient();
  const { data: subtasks = [] } = useQuery({
    queryKey: ["ticket-subtasks", ticketKey],
    queryFn: () => fetchSubtasks(ticketKey),
    enabled: !!ticketKey,
  });

  const [newSummary, setNewSummary] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [newPoints, setNewPoints] = useState("");

  const createMut = useMutation({
    mutationFn: () => createSubtask(ticketKey, {
      summary: newSummary,
      assignee: newAssignee || undefined,
      story_points: newPoints ? Number(newPoints) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-subtasks", ticketKey] });
      qc.invalidateQueries({ queryKey: ["ticket", ticketKey] });
      setNewSummary("");
      setNewAssignee("");
      setNewPoints("");
      toast.success("Sub-task created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleStatusMut = useMutation({
    mutationFn: (sub: Ticket) => updateTicketStatus(sub.key, sub.status === "Done" ? "To Do" : "Done"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ticket-subtasks", ticketKey] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const unlinkMut = useMutation({
    mutationFn: (childKey: string) => unlinkSubtask(ticketKey, childKey),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ticket-subtasks", ticketKey] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const doneCount = subtasks.filter((s) => s.status === "Done").length;
  const totalCount = subtasks.length;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className={styles.subtasksTab}>
      {totalCount > 0 && (
        <div className={styles.subtaskProgress}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress}%`, background: "var(--green)" }} />
          </div>
          <span className={styles.progressLabel}>{doneCount} of {totalCount} done</span>
        </div>
      )}

      <div className={styles.subtaskList}>
        {subtasks.map((sub) => (
          <div key={sub.key} className={styles.subtaskRow}>
            <button
              className={styles.subtaskCheck}
              onClick={() => toggleStatusMut.mutate(sub)}
            >
              {sub.status === "Done" ? (
                <RiCheckboxCircleLine size={16} color="var(--green)" />
              ) : (
                <RiCheckboxBlankCircleLine size={16} color="var(--text-3)" />
              )}
            </button>
            <span className={`${styles.subtaskTitle} ${sub.status === "Done" ? styles.subtaskDone : ""}`}>
              {sub.summary}
            </span>
            {sub.story_points ? <span className={styles.subtaskSP}>{sub.story_points}pt</span> : null}
            {sub.assignee && <span className={styles.subtaskAssignee}>{sub.assignee}</span>}
            <button className={styles.subtaskDelete} onClick={() => unlinkMut.mutate(sub.key)}>
              <RiDeleteBinLine size={12} />
            </button>
          </div>
        ))}
      </div>

      <div className={styles.subtaskComposer}>
        <input
          className={styles.inlineInput}
          placeholder="Add a subtask…"
          value={newSummary}
          onChange={(e) => setNewSummary(e.target.value)}
        />
        <div className={styles.subtaskComposerRow}>
          <input
            className={styles.inlineInput}
            placeholder="Assignee"
            value={newAssignee}
            onChange={(e) => setNewAssignee(e.target.value)}
            style={{ width: 120 }}
          />
          <input
            type="number"
            className={styles.inlineInput}
            placeholder="SP"
            value={newPoints}
            onChange={(e) => setNewPoints(e.target.value)}
            style={{ width: 60 }}
          />
          <button
            className={styles.composeBtn}
            onClick={() => createMut.mutate()}
            disabled={!newSummary.trim() || createMut.isPending}
          >
            <RiAddLine size={12} /> Add
          </button>
        </div>
      </div>

      {subtasks.length === 0 && (
        <div className={styles.emptyTab}>No sub-tasks yet. Add one above.</div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Linked Issues Tab                                                         */
/* ══════════════════════════════════════════════════════════════════════════ */

function LinksTab({ ticketKey }: { ticketKey: string }) {
  const qc = useQueryClient();
  const { data: links = [] } = useQuery({
    queryKey: ["ticket-links", ticketKey],
    queryFn: () => fetchTicketLinks(ticketKey),
    enabled: !!ticketKey,
  });

  const [linkType, setLinkType] = useState(LINK_TYPE_OPTIONS[0]);
  const [targetKey, setTargetKey] = useState("");
  const [suggestions, setSuggestions] = useState<{ key: string; summary: string }[]>([]);

  const createLinkMut = useMutation({
    mutationFn: () => createTicketLink(ticketKey, linkType, targetKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-links", ticketKey] });
      setTargetKey("");
      toast.success("Link added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteLinkMut = useMutation({
    mutationFn: (linkId: string) => deleteTicketLink(ticketKey, linkId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ticket-links", ticketKey] }),
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleSearch(q: string) {
    setTargetKey(q);
    if (q.length < 2) { setSuggestions([]); return; }
    const results = await searchTickets(q);
    setSuggestions(results.filter((r) => r.key !== ticketKey));
  }

  const grouped = useMemo(() => {
    const g: Record<string, TicketLink[]> = {};
    links.forEach((l) => {
      if (!g[l.link_type]) g[l.link_type] = [];
      g[l.link_type].push(l);
    });
    return g;
  }, [links]);

  return (
    <div className={styles.linksTab}>
      <div className={styles.linkComposer}>
        <select className={styles.inlineSelect} value={linkType} onChange={(e) => setLinkType(e.target.value)}>
          {LINK_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <div className={styles.linkSearchWrap}>
          <input
            className={styles.inlineInput}
            placeholder="Search ticket key…"
            value={targetKey}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {suggestions.length > 0 && (
            <div className={styles.linkSuggestions}>
              {suggestions.map((s) => (
                <button key={s.key} className={styles.linkSuggestion} onClick={() => { setTargetKey(s.key); setSuggestions([]); }}>
                  <span className={styles.suggestKey}>{s.key}</span>
                  <span className={styles.suggestSummary}>{s.summary}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className={styles.composeBtn} onClick={() => createLinkMut.mutate()} disabled={!targetKey || createLinkMut.isPending}>
          <RiAddLine size={12} /> Add Link
        </button>
      </div>

      <div className={styles.linkList}>
        {Object.entries(grouped).map(([type, items]) => (
          <div key={type} className={styles.linkGroup}>
            <h4 className={styles.linkGroupTitle}>{type}</h4>
            {items.map((link) => (
              <div key={link.id} className={styles.linkRow}>
                <span className={styles.linkTargetKey}>{link.target_key}</span>
                <span className={styles.linkTargetSummary}>{link.target_summary || "—"}</span>
                <button className={styles.linkDeleteBtn} onClick={() => deleteLinkMut.mutate(link.id)}>
                  <RiDeleteBinLine size={12} />
                </button>
              </div>
            ))}
          </div>
        ))}
        {links.length === 0 && <div className={styles.emptyTab}>No linked issues.</div>}
      </div>
    </div>
  );
}
/* ══════════════════════════════════════════════════════════════════════════ */
/*  Custom Fields Section                                                     */
/* ══════════════════════════════════════════════════════════════════════════ */

function CustomFieldsSection({
  ticket,
  updateMut,
}: {
  ticket: Ticket;
  updateMut: any;
}) {
  const pod = ticket.pod;
  const { data: definitions = [] } = useQuery({
    queryKey: ["custom-fields", pod],
    queryFn: () => fetchCustomFields(pod!),
    enabled: !!pod,
  });

  if (definitions.length === 0) return null;

  const current = ticket.custom_fields ?? {};

  function updateField(fieldId: string, value: any) {
    updateMut.mutate({
      custom_fields: { ...current, [fieldId]: value },
    });
  }

  return (
    <div className={styles.customFieldsSection}>
      <div className={styles.customFieldsTitle}>Custom Fields</div>
      <div className={styles.fieldsGrid}>
        {definitions.map((def) => {
          const value = current[def.id];

          if (def.field_type === "select") {
            return (
              <div key={def.id} className={styles.inlineField}>
                <label className={styles.inlineLabel}>{def.name}</label>
                <select
                  className={styles.inlineSelect}
                  value={value ?? ""}
                  onChange={(e) => updateField(def.id, e.target.value || null)}
                >
                  <option value="">—</option>
                  {def.options?.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            );
          }

          if (def.field_type === "checkbox") {
            return (
              <div key={def.id} className={styles.inlineField}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={!!value}
                    onChange={(e) => updateField(def.id, e.target.checked)}
                  />
                  {def.name}
                </label>
              </div>
            );
          }

          if (def.field_type === "date") {
            return (
              <div key={def.id} className={styles.inlineField}>
                <label className={styles.inlineLabel}>{def.name}</label>
                <input
                  type="date"
                  className={styles.inlineInput}
                  value={value ? String(value).slice(0, 10) : ""}
                  onChange={(e) => updateField(def.id, e.target.value || null)}
                />
              </div>
            );
          }

          if (def.field_type === "number") {
            return (
              <div key={def.id} className={styles.inlineField}>
                <label className={styles.inlineLabel}>{def.name}</label>
                <input
                  type="number"
                  className={styles.inlineInput}
                  value={value ?? ""}
                  onChange={(e) => updateField(def.id, e.target.value === "" ? null : Number(e.target.value))}
                />
              </div>
            );
          }

          // text (default)
          return (
            <div key={def.id} className={styles.inlineField}>
              <label className={styles.inlineLabel}>{def.name}</label>
              <input
                type="text"
                className={styles.inlineInput}
                value={value ?? ""}
                onChange={(e) => updateField(def.id, e.target.value || null)}
                placeholder={def.name}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
