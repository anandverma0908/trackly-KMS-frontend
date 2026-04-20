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
} from "react-icons/ri";
import styles from "./DecisionsPage.module.css";

/* ── Types ─────────────────────────────────────────────────────────────────── */
type DecisionStatus = "accepted" | "proposed" | "deprecated" | "superseded";

interface Decision {
  id: string;
  number: number;
  title: string;
  status: DecisionStatus;
  owner: string;
  date: string;
  context: string;
  decision: string;
  rationale: string;
  alternatives: string[];
  consequences: string;
  supersedes?: string;
  linkedTickets: string[];
  tags: string[];
}

/* ── Mock data ─────────────────────────────────────────────────────────────── */
const DECISIONS: Decision[] = [
  {
    id: "dec-1",
    number: 12,
    title: "Use JWT with short expiry + refresh token rotation",
    status: "accepted",
    owner: "Priya S.",
    date: "2024-11-14",
    context:
      "We needed a stateless auth mechanism that scales horizontally. Session-based auth was causing issues with our multi-region deployment.",
    decision:
      "Use JWT access tokens (15 min expiry) paired with refresh tokens stored in httpOnly cookies. Refresh tokens rotate on each use.",
    rationale:
      "Stateless auth enables horizontal scaling without shared session store. Short-lived access tokens limit blast radius of token leakage. Rotation prevents refresh token reuse attacks.",
    alternatives: [
      "Session-based auth with Redis — rejected due to single point of failure",
      "Long-lived JWTs — rejected due to inability to invalidate on logout",
      "OAuth2 with external IdP — considered for future, overkill for now",
    ],
    consequences:
      "Frontend must handle silent refresh. Added complexity vs simple sessions. Requires careful token storage.",
    linkedTickets: ["TRK-89", "TRK-142"],
    tags: ["auth", "security", "backend"],
  },
  {
    id: "dec-2",
    number: 11,
    title: "PostgreSQL as primary datastore (not MongoDB)",
    status: "accepted",
    owner: "Arjun K.",
    date: "2024-09-03",
    context:
      "Initial spike evaluated NoSQL (MongoDB) for flexibility. As the domain model clarified, relational constraints became important.",
    decision:
      "Use PostgreSQL 15 as the primary datastore with pgvector extension for AI embeddings.",
    rationale:
      "Domain model has clear relational structure (tickets, sprints, users, projects). ACID compliance critical for ticket state transitions. pgvector enables AI similarity search without a separate vector DB.",
    alternatives: [
      "MongoDB — rejected due to lack of joins and transaction complexity",
      "Supabase — considered, too much vendor lock-in",
      "PostgreSQL + separate Pinecone for vectors — rejected to reduce infra complexity",
    ],
    consequences:
      "Schema migrations required for changes. Less flexibility for unstructured data. pgvector performance at scale needs monitoring.",
    linkedTickets: ["TRK-44"],
    tags: ["database", "infrastructure", "ai"],
  },
  {
    id: "dec-3",
    number: 9,
    title: "Feature-first folder structure in React frontend",
    status: "accepted",
    owner: "Rahul M.",
    date: "2024-08-21",
    context:
      "The original flat component structure caused increasing coupling and made it hard to find related code. Team voted to refactor.",
    decision:
      "Adopt feature-first folder structure: each feature is a self-contained module in /src/features/{name}/. Shared code goes in /src/shared/.",
    rationale:
      "Colocating related files reduces cognitive load. Clear ownership per feature. Easy to delete a feature without orphaning files.",
    alternatives: [
      "Layer-based structure (components/, hooks/, utils/) — rejected due to file scatter",
      "Monorepo with feature packages — too much overhead for current team size",
    ],
    consequences:
      "Some shared logic may be duplicated initially. Import paths are longer. Cross-feature dependencies need explicit exports.",
    linkedTickets: ["TRK-67"],
    tags: ["frontend", "architecture"],
  },
  {
    id: "dec-4",
    number: 7,
    title: "Nova AI uses RAG with team knowledge base",
    status: "accepted",
    owner: "Anand V.",
    date: "2024-07-30",
    context:
      "Fine-tuning a model on team data was cost-prohibitive and required retraining on each update. RAG offers dynamic knowledge updates.",
    decision:
      "Nova uses Retrieval-Augmented Generation: embed all tickets, wiki pages, decisions, and standup notes into pgvector. At query time, retrieve top-k relevant chunks and pass to Claude as context.",
    rationale:
      "No retraining needed. Knowledge updates instantly (embed on create/update). Claude handles reasoning; pgvector handles retrieval. Citations link back to source documents.",
    alternatives: [
      "Fine-tuned GPT model — rejected: expensive, stale after each update",
      "Pure prompt engineering with no retrieval — rejected: context window limits",
      "Separate vector DB (Pinecone) — rejected in favor of pgvector (see DEC-11)",
    ],
    consequences:
      "Quality depends on embedding quality. Retrieval can fail for ambiguous queries. Context window limits max retrieved chunks to ~10.",
    linkedTickets: ["TRK-103"],
    tags: ["ai", "nova", "architecture"],
  },
  {
    id: "dec-5",
    number: 5,
    title: "Use CSS Modules over Tailwind for component styling",
    status: "accepted",
    owner: "Rahul M.",
    date: "2024-07-10",
    context:
      "Team evaluated Tailwind CSS vs CSS Modules for styling approach. Both had strong advocates.",
    decision:
      "Use CSS Modules with CSS custom properties (design tokens) for all component styling.",
    rationale:
      "CSS Modules provide true scoping without class name conflicts. Design tokens via CSS variables enable theming without Tailwind's JIT complexity. Better IDE support for non-standard properties.",
    alternatives: [
      "Tailwind — rejected: verbose JSX, purge complexity, theming requires more config",
      "styled-components — rejected: runtime CSS-in-JS performance overhead",
      "Vanilla CSS — rejected: no scoping, global namespace pollution",
    ],
    consequences:
      "More CSS files to manage. No utility classes for rapid prototyping. Consistent design requires discipline with token usage.",
    linkedTickets: [],
    tags: ["frontend", "styling"],
  },
];

