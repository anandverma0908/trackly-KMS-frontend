import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RiShieldCheckLine,
  RiAddLine,
  RiSearchLine,
  RiTimeLine,
  RiTeamLine,
  RiArrowRightLine,
  RiCheckboxCircleLine,
} from "react-icons/ri";
import styles from "./ProcessesPage.module.css";

/* ── Types ─────────────────────────────────────────────────────────────────── */
type ProcessCategory = "runbook" | "sop" | "compliance" | "template" | "workflow";
type ProcessStatus = "active" | "draft" | "review" | "deprecated";

interface ProcessStep {
  id: string;
  order: number;
  title: string;
  description: string;
  owner?: string;
  estimatedTime?: string;
  required: boolean;
}

interface Process {
  id: string;
  title: string;
  category: ProcessCategory;
  status: ProcessStatus;
  owner: string;
  lastUpdated: string;
  description: string;
  steps: ProcessStep[];
  tags: string[];
  complianceRequired?: boolean;
  avgCompletionTime?: string;
  runCount?: number;
}

/* ── Mock data ─────────────────────────────────────────────────────────────── */
const PROCESSES: Process[] = [
  {
    id: "p1",
    title: "Database Failover Procedure",
    category: "runbook",
    status: "active",
    owner: "Arjun K.",
    lastUpdated: "2025-03-12",
    description:
      "Step-by-step runbook for handling PostgreSQL primary failover to replica. Execute during DB incidents.",
    complianceRequired: true,
    avgCompletionTime: "~25 min",
    runCount: 3,
    tags: ["database", "incident", "critical"],
    steps: [
      { id: "s1", order: 1, title: "Verify primary is unreachable", description: "Run health check on primary. Check pg_ctl status and replication lag.", owner: "On-call", estimatedTime: "2 min", required: true },
      { id: "s2", order: 2, title: "Promote replica to primary", description: "SSH to replica. Run: pg_ctl promote -D /var/lib/postgresql/data", owner: "DB Admin", estimatedTime: "5 min", required: true },
      { id: "s3", order: 3, title: "Update connection strings", description: "Update DATABASE_URL in all services to point to new primary IP. Restart services.", owner: "DevOps", estimatedTime: "10 min", required: true },
      { id: "s4", order: 4, title: "Verify replication resumes", description: "Spin up new replica from new primary. Confirm streaming replication.", owner: "DB Admin", estimatedTime: "15 min", required: true },
      { id: "s5", order: 5, title: "Post-incident review", description: "Document timeline, root cause, and prevention measures in incident log.", owner: "Engineering Manager", estimatedTime: "30 min", required: false },
    ],
  },
  {
    id: "p2",
    title: "On-call Incident Response",
    category: "sop",
    status: "active",
    owner: "Priya S.",
    lastUpdated: "2025-02-28",
    description:
      "Standard operating procedure for on-call engineers. Covers alert triage, escalation, and resolution.",
    complianceRequired: false,
    avgCompletionTime: "Varies",
    runCount: 24,
    tags: ["incident", "on-call", "sre"],
    steps: [
      { id: "s1", order: 1, title: "Acknowledge alert within 5 minutes", description: "Acknowledge in PagerDuty. Join #incidents Slack channel.", required: true },
      { id: "s2", order: 2, title: "Assess severity (P1–P4)", description: "P1: All users affected. P2: Partial outage. P3: Performance degraded. P4: Minor.", required: true },
      { id: "s3", order: 3, title: "Open incident ticket", description: "Create TRK ticket with template: [INC] <date> <description>. Link to PagerDuty.", required: true },
      { id: "s4", order: 4, title: "Escalate if P1/P2", description: "Page engineering manager and relevant team lead. Post in #status.", required: false },
      { id: "s5", order: 5, title: "Resolve and document", description: "Mark incident resolved. Write postmortem within 48 hours for P1/P2.", required: true },
    ],
  },
  {
    id: "p3",
    title: "New Engineer Onboarding",
    category: "workflow",
    status: "active",
    owner: "Rahul M.",
    lastUpdated: "2025-01-15",
    description:
      "First 30 days checklist for new engineers. Covers tooling, access, codebase walkthrough, and first ticket.",
    complianceRequired: false,
    avgCompletionTime: "30 days",
    runCount: 5,
    tags: ["onboarding", "hr", "people"],
    steps: [
      { id: "s1", order: 1, title: "Access provisioning (Day 1)", description: "GitHub, Slack, PagerDuty, AWS console, Trackly. IT ticket required.", required: true },
      { id: "s2", order: 2, title: "Local dev setup (Day 1–2)", description: "Follow README in trackly-backend and trackly-frontend. Run docker-compose up.", required: true },
      { id: "s3", order: 3, title: "Architecture walkthrough (Day 3)", description: "30 min with tech lead. Review system diagram and key decision records.", required: true },
      { id: "s4", order: 4, title: "First ticket (Day 3–5)", description: "Pick a Good First Issue labeled ticket. PR must be reviewed by buddy engineer.", required: true },
      { id: "s5", order: 5, title: "30-day check-in", description: "Meeting with engineering manager. Review onboarding satisfaction and goals.", required: false },
    ],
  },
  {
    id: "p4",
    title: "Security Vulnerability Disclosure",
    category: "compliance",
    status: "active",
    owner: "Anand V.",
    lastUpdated: "2025-04-01",
    description:
      "Compliance-required process for handling security vulnerability reports. Must be followed for all P0/P1 security issues.",
    complianceRequired: true,
    avgCompletionTime: "72 hours",
    runCount: 1,
    tags: ["security", "compliance", "legal"],
    steps: [
      { id: "s1", order: 1, title: "Log and classify vulnerability", description: "Create private TRK ticket. Do not disclose publicly. Classify severity with CVSS score.", required: true },
      { id: "s2", order: 2, title: "Notify legal within 24h", description: "Email security@trackly.io and legal@trackly.io. Include severity and affected systems.", required: true },
      { id: "s3", order: 3, title: "Develop and test patch", description: "Fix in private branch. Full QA and security review before merge.", required: true },
      { id: "s4", order: 4, title: "Coordinated disclosure", description: "Agree disclosure timeline with reporter (if external). Minimum 30 day embargo.", required: true },
    ],
  },
  {
    id: "p5",
    title: "Sprint Planning Template",
    category: "template",
    status: "active",
    owner: "Rahul M.",
    lastUpdated: "2025-03-20",
    description:
      "Standard template for running a sprint planning meeting. 2-hour timebox. Attendees: full engineering team.",
    complianceRequired: false,
    avgCompletionTime: "2 hours",
    runCount: 18,
    tags: ["sprint", "planning", "agile"],
    steps: [
      { id: "s1", order: 1, title: "Review previous sprint (15 min)", description: "Celebrate wins. Review incomplete tickets — carry forward or close?", required: true },
      { id: "s2", order: 2, title: "Confirm team capacity (10 min)", description: "Note PTO, on-call, and other commitments. Calculate available points.", required: true },
      { id: "s3", order: 3, title: "Groom backlog top 20 (45 min)", description: "Discuss, estimate, and prioritize. Use Nova to surface blocking dependencies.", required: true },
      { id: "s4", order: 4, title: "Commit to sprint scope (15 min)", description: "Move tickets to Sprint. Confirm sprint goal statement.", required: true },
      { id: "s5", order: 5, title: "Close with sprint goal statement", description: "Document in sprint description: 'By end of sprint, we will...'", required: true },
    ],
  },
];

