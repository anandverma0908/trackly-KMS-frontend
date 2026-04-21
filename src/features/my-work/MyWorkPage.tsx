import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMyWork, fetchTicket } from "./useMyWork";
import CreateTicketDrawer from "@/features/tickets/CreateTicketDrawer";
import TodayStandup from "@/features/dashboard/widgets/TodayStandup";
import styles from "./MyWorkPage.module.css";

import {
  RiArrowRightLine,
  RiAlertLine,
  RiCheckLine,
  RiTimeLine,
  RiEyeLine,
  RiBarChartBoxLine,
  RiSparklingLine,
  RiFocus3Line,
  RiMessage2Line,
  RiSendPlaneLine,
  RiArrowUpLine,
  RiCloseLine,
  RiFlashlightLine,
  RiRocketLine,
  RiBookOpenLine,
  RiBrainLine,
  RiCalendarLine,
  RiLineChartLine,
  RiShieldLine,
  RiRobotLine,
  RiHeartLine,
} from "react-icons/ri";

import type { AITicket, Insight, FocusBlock, TimeEnergy, SprintRisk } from "./useMyWork";
import type { KnowledgeGap } from "@/types";

/* ═══════════════════════════════════════════════════════════
   MY WORK PAGE — AI-curated daily command center
   ═══════════════════════════════════════════════════════════ */

