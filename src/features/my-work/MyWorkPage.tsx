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

      {/* ── Standup + Delivery Forecast ── */}
      <div className={`${styles.deliveryRow} fade-up-3`}>
        <TodayStandup />
        <NovaDeliveryForecast risk={sprintRisk} />
      </div>

      {/* ── Knowledge Gaps ── */}
      {(loadingGaps || knowledgeGaps.length > 0) && (
        <NovaKnowledgeGaps gaps={knowledgeGaps} loading={loadingGaps} />
      )}

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
