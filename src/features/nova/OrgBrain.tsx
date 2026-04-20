import { useState } from "react";
import { RiSearchLine, RiSparklingLine, RiFileTextLine, RiTeamLine, RiTimeLine, RiUserLine, RiHistoryLine } from "react-icons/ri";
import toast from "react-hot-toast";
import panelStyles from "./Gen2.module.css";
import styles from "./Gen3.module.css";

interface ThreadNode {
  date: string;
  type: "ticket" | "wiki" | "meeting" | "standup" | "decision";
  ref: string;
  title: string;
  author: string;
}

interface Decision {
  id: string;
  keywords: string[];
  title: string;
  date: string;
  summary: string;
  thread: ThreadNode[];
  people: string[];
  tags: string[];
}

const DECISIONS: Decision[] = [
  {
    id: "d1",
    keywords: ["monolith", "microservices", "services", "decompose", "broke", "split", "migrate"],
    title: "Microservices Migration Decision",
    date: "March 15, 2026",
    summary: "Decision to decompose the monolith was driven by persistent auth service latency spikes (3s+ p99) and the need for independent deploy velocity per service. A 3-phase migration strategy was approved after evaluating modular monolith as an alternative.",
    thread: [
      { date: "Feb 1, 2026", type: "ticket", ref: "PERF-1204", title: "Auth service causing 3s+ latency spikes under load", author: "Anand V." },
      { date: "Feb 14, 2026", type: "meeting", ref: "ARCH-MTG-03", title: "Architecture Review: Microservices vs Modular Monolith — trade-offs discussion", author: "Priya S." },
      { date: "Feb 28, 2026", type: "wiki", ref: "ADR-007", title: "ADR-007: Microservices Adoption Strategy", author: "Rahul D." },
      { date: "Mar 5, 2026", type: "standup", ref: "S14-D1", title: "Sprint 14 kickoff — migration tracks assigned to pods", author: "Anand V." },
      { date: "Mar 15, 2026", type: "decision", ref: "DEC-019", title: "Final sign-off: 3-phase migration timeline approved by leadership", author: "Anand V." },
    ],
    people: ["Anand V.", "Priya S.", "Rahul D.", "Karan M."],
    tags: ["architecture", "scalability", "infrastructure", "migration"],
  },
  {
    id: "d2",
    keywords: ["postgresql", "postgres", "mongodb", "database", "db", "nosql", "sql"],
    title: "PostgreSQL over MongoDB for Core Data",
    date: "November 10, 2025",
    summary: "PostgreSQL selected for ACID compliance in financial transaction handling and existing team expertise. MongoDB was evaluated but rejected — relational data patterns in the billing domain made NoSQL a poor fit.",
    thread: [
      { date: "Oct 20, 2025", type: "ticket", ref: "ARCH-892", title: "Database selection for new billing service", author: "Priya S." },
      { date: "Nov 5, 2025", type: "wiki", ref: "ADR-003", title: "ADR-003: Database Strategy — PostgreSQL vs MongoDB evaluation", author: "Rahul D." },
      { date: "Nov 10, 2025", type: "decision", ref: "DEC-012", title: "Final decision: PostgreSQL primary with read replicas for analytics", author: "Anand V." },
    ],
    people: ["Priya S.", "Rahul D.", "Anand V."],
    tags: ["database", "infrastructure", "billing"],
  },
  {
    id: "d3",
    keywords: ["auth", "authentication", "jwt", "tokens", "session", "login", "refresh"],
    title: "JWT with Silent Refresh Architecture",
    date: "September 22, 2025",
    summary: "Short-lived JWTs (15 min TTL) with silent background refresh adopted after evaluating session-based auth. Enables stateless horizontal scaling while maintaining security. Token refresh happens 60 seconds before expiry.",
    thread: [
      { date: "Sep 1, 2025", type: "ticket", ref: "SEC-441", title: "Auth token expiry causing user logouts under concurrent load", author: "Priya S." },
      { date: "Sep 15, 2025", type: "wiki", ref: "ADR-001", title: "ADR-001: Auth Architecture — JWT vs Session-based comparison", author: "Priya S." },
      { date: "Sep 22, 2025", type: "decision", ref: "DEC-008", title: "Adopt JWT with 60s pre-expiry silent refresh pattern", author: "Anand V." },
    ],
    people: ["Priya S.", "Anand V."],
    tags: ["authentication", "security", "jwt"],
  },
  {
    id: "d4",
    keywords: ["rate limit", "rate limiting", "throttle", "api", "429", "abuse"],
    title: "Token Bucket Rate Limiting Strategy",
    date: "January 8, 2026",
    summary: "Token bucket algorithm adopted for API rate limiting at the gateway layer. Redis-backed with per-user and per-endpoint limits. Decision driven by a surge in automated abuse of the public API in Q4 2025.",
    thread: [
      { date: "Dec 20, 2025", type: "ticket", ref: "SEC-891", title: "Public API abuse causing 40% traffic spike — automated clients", author: "Karan M." },
      { date: "Jan 5, 2026", type: "wiki", ref: "ADR-009", title: "ADR-009: API Rate Limiting — token bucket vs leaky bucket", author: "Rahul D." },
      { date: "Jan 8, 2026", type: "decision", ref: "DEC-021", title: "Implement token bucket at API gateway with Redis backend", author: "Anand V." },
    ],
    people: ["Karan M.", "Rahul D.", "Anand V."],
    tags: ["api", "security", "rate-limiting", "redis"],
  },
];