export default function MyWorkPage() {
  const {
    aiTickets,
    sprintRisk,
    insights,
    focusBlock,
    timeEnergy,
    morningBrief,
    knowledgeGaps,
    loading,
    loadingGaps,
  } = useMyWork();

  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const { data: selectedTicketData } = useQuery({
    queryKey: ["ticket", selectedKey],
    queryFn: () => fetchTicket(selectedKey!),
    enabled: !!selectedKey,
  });

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={`${styles.header} fade-up`}>
        <div>
          <h1 className={styles.title}>My Work</h1>
          <p className={styles.subtitle}>Nova-curated daily command center</p>
        </div>
        <span className={styles.aiBadge}>
          <RiSparklingLine size={12} />
          AI Ranked
        </span>
      </div>

      {/* ── Morning Brief ── */}
      <MorningBrief text={morningBrief} loading={loading} />

      {/* ── Nova Insight Feed ── */}
      <NovaInsightFeed insights={insights} loading={loading} onTicketClick={setSelectedKey} />

      {/* ── Smart Focus Block ── */}
      {focusBlock && <SmartFocusBlock block={focusBlock} onTicketClick={setSelectedKey} />}

      {/* ── Main content ── */}
      <div className={`${styles.mainRow} fade-up-2`}>
        {/* Left: AI Priority Queue */}
        <AIPriorityQueue tickets={aiTickets} loading={loading} onTicketClick={setSelectedKey} />

        {/* Right: Risk + Time */}
        <div className={styles.sideColumn}>
          <SprintRiskWidget risk={sprintRisk} loading={loading} />
          <TimeEnergyWidget energy={timeEnergy} loading={loading} />
        </div>
      </div>

      {/* ── Gen 2: Proactive Intelligence ── */}
      <Gen2ProactiveSection aiTickets={aiTickets} loading={loading} onTicketClick={setSelectedKey} />

      {/* ── Standup + Delivery Forecast ── */}
      <div className={`${styles.deliveryRow} fade-up-3`}>
        <TodayStandup />
        <NovaDeliveryForecast risk={sprintRisk} />
      </div>

      {/* ── Gen 3: Predictive Intelligence ── */}
      <Gen3PredictiveSection aiTickets={aiTickets} sprintRisk={sprintRisk} loading={loading} />

      {/* ── Knowledge Gaps ── */}
      {(loadingGaps || knowledgeGaps.length > 0) && (
        <NovaKnowledgeGaps gaps={knowledgeGaps} loading={loadingGaps} />
      )}

      {/* ── Autonomous Intelligence ── */}
      <div className={`${styles.gen4LiveGrid} fade-up-4`}>
        <AmbientAwarenessWidget aiTickets={aiTickets} />
        <AICopilotWidget aiTickets={aiTickets} />
        <CareerTrajectoryWidget aiTickets={aiTickets} loading={loading} />
        <WellbeingSignalsWidget aiTickets={aiTickets} loading={loading} />
      </div>

      {/* ── Ticket Detail Drawer ── */}
      {selectedKey && (
        <CreateTicketDrawer
          open
          onClose={() => setSelectedKey(null)}
          ticketKey={selectedKey}
          initialData={
            selectedTicketData
              ? {
                  title: selectedTicketData.summary,
                  description: (selectedTicketData as any).description ?? "",
                  issue_type: selectedTicketData.issue_type,
                  priority: selectedTicketData.priority,
                  status: selectedTicketData.status,
                  assignee: selectedTicketData.assignee,
                  reporter: (selectedTicketData as any).reporter ?? "",
                  pod: selectedTicketData.pod,
                  client: selectedTicketData.client,
                  story_points: selectedTicketData.story_points,
                  labels: selectedTicketData.labels,
                  due_date: selectedTicketData.due_date,
                  originalEst: selectedTicketData.original_estimate_hours
                    ? String(selectedTicketData.original_estimate_hours)
                    : "",
                  timeSpent: selectedTicketData.hours_spent
                    ? String(selectedTicketData.hours_spent)
                    : "",
                  remaining: selectedTicketData.remaining_estimate_hours
                    ? String(selectedTicketData.remaining_estimate_hours)
                    : "",
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

/* ── Morning Brief ───────────────────────────────────────── */
function MorningBrief({ text, loading }: { text: string; loading: boolean }) {
  const [displayed, setDisplayed] = useState("");
  const idxRef = useRef(0);

  useEffect(() => {
    if (!text || loading) return;
    idxRef.current = 0;
    setDisplayed("");
    const interval = setInterval(() => {
      idxRef.current += 1;
      setDisplayed(text.slice(0, idxRef.current));
      if (idxRef.current >= text.length) clearInterval(interval);
    }, 18);
    return () => clearInterval(interval);
  }, [text, loading]);

  if (loading) {
    return (
      <div className={`${styles.briefCard} ${styles.briefLoading}`}>
        <RiSparklingLine size={16} className={styles.briefIcon} />
        <span className={styles.briefText}>Nova is analyzing your work…</span>
      </div>
    );
  }

  return (
    <div className={`${styles.briefCard} fade-up`}>
      <RiSparklingLine size={16} className={styles.briefIcon} />
      <span className={styles.briefText}>
        {displayed}
        <span className={styles.briefCursor}>|</span>
      </span>
    </div>
  );
}

/* ── Nova Insight Feed ───────────────────────────────────── */
function NovaInsightFeed({
  insights,
  loading,
  onTicketClick,
}: {
  insights: Insight[];
  loading: boolean;
  onTicketClick: (key: string) => void;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  if (loading) {
    return (
      <div className={`${styles.insightCard} fade-up-1`}>
        <div className={styles.insightHeader}>
          <RiSparklingLine size={14} />
          <span>Nova Insights</span>
        </div>
        <div className={styles.insightSkeleton}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.insightSkeletonRow} />
          ))}
        </div>
      </div>
    );
  }

  const visible = insights.filter((i) => !dismissed.has(i.id));
  if (visible.length === 0) return null;

  return (
    <div className={`${styles.insightCard} fade-up-1`}>
      <div className={styles.insightHeader}>
        <RiSparklingLine size={14} />
        <span>Nova Insights</span>
        <span className={styles.insightCount}>{visible.length} new</span>
      </div>
      <div className={styles.insightList}>
        {visible.map((insight) => (
          <div
            key={insight.id}
            className={`${styles.insightItem} ${styles[`insight${insight.severity}`]}`}
          >
            <div className={styles.insightDot} />
            <div className={styles.insightBody}>
              <div className={styles.insightTop}>
                <span className={styles.insightTitle}>{insight.title}</span>
                {insight.severity === "critical" && (
                  <span className={styles.insightTagCritical}>Critical</span>
                )}
                {insight.severity === "warning" && (
                  <span className={styles.insightTagWarning}>Warning</span>
                )}
              </div>
              <p className={styles.insightMessage}>{insight.message}</p>
              <div className={styles.insightActions}>
                {insight.actionLabel && (
                  <button
                    className={styles.insightActionBtn}
                    onClick={() =>
                      insight.actionTarget
                        ? onTicketClick(insight.actionTarget)
                        : undefined
                    }
                  >
                    {insight.actionLabel}
                  </button>
                )}
              </div>
            </div>
            <button
              className={styles.insightDismiss}
              onClick={() =>
                setDismissed((prev) => new Set([...prev, insight.id]))
              }
              title="Dismiss"
            >
              <RiCloseLine size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Smart Focus Block ───────────────────────────────────── */
function SmartFocusBlock({
  block,
  onTicketClick,
}: {
  block: FocusBlock;
  onTicketClick: (key: string) => void;
}) {
  if (!block.recommendedTicket) return null;
  const t = block.recommendedTicket;
  const hrs = Math.floor(block.availableMinutes / 60);
  const mins = block.availableMinutes % 60;

  return (
    <div className={`${styles.focusCard} fade-up-1`}>
      <div className={styles.focusLeft}>
        <div className={styles.focusHeader}>
          <RiFocus3Line size={16} color="var(--accent)" />
          <span>Smart Focus Block</span>
        </div>
        <p className={styles.focusMessage}>{block.message}</p>
        <p className={styles.focusSub}>{block.submessage}</p>
      </div>
      <div className={styles.focusRight}>
        <div className={styles.focusTicket}>
          <span className={styles.focusKey}>{t.key}</span>
          <span className={styles.focusSummary}>{t.summary}</span>
        </div>
        <div className={styles.focusActions}>
          <button
            className={styles.focusBtnPrimary}
            onClick={() => onTicketClick(t.key)}
          >
            <RiFlashlightLine size={14} />
            Start Focus
          </button>
          <span className={styles.focusTime}>
            <RiTimeLine size={12} />
            {hrs}h {mins}m available
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── AI Priority Queue ───────────────────────────────────── */
function AIPriorityQueue({
  tickets,
  loading,
  onTicketClick,
}: {
  tickets: AITicket[];
  loading: boolean;
  onTicketClick: (key: string) => void;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  function toggleExpand(key: string) {
    setExpandedKey((k) => (k === key ? null : key));
  }

  if (loading) {
    return (
      <div className={styles.queueCard}>
        <div className={styles.queueHeader}>
          <RiSparklingLine size={16} />
          <span>AI Priority Queue</span>
        </div>
        <div className={styles.queueSkeleton}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={styles.queueSkeletonRow} />
          ))}
        </div>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className={styles.queueCard}>
        <div className={styles.queueHeader}>
          <RiSparklingLine size={16} />
          <span>AI Priority Queue</span>
        </div>
        <div className={styles.queueEmpty}>
          <RiCheckLine size={32} color="var(--green)" />
          <span>All clear — no open tickets!</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.queueCard}>
      <div className={styles.queueHeader}>
        <RiSparklingLine size={16} />
        <span>AI Priority Queue</span>
        <span className={styles.queueCount}>{tickets.length} tickets</span>
      </div>
      <div className={styles.queueList}>
        {tickets.map((t) => {
          const isExpanded = expandedKey === t.key;
          return (
            <div
              key={t.key}
              className={`${styles.queueItem} ${isExpanded ? styles.queueItemExpanded : ""} ${styles[`queueUrgency${t.aiUrgency}`]}`}
            >
              {/* Collapsed row */}
              <button
                className={styles.queueRow}
                onClick={() => toggleExpand(t.key)}
              >
                <span
                  className={styles.queueRank}
                  style={{
                    color:
                      t.aiUrgency === "critical"
                        ? "var(--red)"
                        : t.aiUrgency === "high"
                          ? "var(--amber)"
                          : "var(--text-3)",
                  }}
                >
                  #{t.aiRank}
                </span>
                <div className={styles.queueBody}>
                  <div className={styles.queueTop}>
                    <span className={styles.queueKey}>{t.key}</span>
                    <QueueStatusBadge status={t.status} />
                    {t.deadlineRisk && (
                      <span className={styles.queueRiskBadge}>{t.deadlineRisk}</span>
                    )}
                    {t.priority && (
                      <span
                        className={styles.queuePriority}
                        style={{
                          color:
                            t.priority === "Highest" || t.priority === "High"
                              ? "var(--red)"
                              : "var(--text-3)",
                        }}
                      >
                        {t.priority === "Highest"
                          ? "⬆⬆"
                          : t.priority === "High"
                            ? "⬆"
                            : t.priority === "Medium"
                              ? "▶"
                              : "⬇"}
                      </span>
                    )}
                  </div>
                  <span className={styles.queueSummary}>{t.summary}</span>
                  <span className={styles.queueReason}>{t.aiReason}</span>
                </div>
                <RiArrowRightLine
                  size={14}
                  className={`${styles.queueArrow} ${isExpanded ? styles.queueArrowOpen : ""}`}
                />
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className={styles.queueDetail}>
                  <div className={styles.detailSection}>
                    <span className={styles.detailLabel}>Nova Analysis</span>
                    <p className={styles.detailText}>
                      Ranked #{t.aiRank} because: {t.aiReason}.
                      {t.blockingCount > 0 &&
                        ` This ticket is blocking ${t.blockingCount} other ticket${t.blockingCount > 1 ? "s" : ""}.`}
                      {t.daysInStatus > 3 &&
                        ` It has been in ${t.status} for ${t.daysInStatus} days.`}
                      {t.sprintName &&
                        ` Part of active sprint: ${t.sprintName}.`}
                    </p>
                  </div>

                  <div className={styles.detailMetaRow}>
                    {t.original_estimate_hours > 0 && (
                      <div className={styles.detailMeta}>
                        <span className={styles.detailMetaLabel}>Est.</span>
                        <span className={styles.detailMetaVal}>
                          {t.original_estimate_hours}h
                        </span>
                      </div>
                    )}
                    {t.hours_spent > 0 && (
                      <div className={styles.detailMeta}>
                        <span className={styles.detailMetaLabel}>Logged</span>
                        <span
                          className={styles.detailMetaVal}
                          style={{
                            color:
                              t.hours_spent > (t.original_estimate_hours || 0) * 1.3
                                ? "var(--amber)"
                                : "var(--green)",
                          }}
                        >
                          {t.hours_spent.toFixed(1)}h
                        </span>
                      </div>
                    )}
                    {t.story_points !== undefined && (
                      <div className={styles.detailMeta}>
                        <span className={styles.detailMetaLabel}>Points</span>
                        <span className={styles.detailMetaVal}>{t.story_points}</span>
                      </div>
                    )}
                    {t.due_date && (
                      <div className={styles.detailMeta}>
                        <span className={styles.detailMetaLabel}>Due</span>
                        <span
                          className={styles.detailMetaVal}
                          style={{
                            color:
                              new Date(t.due_date) < new Date()
                                ? "var(--red)"
                                : "var(--text-2)",
                          }}
                        >
                          {t.due_date}
                        </span>
                      </div>
                    )}
                    {t.client && (
                      <div className={styles.detailMeta}>
                        <span className={styles.detailMetaLabel}>Client</span>
                        <span className={styles.detailMetaVal}>{t.client}</span>
                      </div>
                    )}
                    {t.pod && (
                      <div className={styles.detailMeta}>
                        <span className={styles.detailMetaLabel}>POD</span>
                        <span className={styles.detailMetaVal}>{t.pod}</span>
                      </div>
                    )}
                  </div>

                  {t.blockedBy && (
                    <div className={styles.detailAlert}>
                      <RiAlertLine size={12} color="var(--red)" />
                      <span>Blocked by {t.blockedBy}</span>
                    </div>
                  )}

                  {/* Quick Actions */}
                  {t.quickActions.length > 0 && (
                    <div className={styles.quickActions}>
                      <span className={styles.quickActionsLabel}>Quick Actions</span>
                      <div className={styles.quickActionsRow}>
                        {t.quickActions.map((qa) => (
                          <button
                            key={qa.id}
                            className={styles.quickActionBtn}
                            onClick={() => {
                              if (qa.id === "open") onTicketClick(t.key);
                            }}
                          >
                            <QuickActionIcon icon={qa.icon} />
                            {qa.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuickActionIcon({ icon }: { icon: string }) {
  switch (icon) {
    case "ping": return <RiSendPlaneLine size={12} />;
    case "log": return <RiTimeLine size={12} />;
    case "draft": return <RiMessage2Line size={12} />;
    case "move": return <RiArrowRightLine size={12} />;
    case "review": return <RiEyeLine size={12} />;
    case "escalate": return <RiArrowUpLine size={12} />;
    default: return <RiFlashlightLine size={12} />;
  }
}

/* ── Nova Delivery Forecast ──────────────────────────────── */
function NovaDeliveryForecast({ risk }: { risk: SprintRisk | null }) {
  if (!risk) {
    return (
      <div className={styles.forecastCard}>
        <div className={styles.forecastHeader}>
          <RiRocketLine size={14} />
          <span>Delivery Forecast</span>
        </div>
        <p className={styles.forecastEmpty}>No active sprint — start one to see your forecast.</p>
      </div>
    );
  }

  const totalDays = 14;
  const daysElapsed = Math.max(1, totalDays - risk.daysLeft);
  const pace = risk.completed / daysElapsed;
  const neededDays = pace > 0 ? risk.remaining / pace : Infinity;
  const buffer = risk.daysLeft - neededDays;

  const pctDone = risk.committed > 0 ? Math.min(100, (risk.completed / risk.committed) * 100) : 0;

  const forecastColor =
    buffer >= 2 ? "var(--green)" : buffer >= 0 ? "var(--amber)" : "var(--red)";
  const forecastLabel = buffer >= 2 ? "On Track" : buffer >= 0 ? "Tight" : "At Risk";

  let forecastText: string;
  if (pace === 0) {
    forecastText = "No points burned yet. Log time to calibrate your forecast.";
  } else if (buffer >= 2) {
    forecastText = `At ${pace.toFixed(1)} pts/day, you'll finish ~${Math.ceil(neededDays)}d before sprint end. Solid pace.`;
  } else if (buffer >= 0) {
    forecastText = `At ${pace.toFixed(1)} pts/day, you'll just make it. Stay focused on top-ranked tickets.`;
  } else {
    const shortfall = Math.ceil(risk.remaining - pace * risk.daysLeft);
    forecastText = `At current pace, ${Math.abs(Math.ceil(buffer))}d short. Consider de-scoping ~${shortfall} pts.`;
  }

  return (
    <div className={styles.forecastCard}>
      <div className={styles.forecastHeader}>
        <RiRocketLine size={14} />
        <span>Delivery Forecast</span>
        <span className={styles.forecastLabel} style={{ color: forecastColor }}>
          {forecastLabel}
        </span>
      </div>

      <div className={styles.forecastBarTrack}>
        <div
          className={styles.forecastBarFill}
          style={{ width: `${pctDone}%`, background: forecastColor }}
        />
      </div>
      <div className={styles.forecastBarMeta}>
        <span>{risk.completed} pts done</span>
        <span>{risk.remaining} pts left</span>
      </div>

      <div className={styles.forecastStats}>
        <div className={styles.forecastStat}>
          <span className={styles.forecastStatVal}>{pace > 0 ? pace.toFixed(1) : "—"}</span>
          <span className={styles.forecastStatLbl}>pts/day</span>
        </div>
        <div className={styles.forecastStat}>
          <span className={styles.forecastStatVal}>{risk.daysLeft}d</span>
          <span className={styles.forecastStatLbl}>remaining</span>
        </div>
        <div className={styles.forecastStat}>
          <span className={styles.forecastStatVal} style={{ color: forecastColor }}>
            {pace > 0
              ? buffer >= 0
                ? `+${Math.ceil(buffer)}d`
                : `${Math.ceil(buffer)}d`
              : "—"}
          </span>
          <span className={styles.forecastStatLbl}>buffer</span>
        </div>
      </div>

      <p className={styles.forecastText} style={{ color: forecastColor }}>
        {forecastText}
      </p>
    </div>
  );
}

/* ── Nova Knowledge Gaps ─────────────────────────────────── */
function getGapAction(topic: string, count: number): string {
  const t = topic.toLowerCase();
  if (t.includes("auth") || t.includes("security")) return "Review security runbook + schedule training session";
  if (t.includes("test") || t.includes("qa")) return "Write test patterns wiki for the team";
  if (t.includes("perf") || t.includes("optim")) return "Pair with infra team on a profiling session";
  if (t.includes("api") || t.includes("integr")) return "Document integration patterns in the wiki";
  if (t.includes("deploy") || t.includes("infra")) return "Schedule infra knowledge transfer with the team";
  if (count >= 5) return `High frequency — create a runbook for "${topic}"`;
  if (count >= 3) return `Recurring pattern — schedule pair programming on this`;
  return `Capture learnings in the wiki under "${topic}"`;
}

function NovaKnowledgeGaps({
  gaps,
  loading,
}: {
  gaps: KnowledgeGap[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className={`${styles.kgCard} fade-up-4`}>
        <div className={styles.kgHeader}>
          <RiBookOpenLine size={14} />
          <span>Knowledge Gaps</span>
        </div>
        <div className={styles.kgSkeleton}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.kgSkeletonRow} />
          ))}
        </div>
      </div>
    );
  }

  const sorted = [...gaps].sort((a, b) => b.ticket_count - a.ticket_count).slice(0, 5);

  return (
    <div className={`${styles.kgCard} fade-up-4`}>
      <div className={styles.kgHeader}>
        <RiBookOpenLine size={14} />
        <span>Knowledge Gaps</span>
        <span className={styles.kgCount}>{sorted.length} detected by Nova</span>
      </div>
      <div className={styles.kgGrid}>
        {sorted.map((gap) => {
          const severity =
            gap.ticket_count >= 5 ? "high" : gap.ticket_count >= 2 ? "medium" : "low";
          const action = getGapAction(gap.topic, gap.ticket_count);
          const sevColor =
            severity === "high"
              ? "var(--red)"
              : severity === "medium"
                ? "var(--amber)"
                : "var(--text-3)";
          return (
            <div key={gap.id} className={styles.kgItem}>
              <div className={styles.kgItemTop}>
                <span className={styles.kgTopic}>{gap.topic}</span>
                <span className={styles.kgTicketCount} style={{ color: sevColor }}>
                  {gap.ticket_count} tickets
                </span>
              </div>
              <p className={styles.kgDesc}>{gap.description}</p>
              <div className={styles.kgAction}>
                <RiSparklingLine size={10} />
                <span>{action}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   GEN 2 — PROACTIVE  (2027–2028)
   ══════════════════════════════════════════════════════════════ */

interface BlockerPred { key: string; reason: string; hoursUntilBlock: number; }

const MOCK_BLOCKER_PREDS: BlockerPred[] = [
  { key: "AUTH-221", reason: "Design hasn't responded to the pending Figma comment in 36h", hoursUntilBlock: 48 },
  { key: "UI-045", reason: "Awaiting product sign-off on scope change — 3rd request sent", hoursUntilBlock: 8 },
];

const MOCK_VELOCITY_DATA = {
  bestDays: ["Tuesday", "Wednesday"],
  boostPct: 28,
  peakWindow: "9–11am",
  calendarConflicts: 3,
  heatmap: [
    [2, 8, 7, 5, 1],
    [3, 9, 8, 8, 2],
    [3, 9, 7, 8, 1],
    [2, 7, 6, 6, 2],
    [1, 6, 5, 4, 0],
  ],
};

function Gen2ProactiveSection({
  aiTickets,
  loading,
  onTicketClick,
}: {
  aiTickets: AITicket[];
  loading: boolean;
  onTicketClick: (key: string) => void;
}) {
  const wip = aiTickets.filter((t) => t.status === "In Progress").length;
  const contextSwitches = Math.max(wip, 1);
  const weeklyAvg = Math.max(1, Math.floor(contextSwitches / 2));

  const realPreds: BlockerPred[] = aiTickets
    .filter((t) => !t.status.toLowerCase().includes("block") && t.daysInStatus > 1)
    .slice(0, 2)
    .map((t, i) => ({
      key: t.key,
      reason: t.daysInStatus > 3
        ? `No status update for ${t.daysInStatus} days — external dependency at risk`
        : i === 0 ? "Awaiting review — comment unanswered for 2d" : "Dependency stalled",
      hoursUntilBlock: i === 0 ? 48 : 16,
    }));
  const predictions = realPreds.length >= 2 ? realPreds : MOCK_BLOCKER_PREDS;

  return (
    <div className={`${styles.genSection} fade-up-2`}>
      <div className={styles.gen2Grid}>
        <FlowStateCard
          contextSwitches={contextSwitches}
          weeklyAvg={weeklyAvg}
          topTickets={aiTickets.slice(0, 2)}
          onTicketClick={onTicketClick}
          loading={loading}
        />
        <VelocityPatternCard />
        <BlockerPredictionCard predictions={predictions} onTicketClick={onTicketClick} loading={loading} />
      </div>
    </div>
  );
}

function FlowStateCard({
  contextSwitches,
  weeklyAvg,
  topTickets,
  onTicketClick,
  loading,
}: {
  contextSwitches: number;
  weeklyAvg: number;
  topTickets: AITicket[];
  onTicketClick: (key: string) => void;
  loading: boolean;
}) {
  const ratio = weeklyAvg > 0 ? (contextSwitches / weeklyAvg).toFixed(1) : "1.0";
  const isHigh = contextSwitches > 3;

  return (
    <div className={`${styles.proactiveCard} ${isHigh ? styles.proactiveCardAlert : ""}`}>
      <div className={styles.proactiveHeader}>
        <RiShieldLine size={14} color={isHigh ? "var(--amber)" : "var(--accent)"} />
        <span>Flow State Protection</span>
      </div>
      {loading ? (
        <div className={styles.proactiveSkeleton} />
      ) : (
        <>
          <p className={styles.proactiveMessage}>
            You've had{" "}
            <strong style={{ color: isHigh ? "var(--amber)" : "var(--text)" }}>
              {contextSwitches} context switches
            </strong>{" "}
            today — that's{" "}
            <strong style={{ color: isHigh ? "var(--amber)" : "var(--text)" }}>{ratio}×</strong>{" "}
            your weekly average.
          </p>
          {isHigh && topTickets.length > 0 ? (
            <div className={styles.proactiveFocusList}>
              <span className={styles.proactiveFocusLabel}>Focus on these 2:</span>
              {topTickets.slice(0, 2).map((t) => (
                <button key={t.key} className={styles.proactiveFocusItem} onClick={() => onTicketClick(t.key)}>
                  <span className={styles.proactiveFocusKey}>{t.key}</span>
                  <span className={styles.proactiveFocusSummary}>{t.summary}</span>
                  <RiArrowRightLine size={12} />
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.proactiveGood}>
              Focus is healthy — {contextSwitches} active stream{contextSwitches !== 1 ? "s" : ""}, within your norm.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function VelocityPatternCard() {
  const { bestDays, boostPct, peakWindow, calendarConflicts, heatmap } = MOCK_VELOCITY_DATA;
  const days = ["M", "T", "W", "T", "F"];

  return (
    <div className={styles.proactiveCard}>
      <div className={styles.proactiveHeader}>
        <RiLineChartLine size={14} color="var(--accent)" />
        <span>Velocity Patterns</span>
      </div>
      <p className={styles.proactiveMessage}>
        You complete{" "}
        <strong style={{ color: "var(--green)" }}>{boostPct}% more tickets</strong> on{" "}
        <strong>{bestDays.join(" & ")}</strong> during <strong>{peakWindow}</strong>.
      </p>
      <div className={styles.velocityHeatmap}>
        {days.map((d, di) => (
          <div key={d + di} className={styles.heatmapCol}>
            {heatmap[di].map((v, si) => (
              <div
                key={si}
                className={styles.heatmapCell}
                style={{
                  background:
                    v >= 8 ? "rgba(79,207,140,0.75)"
                    : v >= 6 ? "rgba(79,126,255,0.55)"
                    : v >= 3 ? "rgba(251,191,36,0.35)"
                    : "var(--surface-3)",
                }}
              />
            ))}
            <span className={styles.heatmapDayLabel}>{d}</span>
          </div>
        ))}
      </div>
      {calendarConflicts > 0 && (
        <div className={styles.proactiveWarning}>
          <RiCalendarLine size={12} />
          <span>{calendarConflicts} meetings conflict with your peak window this week</span>
          <button className={styles.proactiveActionLink}>Reschedule?</button>
        </div>
      )}
    </div>
  );
}

function BlockerPredictionCard({
  predictions,
  onTicketClick,
  loading,
}: {
  predictions: BlockerPred[];
  onTicketClick: (key: string) => void;
  loading: boolean;
}) {
  return (
    <div className={styles.proactiveCard}>
      <div className={styles.proactiveHeader}>
        <RiAlertLine size={14} color="var(--amber)" />
        <span>Blocker Prediction</span>
      </div>
      {loading ? (
        <div className={styles.proactiveSkeleton} />
      ) : predictions.length === 0 ? (
        <p className={styles.proactiveGood}>No blocker risks detected in your queue.</p>
      ) : (
        <div className={styles.predictionList}>
          {predictions.map((p) => {
            const urgencyColor =
              p.hoursUntilBlock <= 12 ? "var(--red)"
              : p.hoursUntilBlock <= 24 ? "var(--amber)"
              : "var(--text-3)";
            return (
              <div key={p.key} className={styles.predictionItem}>
                <div className={styles.predictionTop}>
                  <span className={styles.predictionKey}>{p.key}</span>
                  <span className={styles.predictionHours} style={{ color: urgencyColor }}>
                    ~{p.hoursUntilBlock}h until blocked
                  </span>
                </div>
                <p className={styles.predictionReason}>{p.reason}</p>
                <button className={styles.predictionCta} onClick={() => onTicketClick(p.key)}>
                  <RiSendPlaneLine size={11} />
                  Follow up now
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   GEN 3 — PREDICTIVE  (2029–2031)
   ══════════════════════════════════════════════════════════════ */

const MOCK_COGNITIVE = {
  meetings: 2,
  unresolved: 5,
  recommendation: "Defer AUTH-309 — highest cognitive cost, lowest urgency today",
};

const MOCK_COMPLETION_PREDS = [
  { key: "AUTH-221", predictedBy: "Thursday", daysAway: 2, sprintEnd: "Friday", onTrack: true },
  { key: "UI-045", predictedBy: "Monday", daysAway: 6, sprintEnd: "Friday", onTrack: false },
  { key: "INFRA-089", predictedBy: "Wednesday", daysAway: 1, sprintEnd: "Friday", onTrack: true },
];

function Gen3PredictiveSection({
  aiTickets,
  sprintRisk,
  loading,
}: {
  aiTickets: AITicket[];
  sprintRisk: SprintRisk | null;
  loading: boolean;
}) {
  return (
    <div className={`${styles.genSection} fade-up-3`}>
      <div className={styles.gen3Grid}>
        <CognitiveLoadCard aiTickets={aiTickets} loading={loading} />
        <FocusWindowCard />
        <CompletionPredictionCard aiTickets={aiTickets} sprintRisk={sprintRisk} loading={loading} />
      </div>
    </div>
  );
}

function CognitiveLoadCard({
  aiTickets,
  loading,
}: {
  aiTickets: AITicket[];
  loading: boolean;
}) {
  const wip = aiTickets.filter((t) => t.status === "In Progress").length;
  const blocked = aiTickets.filter((t) => t.status.toLowerCase().includes("block")).length;
  const score = Math.min(100, Math.round(
    MOCK_COGNITIVE.meetings * 8 + wip * 12 + blocked * 15 + MOCK_COGNITIVE.unresolved * 4 + 15
  ));
  const scoreColor = score >= 80 ? "var(--red)" : score >= 60 ? "var(--amber)" : "var(--green)";
  const scoreLabel = score >= 80 ? "Overloaded" : score >= 60 ? "Elevated" : "Balanced";
  const circumference = 2 * Math.PI * 28;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className={styles.predictiveCard}>
      <div className={styles.predictiveHeader}>
        <RiBrainLine size={14} color="#a78bfa" />
        <span>Cognitive Load</span>
      </div>
      {loading ? (
        <div className={styles.proactiveSkeleton} />
      ) : (
        <>
          <div className={styles.cogLoadBody}>
            <div className={styles.cogGaugeWrap}>
              <svg width="56" height="56" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="24" fill="none" stroke="var(--surface-3)" strokeWidth="4" />
                <circle
                  cx="28" cy="28" r="24" fill="none" stroke={scoreColor}
                  strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={circumference} strokeDashoffset={offset}
                  transform="rotate(-90 28 28)"
                  style={{ transition: "stroke-dashoffset 1s ease" }}
                />
              </svg>
              <span className={styles.cogScore} style={{ color: scoreColor }}>{score}</span>
            </div>
            <div className={styles.cogMeta}>
              <span className={styles.cogLabel} style={{ color: scoreColor }}>{scoreLabel}</span>
              <div className={styles.cogBreakdown}>
                <div className={styles.cogItem}><span className={styles.cogItemLbl}>WIP</span><span className={styles.cogItemVal}>{wip}</span></div>
                <div className={styles.cogItem}><span className={styles.cogItemLbl}>Blocked</span><span className={styles.cogItemVal} style={{ color: blocked > 0 ? "var(--red)" : undefined }}>{blocked}</span></div>
                <div className={styles.cogItem}><span className={styles.cogItemLbl}>Meetings</span><span className={styles.cogItemVal}>{MOCK_COGNITIVE.meetings}</span></div>
                <div className={styles.cogItem}><span className={styles.cogItemLbl}>Unresolved</span><span className={styles.cogItemVal}>{MOCK_COGNITIVE.unresolved}</span></div>
              </div>
            </div>
          </div>
          <p className={styles.predictiveRec}>
            <RiSparklingLine size={10} />
            {MOCK_COGNITIVE.recommendation}
          </p>
        </>
      )}
    </div>
  );
}

function FocusWindowCard() {
  const timeSlots = ["6am", "9am", "12pm", "3pm", "6pm", "9pm"];
  const peakSlotIndices = [1, 2];
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];

  return (
    <div className={styles.predictiveCard}>
      <div className={styles.predictiveHeader}>
        <RiCalendarLine size={14} color="#a78bfa" />
        <span>Focus Windows</span>
      </div>
      <p className={styles.predictiveMessage}>
        Your deepest focus work happens{" "}
        <strong style={{ color: "#a78bfa" }}>9–11am weekdays</strong>.
      </p>
      <div className={styles.focusWindowGrid}>
        {days.map((day, di) => (
          <div key={day} className={styles.focusWindowCol}>
            {timeSlots.map((_slot, si) => {
              const isPeak = peakSlotIndices.includes(si);
              const isReserved = isPeak && di === 1;
              return (
                <div
                  key={si}
                  className={`${styles.focusWindowCell} ${isPeak ? styles.focusWindowPeak : ""} ${isReserved ? styles.focusWindowReserved : ""}`}
                />
              );
            })}
            <span className={styles.focusWindowLabel}>{day[0]}</span>
          </div>
        ))}
      </div>
      <div className={styles.predictiveCallout}>
        <RiSparklingLine size={11} />
        <span>Tomorrow morning is clear — EOS reserved <strong>9–11am</strong> for AUTH-221</span>
      </div>
    </div>
  );
}

function CompletionPredictionCard({
  aiTickets,
  sprintRisk,
  loading,
}: {
  aiTickets: AITicket[];
  sprintRisk: SprintRisk | null;
  loading: boolean;
}) {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const topTickets = aiTickets.slice(0, 3);
  const preds = topTickets.length >= 2
    ? topTickets.map((t) => {
        const est = t.remaining_estimate_hours || t.original_estimate_hours || 4;
        const daysAway = Math.ceil(est / 2.5);
        const future = new Date();
        future.setDate(future.getDate() + daysAway);
        return {
          key: t.key,
          predictedBy: days[future.getDay()],
          daysAway,
          sprintEnd: sprintRisk ? `${sprintRisk.daysLeft}d left` : "Friday",
          onTrack: daysAway <= (sprintRisk?.daysLeft ?? 5),
        };
      })
    : MOCK_COMPLETION_PREDS;

  return (
    <div className={styles.predictiveCard}>
      <div className={styles.predictiveHeader}>
        <RiRocketLine size={14} color="#a78bfa" />
        <span>Completion Prediction</span>
      </div>
      {loading ? (
        <div className={styles.proactiveSkeleton} />
      ) : (
        <div className={styles.completionList}>
          {preds.map((p) => (
            <div key={p.key} className={styles.completionItem}>
              <div className={styles.completionTop}>
                <span className={styles.completionKey}>{p.key}</span>
                <span className={styles.completionStatus} style={{ color: p.onTrack ? "var(--green)" : "var(--amber)" }}>
                  {p.onTrack ? "On track" : "At risk"}
                </span>
              </div>
              <div className={styles.completionRow}>
                <span className={styles.completionBy}>
                  Done by{" "}
                  <strong style={{ color: p.onTrack ? "var(--green)" : "var(--amber)" }}>{p.predictedBy}</strong>
                </span>
                <span className={styles.completionSprint}>Sprint: {p.sprintEnd}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   AMBIENT WORK AWARENESS
   ══════════════════════════════════════════════════════════════ */

const AMBIENT_FEED = [
  { id: "a1", time: "2m ago",  icon: "infer",   text: "Inferred 65% complete on AUTH-221 — based on file activity and time spent" },
  { id: "a2", time: "18m ago", icon: "update",  text: "Progress estimate updated: UI-045 moved from 40% → 70% complete" },
  { id: "a3", time: "1h ago",  icon: "detect",  text: "Context switch detected — returned to AUTH-221 after 22min on INFRA-089" },
  { id: "a4", time: "2h ago",  icon: "log",     text: "Auto-logged 1.5h to AUTH-221 — no manual entry needed" },
  { id: "a5", time: "3h ago",  icon: "meeting", text: "Standup detected via calendar — paused time tracking for 28 minutes" },
];

function AmbientAwarenessWidget({ aiTickets }: { aiTickets: AITicket[] }) {
  const topKey = aiTickets[0]?.key ?? "AUTH-221";
  const feed = AMBIENT_FEED.map((f, i) =>
    i === 0 ? { ...f, text: f.text.replace("AUTH-221", topKey) } : f
  );

  return (
    <div className={styles.ambientCard}>
      <div className={styles.ambientHeader}>
        <div className={styles.ambientPulse} />
        <RiEyeLine size={14} color="var(--accent)" />
        <span>Ambient Work Awareness</span>
        <span className={styles.ambientLive}>Live</span>
      </div>
      <p className={styles.ambientSubtitle}>EOS is watching — no logging needed</p>
      <div className={styles.ambientFeed}>
        {feed.map((item) => (
          <div key={item.id} className={styles.ambientItem}>
            <div className={`${styles.ambientDot} ${styles[`ambientDot_${item.icon}`]}`} />
            <div className={styles.ambientItemBody}>
              <span className={styles.ambientItemText}>{item.text}</span>
              <span className={styles.ambientItemTime}>{item.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   PERSONAL AI COPILOT
   ══════════════════════════════════════════════════════════════ */

const COPILOT_SUGGESTIONS = [
  "Move low-priority tickets to next sprint",
  "Draft a status update for the client",
  "Reschedule tomorrow's standup",
  "Summarise my week for the team",
];

const COPILOT_RESPONSES: Record<string, string> = {
  "Move low-priority tickets to next sprint":
    "Done. 3 low-priority tickets (UI-040, UI-041, INFRA-085) moved to Sprint 12. Sprint 11 scope is now 26 pts — well within capacity.",
  "Draft a status update for the client":
    "Here's a draft:\n\n\"Hi team — quick update: AUTH-221 is 65% complete and on track for Thursday. UI-045 slipped by 1 day due to a design review delay, but we're back on track. No blockers at this time.\"",
  "Reschedule tomorrow's standup":
    "Standup moved from 9:00am → 10:30am tomorrow. Calendar invite updated. Sarah and Dev notified.",
  "Summarise my week for the team":
    "This week: closed 4 tickets (18 pts), unblocked AUTH-221, reviewed 2 PRs, and flagged 1 scope risk on INFRA-089. Velocity: 4.5 pts/day — 12% above your average.",
};

function AICopilotWidget({ aiTickets }: { aiTickets: AITicket[] }) {
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [history, setHistory] = useState<{ cmd: string; reply: string }[]>([]);

  function submit(cmd: string) {
    if (!cmd.trim() || thinking) return;
    setThinking(true);
    const normalised = cmd.trim();
    setTimeout(() => {
      const reply =
        COPILOT_RESPONSES[normalised] ??
        `Got it — "${normalised}". Processing your request across ${aiTickets.length} open tickets…`;
      setHistory((h) => [{ cmd: normalised, reply }, ...h].slice(0, 3));
      setThinking(false);
      setInput("");
    }, 900);
  }

  return (
    <div className={styles.copilotCard}>
      <div className={styles.copilotHeader}>
        <RiRobotLine size={14} color="var(--accent)" />
        <span>Personal AI Copilot</span>
      </div>

      {history.length > 0 && (
        <div className={styles.copilotHistory}>
          {history.map((h, i) => (
            <div key={i} className={styles.copilotHistoryItem}>
              <div className={styles.copilotUserLine}>
                <span className={styles.copilotUserBubble}>{h.cmd}</span>
              </div>
              <div className={styles.copilotReplyLine}>
                <RiSparklingLine size={10} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
                <p className={styles.copilotReplyText}>{h.reply}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {thinking && (
        <div className={styles.copilotThinking}>
          <span className={styles.copilotThinkingDot} />
          <span className={styles.copilotThinkingDot} />
          <span className={styles.copilotThinkingDot} />
        </div>
      )}

      {history.length === 0 && !thinking && (
        <div className={styles.copilotChips}>
          {COPILOT_SUGGESTIONS.map((s) => (
            <button key={s} className={styles.copilotChip} onClick={() => submit(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div className={styles.copilotInputRow}>
        <input
          className={styles.copilotInput}
          placeholder="Ask EOS anything…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit(input)}
        />
        <button className={styles.copilotSendBtn} onClick={() => submit(input)} disabled={!input.trim() || thinking}>
          <RiSendPlaneLine size={14} />
        </button>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   CAREER TRAJECTORY
   ══════════════════════════════════════════════════════════════ */

const SKILL_DOMAINS = [
  { domain: "Frontend",       tickets: 23, max: 30, color: "var(--accent)" },
  { domain: "Authentication", tickets: 8,  max: 30, color: "var(--green)" },
  { domain: "Testing / QA",   tickets: 5,  max: 30, color: "var(--amber)" },
  { domain: "API / Backend",  tickets: 3,  max: 30, color: "var(--accent)" },
  { domain: "Infrastructure", tickets: 0,  max: 30, color: "var(--red)" },
];

const CAREER_RECS = [
  { label: "SSO Architecture wiki", reason: "covers the infra work your team owns next quarter" },
  { label: "Kubernetes basics runbook", reason: "gap in your infra knowledge detected" },
];

function CareerTrajectoryWidget({ aiTickets, loading }: { aiTickets: AITicket[]; loading: boolean }) {
  const dominated = aiTickets.reduce<Record<string, number>>((acc, t) => {
    acc[t.issue_type] = (acc[t.issue_type] || 0) + 1;
    return acc;
  }, {});

  const totalReal = Object.values(dominated).reduce((s, v) => s + v, 0);
  const domains = totalReal > 4
    ? Object.entries(dominated).slice(0, 5).map(([domain, tickets], i) => ({
        domain,
        tickets,
        max: Math.max(...Object.values(dominated)),
        color: ["var(--accent)", "var(--green)", "var(--amber)", "var(--accent)", "var(--red)"][i] ?? "var(--accent)",
      }))
    : SKILL_DOMAINS;

  const gap = domains.find((d) => d.tickets === 0) ?? domains[domains.length - 1];

  return (
    <div className={styles.careerCard}>
      <div className={styles.careerHeader}>
        <RiBarChartBoxLine size={14} color="var(--accent)" />
        <span>Career Trajectory</span>
      </div>
      {loading ? (
        <div className={styles.proactiveSkeleton} />
      ) : (
        <>
          <div className={styles.careerBars}>
            {domains.map((d) => (
              <div key={d.domain} className={styles.careerBarRow}>
                <span className={styles.careerBarLabel}>{d.domain}</span>
                <div className={styles.careerBarTrack}>
                  <div
                    className={styles.careerBarFill}
                    style={{
                      width: `${d.max > 0 ? (d.tickets / d.max) * 100 : 0}%`,
                      background: d.tickets === 0 ? "var(--surface-3)" : d.color,
                    }}
                  />
                </div>
                <span className={styles.careerBarCount} style={{ color: d.tickets === 0 ? "var(--red)" : "var(--text-3)" }}>
                  {d.tickets === 0 ? "0 ⚠" : d.tickets}
                </span>
              </div>
            ))}
          </div>
          <div className={styles.careerGapAlert}>
            <RiSparklingLine size={10} />
            <span>
              You've done <strong>{domains[0].tickets} {domains[0].domain}</strong> tickets but zero{" "}
              <strong>{gap.domain}</strong> — your team's next quarter includes this work.
            </span>
          </div>
          <div className={styles.careerRecs}>
            <span className={styles.careerRecsLabel}>Recommended reading</span>
            {CAREER_RECS.map((r) => (
              <div key={r.label} className={styles.careerRecItem}>
                <RiBookOpenLine size={11} />
                <div>
                  <span className={styles.careerRecTitle}>{r.label}</span>
                  <span className={styles.careerRecReason}>{r.reason}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   WELL-BEING SIGNALS
   ══════════════════════════════════════════════════════════════ */

const WELLBEING_HOURS = [9.5, 10.2, 11.1, 11.4, 10.8, 11.2, 8.5, 7.8, 9.1, 11.0, 11.3, 10.9, 11.6, 8.0];
const WELLBEING_LABELS = ["M", "T", "W", "T", "F", "M", "T", "W", "T", "F", "M", "T", "W", "T"];
const LATE_NIGHT_COMMITS = 4;

function WellbeingSignalsWidget({ aiTickets, loading }: { aiTickets: AITicket[]; loading: boolean }) {
  const overworkDays = WELLBEING_HOURS.filter((h) => h >= 10).length;
  const consecutiveHigh = 5;
  const avgHours = (WELLBEING_HOURS.reduce((s, h) => s + h, 0) / WELLBEING_HOURS.length).toFixed(1);
  const wellScore = Math.max(0, Math.round(100 - overworkDays * 4 - LATE_NIGHT_COMMITS * 3));
  const scoreColor = wellScore >= 70 ? "var(--green)" : wellScore >= 50 ? "var(--amber)" : "var(--red)";
  const maxH = Math.max(...WELLBEING_HOURS);

  const blockedCount = aiTickets.filter((t) => t.status.toLowerCase().includes("block")).length;

  return (
    <div className={styles.wellbeingCard}>
      <div className={styles.wellbeingHeader}>
        <RiHeartLine size={14} color="var(--red)" />
        <span>Well-being Signals</span>
        <span className={styles.wellbeingScore} style={{ color: scoreColor }}>{wellScore}</span>
      </div>
      {loading ? (
        <div className={styles.proactiveSkeleton} />
      ) : (
        <>
          <div className={styles.wellbeingAlert}>
            <RiAlertLine size={12} color="var(--amber)" />
            <span>
              You've worked <strong>{consecutiveHigh}-hour days</strong> for 5 consecutive days — velocity
              actually drops after day 3.
            </span>
          </div>
          <div className={styles.wellbeingChart}>
            {WELLBEING_HOURS.map((h, i) => (
              <div key={i} className={styles.wellbeingBarWrap}>
                <div
                  className={styles.wellbeingBar}
                  style={{
                    height: `${(h / maxH) * 100}%`,
                    background: h >= 11 ? "var(--red)" : h >= 9.5 ? "var(--amber)" : "var(--green)",
                  }}
                  title={`${WELLBEING_LABELS[i]}: ${h}h`}
                />
                <span className={styles.wellbeingBarLabel}>{WELLBEING_LABELS[i]}</span>
              </div>
            ))}
          </div>
          <div className={styles.wellbeingStats}>
            <div className={styles.wellbeingStat}>
              <span className={styles.wellbeingStatVal}>{avgHours}h</span>
              <span className={styles.wellbeingStatLbl}>avg / day</span>
            </div>
            <div className={styles.wellbeingStat}>
              <span className={styles.wellbeingStatVal} style={{ color: LATE_NIGHT_COMMITS > 2 ? "var(--amber)" : "var(--text)" }}>{LATE_NIGHT_COMMITS}</span>
              <span className={styles.wellbeingStatLbl}>late commits</span>
            </div>
            <div className={styles.wellbeingStat}>
              <span className={styles.wellbeingStatVal} style={{ color: blockedCount > 0 ? "var(--red)" : "var(--text)" }}>{blockedCount}</span>
              <span className={styles.wellbeingStatLbl}>blockers</span>
            </div>
          </div>
          <p className={styles.wellbeingRec}>
            <RiSparklingLine size={10} />
            Consider a half-day reset tomorrow — your focus score recovers 34% after rest.
          </p>
        </>
      )}
    </div>
  );
}


function QueueStatusBadge({ status }: { status: string }) {
  const isBlocked = status.toLowerCase().includes("block");
  const color = isBlocked
    ? "var(--red)"
    : status === "In Progress"
      ? "var(--accent)"
      : status === "In Review"
        ? "var(--amber)"
        : "var(--text-3)";
  const bg = isBlocked
    ? "rgba(248,113,113,0.12)"
    : status === "In Progress"
      ? "rgba(79,126,255,0.12)"
      : status === "In Review"
        ? "rgba(251,191,36,0.12)"
        : "var(--surface-2)";

  return (
    <span className={styles.queueBadge} style={{ color, background: bg }}>
      {isBlocked ? "Blocked" : status}
    </span>
  );
}

/* ── Sprint Risk ─────────────────────────────────────────── */
function SprintRiskWidget({
  risk,
  loading,
}: {
  risk: SprintRisk | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className={`${styles.riskCard} ${styles.cardLoading}`}>
        <div className={styles.skeletonCircle} />
      </div>
    );
  }

  if (!risk) {
    return (
      <div className={styles.riskCard}>
        <div className={styles.riskHeader}>
          <RiBarChartBoxLine size={16} />
          <span>Sprint Risk</span>
        </div>
        <p className={styles.riskEmpty}>No active sprint</p>
      </div>
    );
  }

  const ringColor =
    risk.status === "on_track"
      ? "var(--green)"
      : risk.status === "at_risk"
        ? "var(--amber)"
        : "var(--red)";

  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (risk.probability / 100) * circumference;

  return (
    <div className={styles.riskCard}>
      <div className={styles.riskHeader}>
        <RiBarChartBoxLine size={16} />
        <span>Sprint Risk</span>
      </div>
      <div className={styles.riskBody}>
        <div className={styles.riskRingWrap}>
          <svg width="72" height="72" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="32" fill="none" stroke="var(--surface-3)" strokeWidth="5" />
            <circle
              cx="36" cy="36" r="32" fill="none" stroke={ringColor}
              strokeWidth="5" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={offset}
              transform="rotate(-90 36 36)"
              style={{ transition: "stroke-dashoffset 1s ease" }}
            />
          </svg>
          <span className={styles.riskPct} style={{ color: ringColor }}>
            {risk.probability}%
          </span>
        </div>
        <div className={styles.riskStats}>
          <div className={styles.riskStat}>
            <span className={styles.riskStatVal}>{risk.completed}</span>
            <span className={styles.riskStatLbl}>Done</span>
          </div>
          <div className={styles.riskStat}>
            <span className={styles.riskStatVal}>{risk.remaining}</span>
            <span className={styles.riskStatLbl}>Left</span>
          </div>
          <div className={styles.riskStat}>
            <span className={styles.riskStatVal}>{risk.daysLeft}d</span>
            <span className={styles.riskStatLbl}>Time</span>
          </div>
          <div className={styles.riskStat}>
            <span className={styles.riskStatVal}>{risk.wipCount}</span>
            <span className={styles.riskStatLbl}>WIP</span>
          </div>
        </div>
      </div>
      <p className={styles.riskCoaching} style={{ color: ringColor }}>
        {risk.coaching}
      </p>
    </div>
  );
}

/* ── Time & Energy ───────────────────────────────────────── */
function TimeEnergyWidget({
  energy,
  loading,
}: {
  energy: TimeEnergy;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className={`${styles.energyCard} ${styles.cardLoading}`}>
        <div className={styles.skeletonBar} />
      </div>
    );
  }

  const maxSpark = Math.max(...energy.daySparkline, 1);

  return (
    <div className={styles.energyCard}>
      <div className={styles.energyHeader}>
        <RiTimeLine size={14} />
        <span>Time & Energy</span>
      </div>

      <div className={styles.energyScoreRow}>
        <div className={styles.energyScore}>
          <span className={styles.energyScoreVal}>{energy.focusScore}</span>
          <span className={styles.energyScoreLbl}>Focus Score</span>
        </div>
        <div className={styles.energyPeak}>
          <span className={styles.energyPeakLbl}>Peak window</span>
          <span className={styles.energyPeakVal}>{energy.peakHour}</span>
        </div>
      </div>

      <div className={styles.energySparkline}>
        {["M", "T", "W", "T", "F"].map((day, i) => (
          <div key={day + i} className={styles.sparkDay}>
            <div className={styles.sparkBarWrap}>
              <div
                className={styles.sparkBar}
                style={{
                  height: `${(energy.daySparkline[i] / maxSpark) * 100}%`,
                  background:
                    energy.daySparkline[i] >= 8
                      ? "var(--green)"
                      : energy.daySparkline[i] >= 5
                        ? "var(--accent)"
                        : "var(--amber)",
                }}
              />
            </div>
            <span className={styles.sparkLabel}>{day}</span>
          </div>
        ))}
      </div>

      <div className={styles.energyMeta}>
        <div className={styles.energyMetaItem}>
          <span className={styles.energyMetaLbl}>Logged</span>
          <span className={styles.energyMetaVal}>{energy.totalLogged.toFixed(1)}h</span>
        </div>
        <div className={styles.energyMetaItem}>
          <span className={styles.energyMetaLbl}>Estimated</span>
          <span className={styles.energyMetaVal}>{energy.totalEstimated.toFixed(1)}h</span>
        </div>
        {energy.overrunCount > 0 && (
          <div className={styles.energyMetaItem}>
            <span className={styles.energyMetaLbl}>Overruns</span>
            <span className={styles.energyMetaVal} style={{ color: "var(--amber)" }}>
              {energy.overrunCount}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
