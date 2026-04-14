import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  fetchTicketComments, createComment, deleteComment,
  fetchTicketActivity, fetchTicketAttachments, uploadAttachment,
  updateTicket, updateTicketStatus,
} from "@/services/api";
import { formatDate } from "@/utils/formatters";
import { IssueTypeBadge, StatusBadge, PODBadge } from "@/components/ui/Badge";
import type { Ticket, TicketComment, TicketActivity } from "@/types";
import styles from "./TicketDetailDrawer.module.css";

const STATUS_TRANSITIONS: Record<string, string[]> = {
  "To Do":       ["In Progress", "Blocked"],
  "In Progress": ["To Do", "In Review", "Blocked"],
  "In Review":   ["In Progress", "Done"],
  "Blocked":     ["To Do", "In Progress"],
  "Done":        ["In Progress"],
};

type Tab = "comments" | "activity" | "attachments";

interface Props {
  ticket:  Ticket;
  onClose: () => void;
}

export default function TicketDetailDrawer({ ticket, onClose }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("comments");
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Comments
  const { data: comments = [] } = useQuery({
    queryKey: ["ticket-comments", ticket.key],
    queryFn: () => fetchTicketComments(ticket.key),
  });

  // Activity
  const { data: activity = [] } = useQuery({
    queryKey: ["ticket-activity", ticket.key],
    queryFn: () => fetchTicketActivity(ticket.key),
    enabled: tab === "activity",
  });

  // Attachments
  const { data: attachments = [] } = useQuery({
    queryKey: ["ticket-attachments", ticket.key],
    queryFn: () => fetchTicketAttachments(ticket.key),
    enabled: tab === "attachments",
  });

  const commentMut = useMutation({
    mutationFn: ({ content, parentId }: { content: string; parentId?: number }) =>
      createComment(ticket.key, content, parentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-comments", ticket.key] });
      setCommentText("");
      setReplyTo(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteComment(ticket.key, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ticket-comments", ticket.key] }),
  });

  const statusMut = useMutation({
    mutationFn: (status: string) => updateTicketStatus(ticket.key, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-comments", ticket.key] });
      toast.success("Status updated");
    },
  });

  const updateMut = useMutation({
    mutationFn: (payload: Record<string, any>) => updateTicket(ticket.key, payload),
    onSuccess: () => {
      setEditingField(null);
      toast.success("Updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadMut = useMutation({
    mutationFn: (file: File) => uploadAttachment(ticket.key, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-attachments", ticket.key] });
      toast.success("File uploaded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function startEdit(field: string, value: string) {
    setEditingField(field);
    setEditValue(value);
  }

  function saveEdit() {
    if (!editingField) return;
    updateMut.mutate({ [editingField]: editValue });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadMut.mutate(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadMut.mutate(file);
  }

  // Top-level comments
  const topLevel = comments.filter((c) => !c.parent_id);
  const replies   = (parentId: number) => comments.filter((c) => c.parent_id === parentId);

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.drawer}>
        {/* Drawer Header */}
        <div className={styles.header}>
          <div className={styles.keyBadge}>{ticket.key}</div>
          <div className={styles.badges}>
            <IssueTypeBadge type={ticket.issue_type} />
            <PODBadge pod={ticket.pod} />
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          {/* Left: main content */}
          <div className={styles.main}>
            {/* Title */}
            {editingField === "summary" ? (
              <div className={styles.inlineEdit}>
                <input
                  className={`input ${styles.titleEdit}`}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingField(null); }}
                  autoFocus
                />
                <div className={styles.editActions}>
                  <button className="btn btn-primary btn-sm" onClick={saveEdit}>Save</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingField(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <h2 className={styles.ticketTitle} onClick={() => startEdit("summary", ticket.summary)}>
                {ticket.summary}
                <span className={styles.editHint}>✏</span>
              </h2>
            )}

            {/* Description */}
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Description</div>
              {editingField === "description" ? (
                <div className={styles.inlineEdit}>
                  <textarea
                    className={`input ${styles.descEdit}`}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    rows={5}
                    autoFocus
                  />
                  <div className={styles.editActions}>
                    <button className="btn btn-primary btn-sm" onClick={saveEdit}>Save</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingField(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div
                  className={styles.descText}
                  onClick={() => startEdit("description", "")}
                >
                  {ticket.summary || <span className={styles.placeholder}>Click to add description…</span>}
                  <span className={styles.editHint}>✏</span>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className={styles.tabs}>
              {(["comments", "activity", "attachments"] as Tab[]).map((t) => (
                <button
                  key={t}
                  className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
                  onClick={() => setTab(t)}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                  {t === "comments" && comments.length > 0 && (
                    <span className={styles.tabBadge}>{comments.length}</span>
                  )}
                  {t === "attachments" && attachments.length > 0 && (
                    <span className={styles.tabBadge}>{attachments.length}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Comments Tab */}
            {tab === "comments" && (
              <div className={styles.tabContent}>
                {topLevel.map((c) => (
                  <CommentItem
                    key={c.id}
                    comment={c}
                    replies={replies(c.id)}
                    onReply={() => setReplyTo(c.id)}
                    onDelete={() => deleteMut.mutate(c.id)}
                  />
                ))}
                {topLevel.length === 0 && (
                  <p className={styles.empty}>No comments yet. Be the first!</p>
                )}

                <div className={styles.commentCompose}>
                  {replyTo && (
                    <div className={styles.replyIndicator}>
                      Replying to comment #{replyTo}
                      <button className={styles.cancelReply} onClick={() => setReplyTo(null)}>✕</button>
                    </div>
                  )}
                  <textarea
                    className={`input ${styles.commentInput}`}
                    placeholder="Write a comment…"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    rows={3}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={!commentText.trim() || commentMut.isPending}
                    onClick={() => commentMut.mutate({ content: commentText, parentId: replyTo ?? undefined })}
                  >
                    {commentMut.isPending ? "Posting…" : "Post Comment"}
                  </button>
                </div>
              </div>
            )}

            {/* Activity Tab */}
            {tab === "activity" && (
              <div className={styles.tabContent}>
                {activity.length === 0 && <p className={styles.empty}>No activity yet.</p>}
                {activity.map((a) => (
                  <ActivityEntry key={a.id} entry={a} />
                ))}
              </div>
            )}

            {/* Attachments Tab */}
            {tab === "attachments" && (
              <div className={styles.tabContent}>
                <div
                  className={`${styles.dropZone} ${dragging ? styles.dropZoneActive : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                >
                  <input ref={fileRef} type="file" hidden onChange={handleFileChange} />
                  <span className={styles.dropIcon}>📎</span>
                  <span>Drag & drop files, or click to browse</span>
                  {uploadMut.isPending && <span className={styles.spinner} />}
                </div>

                {attachments.length === 0 && <p className={styles.empty}>No attachments yet.</p>}
                <div className={styles.attachList}>
                  {attachments.map((a) => (
                    <div key={a.id} className={styles.attachItem}>
                      <span className={styles.attachIcon}>{isImage(a.filename) ? "🖼" : "📄"}</span>
                      <div className={styles.attachInfo}>
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className={styles.attachName}>
                          {a.filename}
                        </a>
                        <span className={styles.attachMeta}>
                          {formatFileSize(a.size)} · {formatDate(a.uploaded_at)} · {a.uploaded_by}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Meta sidebar */}
          <div className={styles.sidebar}>
            {/* Status */}
            <MetaField label="Status">
              <div className={styles.statusWrap}>
                <StatusBadge status={ticket.status} />
                {STATUS_TRANSITIONS[ticket.status]?.map((next) => (
                  <button
                    key={next}
                    className={styles.transitionBtn}
                    onClick={() => statusMut.mutate(next)}
                    disabled={statusMut.isPending}
                  >
                    → {next}
                  </button>
                ))}
              </div>
            </MetaField>

            <MetaField label="Assignee">
              <InlineText
                value={ticket.assignee}
                editing={editingField === "assignee"}
                editValue={editValue}
                onEdit={() => startEdit("assignee", ticket.assignee)}
                onSave={saveEdit}
                onCancel={() => setEditingField(null)}
                onChange={setEditValue}
              />
            </MetaField>

            <MetaField label="Priority">
              <span className={styles.metaValue}>{ticket.priority}</span>
            </MetaField>

            <MetaField label="Client">
              <span className={styles.metaValue}>{ticket.client || "—"}</span>
            </MetaField>

            <MetaField label="Created">
              <span className={styles.metaValue}>{formatDate(ticket.created)}</span>
            </MetaField>

            <MetaField label="Updated">
              <span className={styles.metaValue}>{formatDate(ticket.updated)}</span>
            </MetaField>

            {ticket.hours_spent > 0 && (
              <MetaField label="Hours Logged">
                <span className={styles.metaValue}>{ticket.hours_spent.toFixed(1)}h</span>
              </MetaField>
            )}

            {ticket.original_estimate_hours > 0 && (
              <MetaField label="Estimate">
                <span className={styles.metaValue}>{ticket.original_estimate_hours.toFixed(1)}h</span>
              </MetaField>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function CommentItem({
  comment, replies, onReply, onDelete,
}: {
  comment: TicketComment;
  replies: TicketComment[];
  onReply: () => void;
  onDelete: () => void;
}) {
  const initials = comment.author.split(" ").map((n) => n[0]).join("").slice(0, 2);
  return (
    <div className={styles.comment}>
      <div className={styles.commentAvatar}>{initials}</div>
      <div className={styles.commentBody}>
        <div className={styles.commentHeader}>
          <span className={styles.commentAuthor}>{comment.author}</span>
          <span className={styles.commentDate}>{formatDate(comment.created_at)}</span>
          <button className={styles.commentAction} onClick={onReply}>Reply</button>
          <button className={styles.commentAction} onClick={onDelete}>Delete</button>
        </div>
        <p className={styles.commentText}>{comment.content}</p>
        {replies.map((r) => (
          <div key={r.id} className={styles.reply}>
            <div className={styles.commentAvatar} style={{ width: 24, height: 24, fontSize: "0.65rem" }}>
              {r.author.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div className={styles.commentBody}>
              <div className={styles.commentHeader}>
                <span className={styles.commentAuthor}>{r.author}</span>
                <span className={styles.commentDate}>{formatDate(r.created_at)}</span>
              </div>
              <p className={styles.commentText}>{r.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityEntry({ entry }: { entry: TicketActivity }) {
  return (
    <div className={styles.activityEntry}>
      <div className={styles.activityDot} />
      <div className={styles.activityContent}>
        <span className={styles.activityActor}>{entry.actor}</span>
        {" "}{entry.action}
        {entry.field && (
          <> <span className={styles.activityField}>{entry.field}</span>
            {entry.old_value && <> from <span className={styles.activityOld}>{entry.old_value}</span></>}
            {entry.new_value && <> to <span className={styles.activityNew}>{entry.new_value}</span></>}
          </>
        )}
        <span className={styles.activityTime}>{formatDate(entry.created_at)}</span>
      </div>
    </div>
  );
}

function MetaField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.metaField}>
      <div className={styles.metaLabel}>{label}</div>
      <div className={styles.metaContent}>{children}</div>
    </div>
  );
}

function InlineText({
  value, editing, editValue, onEdit, onSave, onCancel, onChange,
}: {
  value: string; editing: boolean; editValue: string;
  onEdit: () => void; onSave: () => void; onCancel: () => void;
  onChange: (v: string) => void;
}) {
  if (editing) {
    return (
      <div className={styles.inlineEditSmall}>
        <input
          className="input input-sm"
          value={editValue}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
          onBlur={onSave}
          autoFocus
        />
      </div>
    );
  }
  return (
    <span className={`${styles.metaValue} ${styles.editable}`} onClick={onEdit}>
      {value || "—"} <span className={styles.editHintSm}>✏</span>
    </span>
  );
}

/* ── Helpers ── */
function isImage(name: string) {
  return /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(name);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
