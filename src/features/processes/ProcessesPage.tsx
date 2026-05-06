import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CompliancePage from "./CompliancePage";
import {
  RiShieldCheckLine,
  RiAddLine,
  RiSearchLine,
  RiTimeLine,
  RiTeamLine,
  RiArrowRightLine,
  RiCheckboxCircleLine,
  RiDeleteBinLine,
  RiGlobalLine,
  RiBuilding2Line,
  RiListCheck2,
  RiLoopLeftLine,
  RiAlertLine,
} from "react-icons/ri";
import styles from "./ProcessesPage.module.css";
import {
  useProcesses,
  useCreateProcess,
  useDeleteProcess,
} from "./useProcesses";
import { novaQuery } from "@/services/api";
import SideDrawer from "@/components/ui/SideDrawer";
import type { Process, ProcessCategory, ProcessStatus } from "@/types";

/* ── Helpers ── */
export const categoryConfig: Record<
  ProcessCategory,
  { label: string; color: string }
> = {
  runbook: { label: "Runbook", color: styles.catRunbook },
  sop: { label: "SOP", color: styles.catSop },
  compliance: { label: "Compliance", color: styles.catCompliance },
  template: { label: "Template", color: styles.catTemplate },
  workflow: { label: "Workflow", color: styles.catWorkflow },
};

export const statusConfig: Record<
  ProcessStatus,
  { label: string; className: string }
> = {
  active: { label: "Active", className: styles.statusActive },
  draft: { label: "Draft", className: styles.statusDraft },
  review: { label: "In Review", className: styles.statusReview },
  deprecated: { label: "Deprecated", className: styles.statusDeprecated },
};

/* ── Create form ── */
interface StepDraft {
  title: string;
  description: string;
  owner: string;
  estimatedTime: string;
  required: boolean;
}

interface CreateForm {
  title: string;
  category: ProcessCategory;
  status: ProcessStatus;
  owner: string;
  description: string;
  tagsText: string;
  complianceRequired: boolean;
  avgCompletionTime: string;
  steps: StepDraft[];
  org_level: boolean;
}

function emptyStep(): StepDraft {
  return {
    title: "",
    description: "",
    owner: "",
    estimatedTime: "",
    required: true,
  };
}

