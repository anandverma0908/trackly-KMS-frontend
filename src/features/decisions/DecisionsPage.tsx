import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RiFileTextLine,
  RiSearchLine,
  RiBrainLine,
  RiAddLine,
  RiCheckLine,
  RiTimeLine,
  RiQuestionLine,
  RiArrowRightLine,
  RiUser3Line,
  RiLinksLine,
  RiDeleteBinLine,
  RiGlobalLine,
  RiBuilding2Line,
} from "react-icons/ri";
import styles from "./DecisionsPage.module.css";
import {
  useDecisions,
  useCreateDecision,
  useDeleteDecision,
} from "./useDecisions";
import { novaQuery } from "@/services/api";
import SideDrawer from "@/components/ui/SideDrawer";
import type { Decision, DecisionStatus } from "@/types";

/* ── Helpers ── */
const statusConfig: Record<
  DecisionStatus,
  { label: string; className: string; icon: React.ReactNode }
> = {
  accepted: {
    label: "Accepted",
    className: styles.statusAccepted,
    icon: <RiCheckLine size={11} />,
  },
  proposed: {
    label: "Proposed",
    className: styles.statusProposed,
    icon: <RiQuestionLine size={11} />,
  },
  deprecated: {
    label: "Deprecated",
    className: styles.statusDeprecated,
    icon: <RiTimeLine size={11} />,
  },
  superseded: {
    label: "Superseded",
    className: styles.statusSuperseded,
    icon: <RiArrowRightLine size={11} />,
  },
};

/* ── Create form ── */
interface CreateForm {
  title: string;
  status: DecisionStatus;
  owner: string;
  context: string;
  decision: string;
  rationale: string;
  alternativesText: string;
  consequences: string;
  linkedTicketsText: string;
  tagsText: string;
  org_level: boolean;
}

function CreateDecisionForm({
  spaceId,
  onClose,
}: {
  spaceId?: string;
  onClose: () => void;
}) {
  const createMut = useCreateDecision();
  const [form, setForm] = useState<CreateForm>({
    title: "",
    status: "proposed",
    owner: "",
    context: "",
    decision: "",
    rationale: "",
    alternativesText: "",
    consequences: "",
    linkedTicketsText: "",
    tagsText: "",
    org_level: !spaceId,
  });

  function set(k: keyof CreateForm, v: string | boolean) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.decision.trim()) return;
    await createMut.mutateAsync({
      title: form.title.trim(),
      status: form.status,
      owner: form.owner.trim(),
      date: new Date().toISOString().split("T")[0],
      context: form.context.trim(),
      decision: form.decision.trim(),
      rationale: form.rationale.trim(),
      alternatives: form.alternativesText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      consequences: form.consequences.trim(),
      linkedTickets: form.linkedTicketsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      tags: form.tagsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      space_id: form.org_level ? null : (spaceId ?? null),
      org_level: form.org_level,
    });
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className={styles.createForm}>
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Title *</label>
        <input
          className={styles.formInput}
          placeholder="e.g. Use PostgreSQL as primary datastore"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          required
        />
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup} style={{ flex: 1 }}>
          <label className={styles.formLabel}>Status</label>
          <select
            className={styles.formSelect}
            value={form.status}
            onChange={(e) => set("status", e.target.value as DecisionStatus)}
          >
            <option value="proposed">Proposed</option>
            <option value="accepted">Accepted</option>
            <option value="deprecated">Deprecated</option>
            <option value="superseded">Superseded</option>
          </select>
        </div>
        <div className={styles.formGroup} style={{ flex: 1 }}>
          <label className={styles.formLabel}>Owner</label>
          <input
            className={styles.formInput}
            placeholder="e.g. Priya S."
            value={form.owner}
            onChange={(e) => set("owner", e.target.value)}
          />
        </div>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Context</label>
        <textarea
          className={styles.formTextarea}
          placeholder="What problem or situation led to this decision?"
          value={form.context}
          onChange={(e) => set("context", e.target.value)}
          rows={3}
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Decision *</label>
        <textarea
          className={styles.formTextarea}
          placeholder="What was decided?"
          value={form.decision}
          onChange={(e) => set("decision", e.target.value)}
          rows={3}
          required
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Rationale</label>
        <textarea
          className={styles.formTextarea}
          placeholder="Why was this the right choice?"
          value={form.rationale}
          onChange={(e) => set("rationale", e.target.value)}
          rows={2}
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>
          Alternatives Considered (one per line)
        </label>
        <textarea
          className={styles.formTextarea}
          placeholder={
            "Option A — rejected because...\nOption B — rejected because..."
          }
          value={form.alternativesText}
          onChange={(e) => set("alternativesText", e.target.value)}
          rows={3}
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Consequences</label>
        <textarea
          className={styles.formTextarea}
          placeholder="What are the trade-offs or follow-up actions?"
          value={form.consequences}
          onChange={(e) => set("consequences", e.target.value)}
          rows={2}
        />
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup} style={{ flex: 1 }}>
          <label className={styles.formLabel}>Tags (comma-separated)</label>
          <input
            className={styles.formInput}
            placeholder="auth, security, backend"
            value={form.tagsText}
            onChange={(e) => set("tagsText", e.target.value)}
          />
        </div>
        <div className={styles.formGroup} style={{ flex: 1 }}>
          <label className={styles.formLabel}>
            Linked Tickets (comma-separated)
          </label>
          <input
            className={styles.formInput}
            placeholder="TRK-89, TRK-142"
            value={form.linkedTicketsText}
            onChange={(e) => set("linkedTicketsText", e.target.value)}
          />
        </div>
      </div>

      {spaceId && (
        <label className={styles.formCheck}>
          <input
            type="checkbox"
            checked={form.org_level}
            onChange={(e) => set("org_level", e.target.checked)}
          />
          <span>Org-wide decision (visible across all spaces)</span>
        </label>
      )}

      <div className={styles.formActions}>
        <button type="button" className={styles.formCancel} onClick={onClose}>
          Cancel
        </button>
        <button
          type="submit"
          className={styles.formSubmit}
          disabled={createMut.isPending}
        >
          {createMut.isPending ? "Saving…" : "Save Decision"}
        </button>
      </div>
    </form>
  );
}

