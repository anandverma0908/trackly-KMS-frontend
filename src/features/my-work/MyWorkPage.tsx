import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/features/auth/useAuthStore";
import {
  RiBrainLine,
  RiAlertLine,
  RiCheckboxCircleLine,
  RiTimeLine,
  RiArrowRightLine,
  RiFireLine,
  RiArrowUpLine,
  RiArrowDownLine,
  RiRefreshLine,
  RiExternalLinkLine,
} from "react-icons/ri";
import styles from "./MyWorkPage.module.css";

/* ── Mock data ─────────────────────────────────────────────────────────────── */
const MORNING_BRIEF =
  "Good morning. Sprint 9 is at risk — 73% completion probability with 3 days left. TRK-142 has been blocked for 48 hours and is blocking two teammates. Nova recommends starting there.";

const MY_TICKETS = [
  {
    key: "TRK-142",
    summary: "Fix auth token refresh race condition",
    status: "In Progress",
    priority: "Critical",
    points: 5,
    aiRank: 1,
    aiReason: "Blocking 2 teammates · On sprint critical path · Blocked 48h",
    urgency: "critical",
    assignee: "You",
    sprint: "Sprint 9",
    blockedBy: ["TRK-138"],
    blocking: ["TRK-145", "TRK-147"],
  },
  {
    key: "TRK-156",
    summary: "Implement rate limiting on /api/nova endpoints",
    status: "Open",
    priority: "High",
    points: 3,
    aiRank: 2,
    aiReason: "Due in 2 days · High impact on Nova reliability",
    urgency: "high",
    assignee: "You",
    sprint: "Sprint 9",
    blockedBy: [],
    blocking: [],
  },
  {
    key: "TRK-161",
    summary: "Add pagination to Decisions API",
    status: "Open",
    priority: "Medium",
    points: 2,
    aiRank: 3,
    aiReason: "Unblocked · 3 similar tickets completed avg 1.5 days",
    urgency: "medium",
    assignee: "You",
    sprint: "Sprint 9",
    blockedBy: [],
    blocking: [],
  },
  {
    key: "TRK-133",
    summary: "Write runbook for DB failover procedure",
    status: "Open",
    priority: "Low",
    points: 1,
    aiRank: 4,
    aiReason: "No dependencies · Low urgency · Good for end-of-day",
    urgency: "low",
    assignee: "You",
    sprint: "Sprint 9",
    blockedBy: [],
    blocking: [],
  },
];

const WATCHING = [
  {
    key: "TRK-138",
    summary: "Design token refresh API endpoint",
    status: "In Review",
    assignee: "Priya S.",
    update: "PR opened 3h ago",
  },
  {
    key: "TRK-145",
    summary: "Frontend auth state management refactor",
    status: "Blocked",
    assignee: "Rahul M.",
    update: "Waiting on TRK-142",
  },
];

const SPRINT_HEALTH = {
  name: "Sprint 9",
  probability: 73,
  daysLeft: 3,
  totalTickets: 18,
  doneTickets: 11,
  atRisk: 3,
  recommendation: "Move TRK-159 and TRK-163 to backlog to protect sprint goal",
};