/* ── Helpers ───────────────────────────────────────────────────────────────── */
const statusConfig: Record<DecisionStatus, { label: string; className: string; icon: React.ReactNode }> = {
  accepted: { label: "Accepted", className: styles.statusAccepted, icon: <RiCheckLine size={11} /> },
  proposed: { label: "Proposed", className: styles.statusProposed, icon: <RiQuestionLine size={11} /> },
  deprecated: { label: "Deprecated", className: styles.statusDeprecated, icon: <RiTimeLine size={11} /> },
  superseded: { label: "Superseded", className: styles.statusSuperseded, icon: <RiArrowRightLine size={11} /> },
};

/* ── Decision detail panel ─────────────────────────────────────────────────── */
function DecisionDetail({ decision, onClose }: { decision: Decision; onClose: () => void }) {
  return (
    <motion.div
      className={styles.detailPanel}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
    >
      <div className={styles.detailHeader}>
        <div className={styles.detailNum}>ADR-{String(decision.number).padStart(3, "0")}</div>
        <button className={styles.closeDetail} onClick={onClose}>✕</button>
      </div>
      <h2 className={styles.detailTitle}>{decision.title}</h2>

      <div className={styles.detailMeta}>
        <span className={`${styles.statusBadge} ${statusConfig[decision.status].className}`}>
          {statusConfig[decision.status].icon}
          {statusConfig[decision.status].label}
        </span>
        <span className={styles.metaItem}>
          <RiUser3Line size={12} /> {decision.owner}
        </span>
        <span className={styles.metaItem}>
          <RiTimeLine size={12} /> {new Date(decision.date).toLocaleDateString()}
        </span>
      </div>

      <div className={styles.tags}>
        {decision.tags.map((t) => (
          <span key={t} className={styles.tag}>{t}</span>
        ))}
      </div>

      <section className={styles.detailSection}>
        <h3 className={styles.sectionHeading}>Context</h3>
        <p className={styles.sectionBody}>{decision.context}</p>
      </section>

      <section className={styles.detailSection}>
        <h3 className={styles.sectionHeading}>Decision</h3>
        <p className={`${styles.sectionBody} ${styles.decisionHighlight}`}>{decision.decision}</p>
      </section>

      <section className={styles.detailSection}>
        <h3 className={styles.sectionHeading}>Rationale</h3>
        <p className={styles.sectionBody}>{decision.rationale}</p>
      </section>

      <section className={styles.detailSection}>
        <h3 className={styles.sectionHeading}>Alternatives Considered</h3>
        <ul className={styles.altList}>
          {decision.alternatives.map((a, i) => (
            <li key={i} className={styles.altItem}>{a}</li>
          ))}
        </ul>
      </section>

      <section className={styles.detailSection}>
        <h3 className={styles.sectionHeading}>Consequences</h3>
        <p className={styles.sectionBody}>{decision.consequences}</p>
      </section>

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
    </motion.div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────────── */
export default function DecisionsPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Decision | null>(null);
  const [novaQuery, setNovaQuery] = useState("");
  const [novaAnswer, setNovaAnswer] = useState("");
  const [novaLoading, setNovaLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filtered = DECISIONS.filter((d) => {
    const matchSearch =
      !search ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.tags.some((t) => t.includes(search.toLowerCase()));
    const matchStatus = filterStatus === "all" || d.status === filterStatus;
    return matchSearch && matchStatus;
  });

  async function handleNovaQuery() {
    if (!novaQuery.trim()) return;
    setNovaLoading(true);
    setNovaAnswer("");
    await new Promise((r) => setTimeout(r, 1000));
    setNovaAnswer(
      `Based on ADR-012, the team decided to use JWT with refresh token rotation for authentication. The key rationale was stateless scaling and token invalidation on logout. See also ADR-007 for how Nova's AI architecture integrates with this auth system.`
    );
    setNovaLoading(false);
  }

  return (
    <div className={styles.page}>
      {/* ── Left column ── */}
      <div className={`${styles.listCol} ${selected ? styles.listColNarrow : ""}`}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <RiFileTextLine size={20} className={styles.headerIcon} />
            <div>
              <h1 className={styles.title}>Decisions</h1>
              <p className={styles.subtitle}>
                Architecture decision records · Institutional memory
              </p>
            </div>
          </div>
          <button className={styles.addBtn}>
            <RiAddLine size={15} /> New Decision
          </button>
        </div>

        {/* Nova search */}
        <div className={styles.novaBar}>
          <div className={styles.novaBarInner}>
            <RiBrainLine size={14} className={styles.novaIcon} />
            <input
              className={styles.novaInput}
              placeholder='Ask Nova: "What was decided about authentication?"'
              value={novaQuery}
              onChange={(e) => setNovaQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNovaQuery()}
            />
            <button
              className={styles.novaAsk}
              onClick={handleNovaQuery}
              disabled={novaLoading}
            >
              {novaLoading ? "..." : "Ask"}
            </button>
          </div>
          <AnimatePresence>
            {novaAnswer && (
              <motion.div
                className={styles.novaAnswer}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <RiBrainLine size={13} className={styles.novaAnswerIcon} />
                <p>{novaAnswer}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Filters */}
        <div className={styles.filters}>
          <div className={styles.searchWrap}>
            <RiSearchLine size={13} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Search decisions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className={styles.statusFilters}>
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
        </div>

        {/* List */}
        <div className={styles.list}>
          {filtered.map((d, i) => (
            <motion.div
              key={d.id}
              className={`${styles.decisionRow} ${selected?.id === d.id ? styles.decisionRowActive : ""}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelected(d)}
            >
              <div className={styles.rowNum}>
                ADR-{String(d.number).padStart(3, "0")}
              </div>
              <div className={styles.rowBody}>
                <div className={styles.rowTitleRow}>
                  <span className={styles.rowTitle}>{d.title}</span>
                  <span className={`${styles.statusBadge} ${statusConfig[d.status].className}`}>
                    {statusConfig[d.status].icon}
                    {statusConfig[d.status].label}
                  </span>
                </div>
                <div className={styles.rowMeta}>
                  <span>{d.owner}</span>
                  <span>·</span>
                  <span>{new Date(d.date).toLocaleDateString()}</span>
                  <div className={styles.tags}>
                    {d.tags.slice(0, 3).map((t) => (
                      <span key={t} className={styles.tag}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>
              <RiArrowRightLine size={14} className={styles.rowArrow} />
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Detail panel ── */}
      <AnimatePresence>
        {selected && (
          <DecisionDetail
            decision={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