/* ── Detail body ── */
function DecisionDetailBody({ decision }: { decision: Decision }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {decision.tags.length > 0 && (
        <div className={styles.tags}>
          {decision.tags.map((t) => (
            <span key={t} className={styles.tag}>
              {t}
            </span>
          ))}
        </div>
      )}

      {decision.context && (
        <section className={styles.detailSection}>
          <h3 className={styles.sectionHeading}>Context</h3>
          <p className={styles.sectionBody}>{decision.context}</p>
        </section>
      )}

      <section className={styles.detailSection}>
        <h3 className={styles.sectionHeading}>Decision</h3>
        <p className={`${styles.sectionBody} ${styles.decisionHighlight}`}>
          {decision.decision}
        </p>
      </section>

      {decision.rationale && (
        <section className={styles.detailSection}>
          <h3 className={styles.sectionHeading}>Rationale</h3>
          <p className={styles.sectionBody}>{decision.rationale}</p>
        </section>
      )}

      {decision.alternatives.length > 0 && (
        <section className={styles.detailSection}>
          <h3 className={styles.sectionHeading}>Alternatives Considered</h3>
          <ul className={styles.altList}>
            {decision.alternatives.map((a, i) => (
              <li key={i} className={styles.altItem}>
                {a}
              </li>
            ))}
          </ul>
        </section>
      )}

      {decision.consequences && (
        <section className={styles.detailSection}>
          <h3 className={styles.sectionHeading}>Consequences</h3>
          <p className={styles.sectionBody}>{decision.consequences}</p>
        </section>
      )}

      {decision.linkedTickets.length > 0 && (
        <section className={styles.detailSection}>
          <h3 className={styles.sectionHeading}>Linked Tickets</h3>
          <div className={styles.linkedTickets}>
            {decision.linkedTickets.map((t) => (
              <span key={t} className={styles.ticketRef}>
                <RiLinksLine size={11} /> {t}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ── Page ── */
export default function DecisionsPage({
  spaceId,
  compact,
}: {
  spaceId?: string;
  compact?: boolean;
} = {}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Decision | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [novaQ, setNovaQ] = useState("");
  const [novaAnswer, setNovaAnswer] = useState("");
  const [novaSources, setNovaSources] = useState<
    { title: string; url?: string }[]
  >([]);
  const [novaLoading, setNovaLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [includeOrg, setIncludeOrg] = useState(false);

  const queryParams = spaceId
    ? { space_id: spaceId, ...(includeOrg ? { org_level: true } : {}) }
    : undefined;

  const { data, isLoading } = useDecisions(queryParams);
  const deleteMut = useDeleteDecision();

  const decisions = data?.decisions ?? [];
  const filtered = decisions.filter((d) => {
    const matchSearch =
      !search ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.tags.some((t) => t.includes(search.toLowerCase()));
    const matchStatus = filterStatus === "all" || d.status === filterStatus;
    return matchSearch && matchStatus;
  });

  async function handleNovaQuery() {
    if (!novaQ.trim()) return;
    setNovaLoading(true);
    setNovaAnswer("");
    setNovaSources([]);
    try {
      const res = await novaQuery(novaQ);
      setNovaAnswer(res.answer);
      setNovaSources(res.citations ?? []);
    } catch {
      setNovaAnswer("EOS couldn't retrieve an answer. Try rephrasing.");
    }
    setNovaLoading(false);
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this decision record?")) return;
    deleteMut.mutate(id, {
      onSuccess: () => {
        if (selected?.id === id) setSelected(null);
      },
    });
  }

  const detailBadge = selected ? (
    <div
      style={{
        display: "flex",
        gap: 6,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <span
        className={`${styles.statusBadge} ${statusConfig[selected.status].className}`}
      >
        {statusConfig[selected.status].icon}
        {statusConfig[selected.status].label}
      </span>
      {selected.org_level && (
        <span className={styles.orgBadge}>
          <RiGlobalLine size={10} /> Org-wide
        </span>
      )}
      {!selected.org_level && selected.space_id && (
        <span className={styles.orgBadge}>
          <RiBuilding2Line size={10} /> {selected.space_id}
        </span>
      )}
      <span className={styles.metaItem}>
        <RiUser3Line size={12} /> {selected.owner}
      </span>
      <span className={styles.metaItem}>
        <RiTimeLine size={12} /> {new Date(selected.date).toLocaleDateString()}
      </span>
    </div>
  ) : undefined;

  const detailFooter = selected ? (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <button
        className={styles.deleteBtn}
        onClick={() => handleDelete(selected.id)}
        title="Delete decision"
      >
        <RiDeleteBinLine size={12} /> Delete
      </button>
    </div>
  ) : undefined;

  const kpis = [
    {
      label: "Total",
      value: decisions.length,
      icon: <RiFileTextLine size={16} />,
    },
    {
      label: "Accepted",
      value: decisions.filter((d) => d.status === "accepted").length,
      icon: <RiCheckLine size={16} />,
    },
    {
      label: "Proposed",
      value: decisions.filter((d) => d.status === "proposed").length,
      icon: <RiQuestionLine size={16} />,
    },
    {
      label: "Deprecated",
      value: decisions.filter((d) => d.status === "deprecated").length,
      icon: <RiTimeLine size={16} />,
    },
  ];

  return (
    <div className={styles.page}>
      {!compact && (
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div>
              <h1 className={styles.title}>Decisions</h1>
            </div>
          </div>
        </div>
      )}
      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.searchWrap}>
          <RiSearchLine size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
          <input
            className={styles.searchInput}
            placeholder="Search decisions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.filtersRight}>
          <div className={styles.statusFilters}>
            <span className={styles.rowTitle}>Filter by status:</span>
            {["all", "accepted", "proposed", "deprecated"].map((s) => (
              <button
                key={s}
                className={`${styles.filterChip} ${filterStatus === s ? styles.filterChipActive : ""}`}
                onClick={() => setFilterStatus(s)}
              >
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          <button className={styles.addBtn} onClick={() => setShowCreate(true)}>
            <RiAddLine size={15} /> New Decision
          </button>
        </div>
      </div>
      <div className={styles.content}>
        {/* List */}
        <div className={styles.list}>
          {isLoading ? (
            <>
              {[0, 1, 2].map((i) => (
                <div key={i} className={styles.loadingRow} />
              ))}
            </>
          ) : filtered.length === 0 ? (
            <div className={styles.emptyState}>
              {search || filterStatus !== "all"
                ? "No decisions match your filters."
                : spaceId
                  ? "No decisions yet for this space. Record your first ADR."
                  : "No decisions recorded yet. Start documenting your architecture choices."}
            </div>
          ) : (
            filtered.map((d, i) => (
              <motion.div
                key={d.id}
                className={`${styles.decisionRow} ${selected?.id === d.id ? styles.decisionRowActive : ""}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => {
                  setSelected(d);
                  setShowCreate(false);
                }}
              >
                <div className={styles.rowNum}>
                  {d.number != null
                    ? `ADR-${String(d.number).padStart(3, "0")}`
                    : "ADR"}
                </div>
                <div className={styles.rowBody}>
                  <div className={styles.rowTitleRow}>
                    <span className={styles.rowTitle}>{d.title}</span>
                    <span
                      className={`${styles.statusBadge} ${statusConfig[d.status].className}`}
                    >
                      {statusConfig[d.status].icon}
                      {statusConfig[d.status].label}
                    </span>
                  </div>
                  <div className={styles.rowMeta}>
                    <span>{d.owner}</span>
                    {d.date && (
                      <>
                        <span>·</span>
                        <span>{new Date(d.date).toLocaleDateString()}</span>
                      </>
                    )}
                    {d.org_level && (
                      <span
                        className={styles.orgBadge}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <RiGlobalLine size={9} /> Org
                      </span>
                    )}
                    <div className={styles.tags}>
                      {d.tags.slice(0, 3).map((t) => (
                        <span key={t} className={styles.tag}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <RiArrowRightLine size={14} className={styles.rowArrow} />
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Detail drawer */}
      <SideDrawer
        open={!!selected && !showCreate}
        onClose={() => setSelected(null)}
        size="sm"
        title={selected?.title ?? ""}
        avatar={
          <div className={styles.adrAvatar}>
            {selected?.number != null
              ? `ADR-${String(selected.number).padStart(3, "0")}`
              : "ADR"}
          </div>
        }
        badge={detailBadge}
        footer={detailFooter}
      >
        {selected && <DecisionDetailBody decision={selected} />}
      </SideDrawer>

      {/* Create drawer */}
      <SideDrawer
        open={showCreate}
        onClose={() => setShowCreate(false)}
        size="sm"
        title="New Decision"
        subtitle="Record an architecture decision (ADR)"
      >
        <CreateDecisionForm
          spaceId={spaceId}
          onClose={() => setShowCreate(false)}
        />
      </SideDrawer>
    </div>
  );
}