/* ── Typewriter ─────────────────────────────────────────────────────────────── */
function Typewriter({ text, speed = 22 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  return (
    <span>
      {displayed}
      {!done && <span className={styles.cursor}>|</span>}
    </span>
  );
}

/* ── Urgency helpers ─────────────────────────────────────────────────────── */
const urgencyClass: Record<string, string> = {
  critical: styles.urgencyCritical,
  high: styles.urgencyHigh,
  medium: styles.urgencyMedium,
  low: styles.urgencyLow,
};

const urgencyLabel: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

/* ── Page ───────────────────────────────────────────────────────────────────── */
export default function MyWorkPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [briefDone, setBriefDone] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const name = user?.name?.split(" ")[0] ?? "there";
  const personalizedBrief = MORNING_BRIEF.replace("Good morning", greeting);

  return (
    <div className={styles.page}>
      {/* ── Morning Brief ── */}
      <motion.div
        className={styles.brief}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className={styles.briefHeader}>
          <div className={styles.novaChip}>
            <RiBrainLine size={13} />
            <span>Nova · Morning Brief</span>
          </div>
          <button className={styles.refreshBtn} title="Refresh brief">
            <RiRefreshLine size={14} />
          </button>
        </div>
        <p className={styles.briefText}>
          {greeting}, {name}.{" "}
          <Typewriter
            text={personalizedBrief.replace(/^Good \w+\./,"")}
            speed={18}
          />
        </p>
        <div className={styles.briefMeta}>
          <span className={styles.briefDate}>
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>
      </motion.div>

      <div className={styles.columns}>
        {/* ── Left column ── */}
        <div className={styles.main}>
          {/* Sprint Health */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <RiFireLine size={15} />
                {SPRINT_HEALTH.name} Health
              </h2>
              <button
                className={styles.linkBtn}
                onClick={() => navigate("/sprints")}
              >
                View sprint <RiArrowRightLine size={12} />
              </button>
            </div>

            <div className={styles.healthRow}>
              <div className={styles.healthStat}>
                <span className={styles.healthNum}>
                  {SPRINT_HEALTH.probability}%
                </span>
                <span className={styles.healthLabel}>completion probability</span>
              </div>
              <div className={styles.healthStat}>
                <span className={styles.healthNum}>
                  {SPRINT_HEALTH.doneTickets}/{SPRINT_HEALTH.totalTickets}
                </span>
                <span className={styles.healthLabel}>tickets done</span>
              </div>
              <div className={styles.healthStat}>
                <span
                  className={`${styles.healthNum} ${styles.healthRisk}`}
                >
                  {SPRINT_HEALTH.atRisk}
                </span>
                <span className={styles.healthLabel}>at risk</span>
              </div>
              <div className={styles.healthStat}>
                <span className={styles.healthNum}>
                  {SPRINT_HEALTH.daysLeft}d
                </span>
                <span className={styles.healthLabel}>remaining</span>
              </div>
            </div>

            <div className={styles.progressBar}>
              <motion.div
                className={styles.progressFill}
                initial={{ width: 0 }}
                animate={{
                  width: `${SPRINT_HEALTH.probability}%`,
                  background:
                    SPRINT_HEALTH.probability >= 80
                      ? "var(--green)"
                      : SPRINT_HEALTH.probability >= 60
                      ? "var(--amber)"
                      : "var(--red)",
                }}
                transition={{ duration: 0.8, delay: 0.3 }}
              />
            </div>

            <div className={styles.healthRec}>
              <RiAlertLine size={13} />
              <span>{SPRINT_HEALTH.recommendation}</span>
            </div>
          </section>

          {/* My Tickets */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <RiCheckboxCircleLine size={15} />
                My Tickets
              </h2>
              <span className={styles.rankLabel}>AI-ranked by priority</span>
            </div>

            <div className={styles.ticketList}>
              {MY_TICKETS.map((ticket, idx) => (
                <motion.div
                  key={ticket.key}
                  className={`${styles.ticketRow} ${
                    selectedTicket === ticket.key ? styles.ticketRowSelected : ""
                  }`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.07 }}
                  onClick={() =>
                    setSelectedTicket(
                      selectedTicket === ticket.key ? null : ticket.key
                    )
                  }
                >
                  <div className={styles.ticketRank}>
                    <span className={styles.rankNum}>{ticket.aiRank}</span>
                  </div>

                  <div className={styles.ticketBody}>
                    <div className={styles.ticketTop}>
                      <span className={styles.ticketKey}>{ticket.key}</span>
                      <span
                        className={`${styles.urgencyBadge} ${urgencyClass[ticket.urgency]}`}
                      >
                        {urgencyLabel[ticket.urgency]}
                      </span>
                      <span className={styles.ticketPoints}>
                        {ticket.points}pt
                      </span>
                    </div>
                    <p className={styles.ticketSummary}>{ticket.summary}</p>

                    <AnimatePresence>
                      {selectedTicket === ticket.key && (
                        <motion.div
                          className={styles.ticketExpanded}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className={styles.novaReason}>
                            <RiBrainLine size={12} />
                            <span>{ticket.aiReason}</span>
                          </div>
                          {ticket.blocking.length > 0 && (
                            <div className={styles.blockingRow}>
                              <RiArrowUpLine size={12} />
                              <span>
                                Blocking:{" "}
                                {ticket.blocking.map((k) => (
                                  <span key={k} className={styles.ticketRef}>
                                    {k}
                                  </span>
                                ))}
                              </span>
                            </div>
                          )}
                          {ticket.blockedBy.length > 0 && (
                            <div className={styles.blockedRow}>
                              <RiArrowDownLine size={12} />
                              <span>
                                Blocked by:{" "}
                                {ticket.blockedBy.map((k) => (
                                  <span key={k} className={styles.ticketRef}>
                                    {k}
                                  </span>
                                ))}
                              </span>
                            </div>
                          )}
                          <button className={styles.openTicketBtn}>
                            Open ticket <RiExternalLinkLine size={11} />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className={styles.ticketStatus}>
                    <span
                      className={`${styles.statusDot} ${
                        ticket.status === "In Progress"
                          ? styles.statusInProgress
                          : ticket.status === "Blocked"
                          ? styles.statusBlocked
                          : styles.statusOpen
                      }`}
                    />
                    <span className={styles.statusText}>{ticket.status}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        </div>

        {/* ── Right column ── */}
        <div className={styles.sidebar}>
          {/* Watching */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <RiTimeLine size={15} />
                Watching
              </h2>
            </div>
            <div className={styles.watchList}>
              {WATCHING.map((t) => (
                <div key={t.key} className={styles.watchItem}>
                  <div className={styles.watchTop}>
                    <span className={styles.ticketKey}>{t.key}</span>
                    <span
                      className={`${styles.statusDot} ${
                        t.status === "In Review"
                          ? styles.statusInProgress
                          : styles.statusBlocked
                      }`}
                    />
                  </div>
                  <p className={styles.watchSummary}>{t.summary}</p>
                  <div className={styles.watchMeta}>
                    <span>{t.assignee}</span>
                    <span className={styles.watchUpdate}>{t.update}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Quick actions */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Quick Actions</h2>
            </div>
            <div className={styles.quickActions}>
              <button
                className={styles.quickAction}
                onClick={() => navigate("/tickets")}
              >
                Create ticket
              </button>
              <button
                className={styles.quickAction}
                onClick={() => navigate("/nova")}
              >
                Ask Nova
              </button>
              <button
                className={styles.quickAction}
                onClick={() => navigate("/standup")}
              >
                Log standup
              </button>
              <button
                className={styles.quickAction}
                onClick={() => navigate("/wiki")}
              >
                Write wiki page
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