/* ── Helpers ──────────────────────────────────────────────────────────────── */
const categoryConfig: Record<ProcessCategory, { label: string; color: string }> = {
  runbook: { label: "Runbook", color: styles.catRunbook },
  sop: { label: "SOP", color: styles.catSop },
  compliance: { label: "Compliance", color: styles.catCompliance },
  template: { label: "Template", color: styles.catTemplate },
  workflow: { label: "Workflow", color: styles.catWorkflow },
};

const statusConfig: Record<ProcessStatus, { label: string; className: string }> = {
  active: { label: "Active", className: styles.statusActive },
  draft: { label: "Draft", className: styles.statusDraft },
  review: { label: "In Review", className: styles.statusReview },
  deprecated: { label: "Deprecated", className: styles.statusDeprecated },
};

/* ── Process detail ───────────────────────────────────────────────────────── */
function ProcessDetail({ process, onClose }: { process: Process; onClose: () => void }) {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  function toggleStep(id: string) {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const pct = Math.round((completedSteps.size / process.steps.length) * 100);

  return (
    <motion.div
      className={styles.detailPanel}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
    >
      <div className={styles.detailHeader}>
        <div className={styles.detailMeta}>
          <span className={`${styles.catBadge} ${categoryConfig[process.category].color}`}>
            {categoryConfig[process.category].label}
          </span>
          {process.complianceRequired && (
            <span className={styles.complianceBadge}>
              <RiShieldCheckLine size={11} /> Compliance Required
            </span>
          )}
        </div>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <h2 className={styles.detailTitle}>{process.title}</h2>

      <div className={styles.detailInfo}>
        <span className={styles.infoItem}><RiTeamLine size={12} /> {process.owner}</span>
        <span className={styles.infoItem}><RiTimeLine size={12} /> {process.avgCompletionTime}</span>
        {process.runCount && (
          <span className={styles.infoItem}>Run {process.runCount}×</span>
        )}
      </div>

      <p className={styles.detailDesc}>{process.description}</p>

      {/* Progress */}
      {completedSteps.size > 0 && (
        <div className={styles.progressSection}>
          <div className={styles.progressLabel}>
            <span>{completedSteps.size}/{process.steps.length} steps complete</span>
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

      {/* Steps */}
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
                  <RiCheckboxCircleLine size={18} className={styles.checkDone} />
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
                    <span className={styles.stepTime}>{step.estimatedTime}</span>
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
    </motion.div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function ProcessesPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Process | null>(null);
  const [filterCat, setFilterCat] = useState<string>("all");

  const filtered = PROCESSES.filter((p) => {
    const matchSearch =
      !search ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.tags.some((t) => t.includes(search.toLowerCase()));
    const matchCat = filterCat === "all" || p.category === filterCat;
    return matchSearch && matchCat;
  });

  const categories: ("all" | ProcessCategory)[] = ["all", "runbook", "sop", "compliance", "template", "workflow"];

  return (
    <div className={styles.page}>
      <div className={`${styles.listCol} ${selected ? styles.listColNarrow : ""}`}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <RiShieldCheckLine size={20} className={styles.headerIcon} />
            <div>
              <h1 className={styles.title}>Processes</h1>
              <p className={styles.subtitle}>SOPs · Runbooks · Compliance · Templates</p>
            </div>
          </div>
          <button className={styles.addBtn}>
            <RiAddLine size={15} /> New Process
          </button>
        </div>

        {/* Stats strip */}
        <div className={styles.statsStrip}>
          <div className={styles.statBox}>
            <span className={styles.statNum}>{PROCESSES.length}</span>
            <span className={styles.statLabel}>total processes</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statNum}>{PROCESSES.filter(p => p.complianceRequired).length}</span>
            <span className={styles.statLabel}>compliance required</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statNum}>{PROCESSES.reduce((a, p) => a + (p.runCount || 0), 0)}</span>
            <span className={styles.statLabel}>total executions</span>
          </div>
          <div className={styles.statBox}>
            <span className={`${styles.statNum} ${styles.statWarn}`}>
              {PROCESSES.filter(p => {
                const d = new Date(p.lastUpdated);
                return Date.now() - d.getTime() > 90 * 24 * 60 * 60 * 1000;
              }).length}
            </span>
            <span className={styles.statLabel}>may be stale (&gt;90d)</span>
          </div>
        </div>

        {/* Filters */}
        <div className={styles.filters}>
          <div className={styles.searchWrap}>
            <RiSearchLine size={13} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Search processes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className={styles.catFilters}>
            {categories.map((c) => (
              <button
                key={c}
                className={`${styles.filterChip} ${filterCat === c ? styles.filterChipActive : ""}`}
                onClick={() => setFilterCat(c)}
              >
                {c === "all" ? "All" : categoryConfig[c as ProcessCategory].label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className={styles.list}>
          {filtered.map((p, i) => (
            <motion.div
              key={p.id}
              className={`${styles.processRow} ${selected?.id === p.id ? styles.processRowActive : ""}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelected(p)}
            >
              <div className={styles.rowLeft}>
                <span className={`${styles.catBadge} ${categoryConfig[p.category].color}`}>
                  {categoryConfig[p.category].label}
                </span>
                {p.complianceRequired && (
                  <RiShieldCheckLine size={13} className={styles.complianceIcon} title="Compliance required" />
                )}
              </div>
              <div className={styles.rowBody}>
                <div className={styles.rowTitleRow}>
                  <span className={styles.rowTitle}>{p.title}</span>
                  <span className={`${styles.statusBadge} ${statusConfig[p.status].className}`}>
                    {statusConfig[p.status].label}
                  </span>
                </div>
                <div className={styles.rowMeta}>
                  <span><RiTeamLine size={11} /> {p.owner}</span>
                  <span>·</span>
                  <span><RiTimeLine size={11} /> Updated {new Date(p.lastUpdated).toLocaleDateString()}</span>
                  {p.runCount && (
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
          ))}
        </div>
      </div>

      {/* Detail panel */}
      <AnimatePresence>
        {selected && (
          <ProcessDetail process={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
