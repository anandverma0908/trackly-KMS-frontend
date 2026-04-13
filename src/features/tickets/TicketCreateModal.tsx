import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createTicket, analyzeTicketNL, fetchFilters } from "@/services/api";
import { QUERY_KEYS } from "@/config/queryKeys";
import type { TicketCreate, NLAnalysisResult, DuplicateTicket } from "@/types";
import styles from "./TicketCreateModal.module.css";

const ISSUE_TYPES = ["Story", "Bug", "Task", "Epic", "Subtask", "Improvement"];
const PRIORITIES  = ["Highest", "High", "Medium", "Low", "Lowest"];
const STORY_POINTS = [1, 2, 3, 5, 8, 13];

interface Props {
  onClose:    () => void;
  sprintId?:  number;
}

export default function TicketCreateModal({ onClose, sprintId }: Props) {
  const qc = useQueryClient();
  // NL mode
  const [nlText, setNlText] = useState("");
  const [nlMode, setNlMode] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateTicket[]>([]);

  // Form state
  const [form, setForm] = useState<TicketCreate>({
    title:       "",
    description: "",
    issue_type:  "Story",
    priority:    "Medium",
  });
  const [confidence, setConfidence] = useState<number | null>(null);

  const { data: filtersData } = useQuery({ queryKey: QUERY_KEYS.filters(), queryFn: fetchFilters });

  const createMut = useMutation({
    mutationFn: createTicket,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["new-tickets"] });
      toast.success("Ticket created!");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleNLAnalyze() {
    if (!nlText.trim()) return;
    setAnalyzing(true);
    try {
      const result: NLAnalysisResult = await analyzeTicketNL(nlText);
      setForm((prev) => ({
        ...prev,
        title:        result.title       ?? prev.title,
        description:  result.description ?? prev.description,
        pod:          result.pod         ?? prev.pod,
        client:       result.client      ?? prev.client,
        issue_type:   result.issue_type  ?? prev.issue_type,
        priority:     result.priority    ?? prev.priority,
        story_points: result.story_points,
        assignee:     result.assignee    ?? prev.assignee,
        labels:       result.labels      ?? prev.labels,
      }));
      setConfidence(result.confidence ?? null);
      if (result.duplicates?.length) setDuplicates(result.duplicates);
      setNlMode(false);
      toast.success("NOVA analyzed your request!");
    } catch {
      toast.error("NOVA analysis failed — fill form manually");
      setNlMode(false);
    } finally {
      setAnalyzing(false);
    }
  }

  function set(key: keyof TicketCreate, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    const payload: TicketCreate = { ...form };
    if (sprintId) payload.sprint_id = sprintId;
    createMut.mutate(payload);
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Create Ticket</h2>
          <div className={styles.headerRight}>
            <div className={styles.novaBadge}>
              <span className={styles.novaGlow} />
              NOVA
            </div>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* NL Input */}
        {nlMode ? (
          <div className={styles.nlSection}>
            <p className={styles.nlHint}>Describe your ticket in plain English — NOVA will fill the form</p>
            <textarea
              className={styles.nlInput}
              placeholder='e.g. "Fix the login timeout bug in DPAI — affects Colgate users, high priority, ~3 story points"'
              value={nlText}
              onChange={(e) => setNlText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && e.ctrlKey && handleNLAnalyze()}
              rows={3}
              autoFocus
            />
            <div className={styles.nlActions}>
              <button
                className={`btn btn-primary ${styles.analyzeBtn}`}
                onClick={handleNLAnalyze}
                disabled={analyzing || !nlText.trim()}
              >
                {analyzing ? (
                  <><span className={styles.spinner} /> Analyzing…</>
                ) : (
                  <><span className={styles.novaIcon}>✦</span> Analyze with NOVA</>
                )}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setNlMode(false)}>
                Fill manually
              </button>
            </div>
          </div>
        ) : (
          <button className={styles.nlToggle} onClick={() => setNlMode(true)}>
            <span className={styles.novaIcon}>✦</span> Use NOVA to fill form
          </button>
        )}

        {/* Duplicate Warning */}
        {duplicates.length > 0 && (
          <div className={styles.dupWarning}>
            <div className={styles.dupTitle}>⚠ Similar tickets found</div>
            {duplicates.map((d) => (
              <div key={d.key} className={styles.dupItem}>
                <span className={styles.dupKey}>{d.key}</span>
                <span className={styles.dupSummary}>{d.summary}</span>
                <span className={styles.dupBadge}>{(d.similarity * 100).toFixed(0)}% similar</span>
                <span className={`badge badge-gray ${styles.dupStatus}`}>{d.status}</span>
              </div>
            ))}
          </div>
        )}

        {/* Confidence */}
        {confidence !== null && (
          <div className={styles.confidenceBar}>
            <span className={styles.confLabel}>NOVA confidence</span>
            <div className={styles.confTrack}>
              <div className={styles.confFill} style={{ width: `${confidence * 100}%` }} />
            </div>
            <span className={styles.confPct}>{(confidence * 100).toFixed(0)}%</span>
          </div>
        )}

        {/* Form */}
        <form className={styles.form} onSubmit={handleSubmit}>
          {/* Title */}
          <div className={styles.field}>
            <label className={styles.label}>Title <span className={styles.req}>*</span></label>
            <input
              className="input"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Short, descriptive title"
              required
            />
          </div>

          {/* Description */}
          <div className={styles.field}>
            <label className={styles.label}>Description</label>
            <textarea
              className={`input ${styles.descArea}`}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Describe the ticket in detail…"
              rows={4}
            />
          </div>

          {/* Row: Type + Priority */}
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Type</label>
              <select className="input" value={form.issue_type} onChange={(e) => set("issue_type", e.target.value)}>
                {ISSUE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Priority</label>
              <select className="input" value={form.priority} onChange={(e) => set("priority", e.target.value)}>
                {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Row: POD + Client */}
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>POD</label>
              <select className="input" value={form.pod ?? ""} onChange={(e) => set("pod", e.target.value || undefined)}>
                <option value="">— Select POD —</option>
                {(filtersData?.pods ?? []).map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Client</label>
              <select className="input" value={form.client ?? ""} onChange={(e) => set("client", e.target.value || undefined)}>
                <option value="">— Select Client —</option>
                {(filtersData?.clients ?? []).map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Row: Story Points + Assignee */}
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Story Points</label>
              <select className="input" value={form.story_points ?? ""} onChange={(e) => set("story_points", e.target.value ? Number(e.target.value) : undefined)}>
                <option value="">— None —</option>
                {STORY_POINTS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Assignee</label>
              <select className="input" value={form.assignee ?? ""} onChange={(e) => set("assignee", e.target.value || undefined)}>
                <option value="">— Unassigned —</option>
                {(filtersData?.users ?? []).map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* Due date */}
          <div className={styles.field}>
            <label className={styles.label}>Due Date</label>
            <input
              type="date"
              className="input"
              value={form.due_date ?? ""}
              onChange={(e) => set("due_date", e.target.value || undefined)}
            />
          </div>

          {/* Footer */}
          <div className={styles.footer}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={createMut.isPending}>
              {createMut.isPending ? "Creating…" : "Create Ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