const SUGGESTIONS = [
  "Why was the monolith broken into microservices?",
  "Why do we use PostgreSQL?",
  "Who drove the auth architecture?",
  "What is our rate limiting strategy?",
];

const TYPE_ICON: Record<string, React.ReactNode> = {
  ticket: <RiHistoryLine size={11} />,
  wiki: <RiFileTextLine size={11} />,
  meeting: <RiTeamLine size={11} />,
  standup: <RiTimeLine size={11} />,
  decision: <RiSparklingLine size={11} />,
};

const TYPE_COLOR: Record<string, string> = {
  ticket: "var(--text-3)",
  wiki: "var(--green, #34D399)",
  meeting: "var(--purple, #a78bfa)",
  standup: "var(--text-3)",
  decision: "var(--accent)",
};

function searchDecisions(q: string): Decision | null {
  const lower = q.toLowerCase();
  return DECISIONS.find((d) => d.keywords.some((k) => lower.includes(k))) ?? null;
}

export default function OrgBrain() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<Decision | null>(null);
  const [noResult, setNoResult] = useState(false);

  async function runSearch(q: string) {
    const text = q.trim();
    if (!text) return;
    setQuery(text);
    setSearching(true);
    setResult(null);
    setNoResult(false);
    await new Promise((r) => setTimeout(r, 1100));
    const found = searchDecisions(text);
    if (found) {
      setResult(found);
    } else {
      setNoResult(true);
      toast("EOS searched 4.7k knowledge items — no exact match. Try a different query.", { icon: "🔍" });
    }
    setSearching(false);
  }

  return (
    <div className={panelStyles.panel}>
      <div className={panelStyles.panelHeader}>
        <h2 className={panelStyles.panelTitle}>Organizational Brain</h2>
        <p className={panelStyles.panelSub}>
          Complete institutional memory — every decision, ticket, standup, and wiki page since day one. Nothing is ever lost.
        </p>
      </div>

      <div className={styles.brainSearch}>
        <div className={styles.brainSearchRow}>
          <RiSearchLine size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
          <input
            className={styles.brainSearchInput}
            placeholder="Ask anything — 'Why did we choose Postgres?' · 'Who led the auth decision?'"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch(query)}
          />
          <button
            className={styles.brainSearchBtn}
            onClick={() => runSearch(query)}
            disabled={!query.trim() || searching}
          >
            <RiSearchLine size={14} />
          </button>
        </div>

        <div className={styles.brainSuggestions}>
          {SUGGESTIONS.map((s) => (
            <button key={s} className={styles.brainSuggestion} onClick={() => runSearch(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {searching && (
        <div className={styles.brainSearching}>
          <RiSparklingLine size={14} color="var(--accent)" />
          <span>EOS is searching 4.7k knowledge items…</span>
          <div className={styles.brainSearchingDots}>
            <span /><span /><span />
          </div>
        </div>
      )}

      {result && !searching && (
        <div className={styles.decisionResult}>
          <div className={styles.decisionResultHeader}>
            <span className={styles.decisionTitle}>{result.title}</span>
            <span className={styles.decisionDate}>{result.date}</span>
          </div>

          <p className={styles.decisionSummary}>{result.summary}</p>

          <div className={styles.decisionPeople}>
            <span className={styles.decisionPeopleLabel}>Key people:</span>
            {result.people.map((p) => (
              <span key={p} className={styles.decisionPerson}><RiUserLine size={10} /> {p}</span>
            ))}
          </div>

          <div>
            <div className={styles.threadLabel}>Decision thread — {result.thread.length} events</div>
            <div className={styles.thread}>
              {result.thread.map((node, i) => (
                <div key={i} className={styles.threadNode}>
                  <div className={styles.threadDot} style={{ color: TYPE_COLOR[node.type] }}>
                    {TYPE_ICON[node.type]}
                  </div>
                  <div className={styles.threadBody}>
                    <div className={styles.threadRef} style={{ color: TYPE_COLOR[node.type] }}>{node.ref}</div>
                    <div className={styles.threadTitle}>{node.title}</div>
                    <div className={styles.threadMeta}>{node.date} · {node.author}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.decisionTags}>
            {result.tags.map((t) => <span key={t} className={styles.decisionTag}>{t}</span>)}
          </div>
        </div>
      )}

      {!result && !searching && !noResult && (
        <div className={styles.brainEmpty}>
          <div className={styles.brainEmptyIcon}><RiHistoryLine size={42} /></div>
          <div className={styles.brainEmptyTitle}>4.7k knowledge items indexed</div>
          <p className={styles.brainEmptyText}>
            Every ticket, decision, standup, wiki page, and meeting note — searchable in natural language. New joiners get institutional memory on day one.
          </p>
        </div>
      )}

      {noResult && !searching && (
        <div className={styles.brainEmpty}>
          <div className={styles.brainEmptyIcon}><RiSearchLine size={36} /></div>
          <div className={styles.brainEmptyTitle}>No exact match found</div>
          <p className={styles.brainEmptyText}>
            EOS searched the full knowledge base. Try different keywords or ask Nova in the Chat tab for a conversational answer.
          </p>
        </div>
      )}
    </div>
  );
}