function CreateProcessForm({
  spaceId,
  onClose,
}: {
  spaceId?: string;
  onClose: () => void;
}) {
  const createMut = useCreateProcess();
  const [form, setForm] = useState<CreateForm>({
    title: "",
    category: "sop",
    status: "active",
    owner: "",
    description: "",
    tagsText: "",
    complianceRequired: false,
    avgCompletionTime: "",
    steps: [emptyStep()],
    org_level: !spaceId,
  });

  function setField(k: keyof Omit<CreateForm, "steps">, v: string | boolean) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function setStep(i: number, k: keyof StepDraft, v: string | boolean) {
    setForm((f) => {
      const steps = [...f.steps];
      steps[i] = { ...steps[i], [k]: v };
      return { ...f, steps };
    });
  }

  function addStep() {
    setForm((f) => ({ ...f, steps: [...f.steps, emptyStep()] }));
  }

  function removeStep(i: number) {
    setForm((f) => ({ ...f, steps: f.steps.filter((_, idx) => idx !== i) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const today = new Date().toISOString().split("T")[0];
    await createMut.mutateAsync({
      title: form.title.trim(),
      category: form.category,
      status: form.status,
      owner: form.owner.trim(),
      description: form.description.trim(),
      lastUpdated: today,
      tags: form.tagsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      complianceRequired: form.complianceRequired,
      avgCompletionTime: form.avgCompletionTime.trim() || undefined,
      runCount: 0,
      steps: form.steps
        .filter((s) => s.title.trim())
        .map((s, i) => ({
          id: `step-${i}`,
          order: i + 1,
          title: s.title.trim(),
          description: s.description.trim(),
          owner: s.owner.trim() || undefined,
          estimatedTime: s.estimatedTime.trim() || undefined,
          required: s.required,
        })),
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
          placeholder="e.g. Database Failover Procedure"
          value={form.title}
          onChange={(e) => setField("title", e.target.value)}
          required
        />
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup} style={{ flex: 1 }}>
          <label className={styles.formLabel}>Category</label>
          <select
            className={styles.formSelect}
            value={form.category}
            onChange={(e) =>
              setField("category", e.target.value as ProcessCategory)
            }
          >
            <option value="runbook">Runbook</option>
            <option value="sop">SOP</option>
            <option value="compliance">Compliance</option>
            <option value="template">Template</option>
            <option value="workflow">Workflow</option>
          </select>
        </div>
        <div className={styles.formGroup} style={{ flex: 1 }}>
          <label className={styles.formLabel}>Status</label>
          <select
            className={styles.formSelect}
            value={form.status}
            onChange={(e) =>
              setField("status", e.target.value as ProcessStatus)
            }
          >
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="review">In Review</option>
            <option value="deprecated">Deprecated</option>
          </select>
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup} style={{ flex: 1 }}>
          <label className={styles.formLabel}>Owner</label>
          <input
            className={styles.formInput}
            placeholder="e.g. Arjun K."
            value={form.owner}
            onChange={(e) => setField("owner", e.target.value)}
          />
        </div>
        <div className={styles.formGroup} style={{ flex: 1 }}>
          <label className={styles.formLabel}>Avg. Completion Time</label>
          <input
            className={styles.formInput}
            placeholder="e.g. ~25 min"
            value={form.avgCompletionTime}
            onChange={(e) => setField("avgCompletionTime", e.target.value)}
          />
        </div>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Description</label>
        <textarea
          className={styles.formTextarea}
          placeholder="What does this process cover and when should it be used?"
          value={form.description}
          onChange={(e) => setField("description", e.target.value)}
          rows={3}
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Tags (comma-separated)</label>
        <input
          className={styles.formInput}
          placeholder="database, incident, critical"
          value={form.tagsText}
          onChange={(e) => setField("tagsText", e.target.value)}
        />
      </div>

      <label className={styles.formCheck}>
        <input
          type="checkbox"
          checked={form.complianceRequired}
          onChange={(e) => setField("complianceRequired", e.target.checked)}
        />
        <span>Compliance required</span>
      </label>

      {/* Steps */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <span className={styles.formLabel}>Steps</span>
          <button type="button" className={styles.addStepBtn} onClick={addStep}>
            <RiAddLine size={11} /> Add Step
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {form.steps.map((step, i) => (
            <div key={i} className={styles.stepDraftCard}>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <span className={styles.stepDraftNum}>{i + 1}</span>
                <input
                  className={styles.formInput}
                  style={{ flex: 1 }}
                  placeholder={`Step ${i + 1} title`}
                  value={step.title}
                  onChange={(e) => setStep(i, "title", e.target.value)}
                />
                {form.steps.length > 1 && (
                  <button
                    type="button"
                    className={styles.removeStepBtn}
                    onClick={() => removeStep(i)}
                  >
                    ✕
                  </button>
                )}
              </div>
              <textarea
                className={styles.formTextarea}
                placeholder="Step description..."
                value={step.description}
                onChange={(e) => setStep(i, "description", e.target.value)}
                rows={2}
              />
              <div className={styles.formRow} style={{ marginTop: 6 }}>
                <input
                  className={styles.formInput}
                  style={{ flex: 1 }}
                  placeholder="Owner"
                  value={step.owner}
                  onChange={(e) => setStep(i, "owner", e.target.value)}
                />
                <input
                  className={styles.formInput}
                  style={{ flex: 1 }}
                  placeholder="Est. time"
                  value={step.estimatedTime}
                  onChange={(e) => setStep(i, "estimatedTime", e.target.value)}
                />
                <label className={styles.formCheck}>
                  <input
                    type="checkbox"
                    checked={step.required}
                    onChange={(e) => setStep(i, "required", e.target.checked)}
                  />
                  <span>Required</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      {spaceId && (
        <label className={styles.formCheck}>
          <input
            type="checkbox"
            checked={form.org_level}
            onChange={(e) => setField("org_level", e.target.checked)}
          />
          <span>Org-wide process (visible across all spaces)</span>
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
          {createMut.isPending ? "Saving…" : "Save Process"}
        </button>
      </div>
    </form>
  );
}

/* ── Process detail body ── */
export function ProcessDetailBody({ process }: { process: Process }) {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  function toggleStep(id: string) {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const pct =
    process.steps.length > 0
      ? Math.round((completedSteps.size / process.steps.length) * 100)
      : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className={styles.detailInfo}>
        <span className={styles.infoItem}>
          <RiTeamLine size={12} /> {process.owner}
        </span>
        {process.avgCompletionTime && (
          <span className={styles.infoItem}>
            <RiTimeLine size={12} /> {process.avgCompletionTime}
          </span>
        )}
        {(process.runCount ?? 0) > 0 && (
          <span className={styles.infoItem}>Run {process.runCount}×</span>
        )}
        {process.org_level && (
          <span className={styles.infoItem}>
            <RiGlobalLine size={12} /> Org-wide
          </span>
        )}
      </div>

      <p className={styles.detailDesc}>{process.description}</p>

      {completedSteps.size > 0 && (
        <div className={styles.progressSection}>
          <div className={styles.progressLabel}>
            <span>
              {completedSteps.size}/{process.steps.length} steps complete
            </span>
            <span>{pct}%</span>
          </div>
          <div className={styles.progressBar}>
            <motion.div
              className={styles.progressFill}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      <div className={styles.stepsHeader}>
        <h3 className={styles.stepsTitle}>Steps</h3>
        <button
          className={styles.resetBtn}
          onClick={() => setCompletedSteps(new Set())}
        >
          Reset
        </button>
      </div>

      <div className={styles.stepsList}>
        {process.steps.map((step) => {
          const done = completedSteps.has(step.id);
          return (
            <div
              key={step.id}
              className={`${styles.step} ${done ? styles.stepDone : ""}`}
              onClick={() => toggleStep(step.id)}
            >
              <div className={styles.stepCheck}>
                {done ? (
                  <RiCheckboxCircleLine
                    size={18}
                    className={styles.checkDone}
                  />
                ) : (
                  <div className={styles.checkEmpty}>{step.order}</div>
                )}
              </div>
              <div className={styles.stepBody}>
                <div className={styles.stepTitleRow}>
                  <span className={styles.stepTitle}>{step.title}</span>
                  {!step.required && (
                    <span className={styles.optionalBadge}>optional</span>
                  )}
                  {step.estimatedTime && (
                    <span className={styles.stepTime}>
                      {step.estimatedTime}
                    </span>
                  )}
                </div>
                <p className={styles.stepDesc}>{step.description}</p>
                {step.owner && (
                  <span className={styles.stepOwner}>Owner: {step.owner}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Page ── */
export default function ProcessesPage({
  spaceId,
  compact,
}: {
  spaceId?: string;
  compact?: boolean;
} = {}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Process | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [includeOrg, setIncludeOrg] = useState(false);
  const [novaQ, setNovaQ] = useState("");
  const [novaAnswer, setNovaAnswer] = useState("");
  const [novaSources, setNovaSources] = useState<
    { title: string; url?: string }[]
  >([]);
  const [novaLoading, setNovaLoading] = useState(false);
  const [showCompliance, setShowCompliance] = useState(false);

  const queryParams = spaceId
    ? { space_id: spaceId, ...(includeOrg ? { org_level: true } : {}) }
    : undefined;

  const { data, isLoading } = useProcesses(queryParams);
  const deleteMut = useDeleteProcess();

  const processes = data?.processes ?? [];
  const filtered = processes.filter((p) => {
    const matchSearch =
      !search ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.tags.some((t) => t.includes(search.toLowerCase()));
    const matchCat = filterCat === "all" || p.category === filterCat;
    return matchSearch && matchCat;
  });

  const categories: ("all" | ProcessCategory)[] = [
    "all",
    "runbook",
    "sop",
    "compliance",
    "template",
    "workflow",
  ];

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
    if (!confirm("Delete this process?")) return;
    deleteMut.mutate(id, {
      onSuccess: () => {
        if (selected?.id === id) setSelected(null);
      },
    });
  }

  if (showCompliance) {
    return <CompliancePage onBack={() => setShowCompliance(false)} />;
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
        className={`${styles.catBadge} ${categoryConfig[selected.category].color}`}
      >
        {categoryConfig[selected.category].label}
      </span>
      <span
        className={`${styles.statusBadge} ${statusConfig[selected.status].className}`}
      >
        {statusConfig[selected.status].label}
      </span>
      {selected.complianceRequired && (
        <span className={styles.complianceBadge}>
          <RiShieldCheckLine size={11} /> Compliance Required
        </span>
      )}
    </div>
  ) : undefined;

  const detailFooter = selected ? (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <button
        className={styles.deleteBtn}
        onClick={() => handleDelete(selected.id)}
        title="Delete"
      >
        <RiDeleteBinLine size={12} /> Delete
      </button>
    </div>
  ) : undefined;

  return (
    <div className={styles.page}>
      {/* Header */}
      {!compact && (
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div>
              <h1 className={styles.title}>Processes</h1>
            </div>
          </div>
        </div>
      )}

      {/* KPI strip */}
      {!compact && (
        <div className={styles.kpiRow}>
          {[
            {
              label: "Total",
              value: String(processes.length),
              sub: "Processes documented",
              icon: <RiListCheck2 />,
            },
            {
              label: "Compliance",
              value: String(
                processes.filter((p) => p.complianceRequired).length,
              ),
              sub: "Require compliance",
              icon: <RiShieldCheckLine />,
            },
            {
              label: "Executions",
              value: String(
                processes.reduce((a, p) => a + (p.runCount ?? 0), 0),
              ),
              sub: "Total runs logged",
              icon: <RiLoopLeftLine />,
            },
            {
              label: "Stale",
              value: String(
                processes.filter((p) => {
                  if (!p.lastUpdated) return false;
                  return (
                    Date.now() - new Date(p.lastUpdated).getTime() >
                    90 * 24 * 60 * 60 * 1000
                  );
                }).length,
              ),
              sub: "Not updated in 90d",
              icon: <RiAlertLine />,
            },
          ].map((card) => (
            <div key={card.label} className={styles.kpiCard}>
              <div className={styles.kpiTopRow}>
                <div className={styles.kpiLabel}>{card.label}</div>
                <span className={styles.kpiIconWrap}>{card.icon}</span>
              </div>
              <div>
                <div className={styles.kpiValue}>{card.value}</div>
                <div className={styles.kpiSub}>{card.sub}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className={styles.filtersRow}>
        <div className={styles.headerRight}>
          <button className={styles.addBtn} onClick={() => setShowCreate(true)}>
            <RiAddLine size={15} /> New Process
          </button>
        {!compact &&  <button
            className={styles.complianceBtn}
            onClick={() => setShowCompliance(true)}
          >
            <RiShieldCheckLine size={14} /> Compliance
          </button>}
        </div>
        <div className={styles.filters}>
          <div className={styles.searchWrap}>
            <RiSearchLine size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
            <input
              className={styles.searchInput}
              placeholder="Search processes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className={styles.filterRight}>
            <div className={styles.catFilters}>
              {categories.map((c) => (
                <button
                  key={c}
                  className={`${styles.filterChip} ${filterCat === c ? styles.filterChipActive : ""}`}
                  onClick={() => setFilterCat(c)}
                >
                  {c === "all"
                    ? "All"
                    : categoryConfig[c as ProcessCategory].label}
                </button>
              ))}
            </div>
          </div>
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
              {search || filterCat !== "all"
                ? "No processes match your filters."
                : spaceId
                  ? "No processes yet for this space. Add your first runbook or SOP."
                  : "No processes recorded yet. Document your first SOP or runbook."}
            </div>
          ) : (
            filtered.map((p, i) => (
              <motion.div
                key={p.id}
                className={`${styles.processRow} ${selected?.id === p.id ? styles.processRowActive : ""}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => {
                  setSelected(p);
                  setShowCreate(false);
                }}
              >
                <div className={styles.rowLeft}>
                  <span
                    className={`${styles.catBadge} ${categoryConfig[p.category].color}`}
                  >
                    {categoryConfig[p.category].label}
                  </span>
                  {p.complianceRequired && (
                    <RiShieldCheckLine
                      size={13}
                      className={styles.complianceIcon}
                      title="Compliance required"
                    />
                  )}
                  {p.org_level && (
                    <RiGlobalLine
                      size={12}
                      style={{ color: "var(--text-3)" }}
                      title="Org-wide"
                    />
                  )}
                </div>
                <div className={styles.rowBody}>
                  <div className={styles.rowTitleRow}>
                    <span className={styles.rowTitle}>{p.title}</span>
                    <span
                      className={`${styles.statusBadge} ${statusConfig[p.status].className}`}
                    >
                      {statusConfig[p.status].label}
                    </span>
                  </div>
                  <div className={styles.rowMeta}>
                    <span>
                      <RiTeamLine size={11} /> {p.owner}
                    </span>
                    {p.lastUpdated && (
                      <>
                        <span>·</span>
                        <span>
                          <RiTimeLine size={11} /> Updated{" "}
                          {new Date(p.lastUpdated).toLocaleDateString()}
                        </span>
                      </>
                    )}
                    {(p.runCount ?? 0) > 0 && (
                      <>
                        <span>·</span>
                        <span>Run {p.runCount}×</span>
                      </>
                    )}
                  </div>
                  <p className={styles.rowDesc}>{p.description}</p>
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
        badge={detailBadge}
        footer={detailFooter}
      >
        {selected && <ProcessDetailBody process={selected} />}
      </SideDrawer>

      {/* Create drawer */}
      <SideDrawer
        open={showCreate}
        onClose={() => setShowCreate(false)}
        size="sm"
        title="New Process"
        subtitle="Document a runbook, SOP, or workflow"
      >
        <CreateProcessForm
          spaceId={spaceId}
          onClose={() => setShowCreate(false)}
        />
      </SideDrawer>
    </div>
  );
}
