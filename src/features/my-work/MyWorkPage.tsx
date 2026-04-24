import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useMyWork, fetchTicket } from "./useMyWork";
import {
  updateTicketStatus,
  updateTicket,
  logTime,
  createComment,
} from "@/services/api";
import CreateTicketDrawer from "@/features/tickets/CreateTicketDrawer";
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
} from "react-icons/ri";

import type {
  AITicket,
  Insight,
  FocusBlock,
  TimeEnergy,
  SprintRisk,
  CognitiveData,
  AmbientEvent,
  VelocityPattern,
  MyWorkFlowAnalysis,
  MyWorkBlockerPrediction,
} from "./useMyWork";
import type { KnowledgeGap } from "@/types";

/* ═══════════════════════════════════════════════════════════
   MY WORK PAGE — AI-curated daily command center
   ═══════════════════════════════════════════════════════════ */

export default function MyWorkPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    aiTickets,
    sprintRisk,
    insights,
    focusBlock,
    timeEnergy,
    morningBrief,
    briefChips,
    cognitiveData,
    ambientEvents,
    flowAnalysis,
    blockerPredictions,
    velocityPatterns,
    knowledgeGaps,
    loading,
    loadingGaps,
  } = useMyWork();

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [logTimeTicket, setLogTimeTicket] = useState<AITicket | null>(null);
  const [commentTicket, setCommentTicket] = useState<AITicket | null>(null);

  const { data: selectedTicketData } = useQuery({
    queryKey: ["ticket", selectedKey],
    queryFn: () => fetchTicket(selectedKey!),
    enabled: !!selectedKey,
  });

  async function handleStatusUpdate(key: string, status: string) {
    const tid = toast.loading("Updating status…");
    try {
      await updateTicketStatus(key, status);
      queryClient.invalidateQueries({ queryKey: ["my-work"] });
      toast.success(`${key} moved to ${status}`, { id: tid });
    } catch {
      toast.error("Failed to update status", { id: tid });
    }
  }

  async function handleEscalate(key: string) {
    const tid = toast.loading("Escalating…");
    try {
      await updateTicket(key, { priority: "Highest" });
      queryClient.invalidateQueries({ queryKey: ["my-work"] });
      toast.success(`${key} escalated to Highest priority`, { id: tid });
    } catch {
      toast.error("Failed to escalate", { id: tid });
    }
  }

  function handleQuickAction(actionId: string, ticket: AITicket) {
    switch (actionId) {
      case "open":
      case "ping-blocker":
      case "ping-reviewer":
        setSelectedKey(ticket.key);
        break;
      case "draft-unblock":
        setCommentTicket(ticket);
        break;
      case "log-time":
        setLogTimeTicket(ticket);
        break;
      case "approve":
        handleStatusUpdate(ticket.key, "Done");
        break;
      case "escalate":
        handleEscalate(ticket.key);
        break;
    }
  }

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={`${styles.header} fade-up`}>
        <div>
          <h1 className={styles.title}>My Work</h1>
          {/* <p className={styles.subtitle}>EOS-curated daily command center</p> */}
        </div>
        {/* <span className={styles.aiBadge}>
          <RiSparklingLine size={12} />
          AI Ranked
        </span> */}
      </div>

      {/* ── EOS Agent Brief ── */}
      <EosAgentBrief text={morningBrief} chips={briefChips} loading={loading} />

      {/* ── EOS Insight Feed ── */}
      <NovaInsightFeed
        insights={insights}
        loading={loading}
        onTicketClick={setSelectedKey}
        onNavigate={navigate}
      />

      {/* ── Smart Focus Block ── */}
      {focusBlock && (
        <SmartFocusBlock block={focusBlock} onTicketClick={setSelectedKey} />
      )}

      {/* ── Main content ── */}
      <div className={`${styles.mainRow} fade-up-2`}>
        {/* Left: AI Priority Queue */}
        <AIPriorityQueue
          tickets={aiTickets}
          loading={loading}
          onQuickAction={handleQuickAction}
        />

        {/* Right: Risk + Time */}
        <div className={styles.sideColumn}>
          <SprintRiskWidget risk={sprintRisk} loading={loading} />
          <TimeEnergyWidget energy={timeEnergy} loading={loading} />
        </div>
      </div>

      {/* ── Gen 2: Proactive Intelligence ── */}
      <Gen2ProactiveSection
        aiTickets={aiTickets}
        flowAnalysis={flowAnalysis}
        blockerPredictions={blockerPredictions}
        velocityPatterns={velocityPatterns}
        loading={loading}
        onTicketClick={setSelectedKey}
      />

      {/* ── Delivery Forecast ── */}
      <div className={`${styles.deliveryRow} fade-up-3`}>
        <NovaDeliveryForecast risk={sprintRisk} />
      </div>

      {/* ── Gen 3: Predictive Intelligence ── */}
      <Gen3PredictiveSection
        aiTickets={aiTickets}
        sprintRisk={sprintRisk}
        cognitiveData={cognitiveData}
        loading={loading}
      />

      {/* ── Knowledge Gaps ── */}
      {(loadingGaps || knowledgeGaps.length > 0) && (
        <NovaKnowledgeGaps gaps={knowledgeGaps} loading={loadingGaps} />
      )}

      {/* ── Ambient Awareness ── */}
      <AmbientAwarenessWidget ambientEvents={ambientEvents} />

      {/* ── Quick Log Time Modal ── */}
      {logTimeTicket && (
        <QuickLogTimeModal
          ticket={logTimeTicket}
          onClose={() => setLogTimeTicket(null)}
          onSave={async (hours, comment) => {
            const tid = toast.loading("Logging time…");
            try {
              await logTime(
                logTimeTicket.key,
                hours,
                comment,
                new Date().toISOString().slice(0, 10),
              );
              queryClient.invalidateQueries({ queryKey: ["my-work"] });
              toast.success(`${hours}h logged on ${logTimeTicket.key}`, {
                id: tid,
              });
              setLogTimeTicket(null);
            } catch {
              toast.error("Failed to log time", { id: tid });
            }
          }}
        />
      )}

      {/* ── Quick Comment Modal ── */}
      {commentTicket && (
        <QuickCommentModal
          ticket={commentTicket}
          onClose={() => setCommentTicket(null)}
          onSend={async (text) => {
            const tid = toast.loading("Posting comment…");
            try {
              await createComment(commentTicket.key, text);
              toast.success(`Comment posted on ${commentTicket.key}`, {
                id: tid,
              });
              setCommentTicket(null);
            } catch {
              toast.error("Failed to post comment", { id: tid });
            }
          }}
        />
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

/* ── EOS Agent Brief ─────────────────────────────────────── */
type BriefChip = {
  label: string;
  type: "critical" | "warning" | "info" | "action";
};

function EosAgentBrief({
  text,
  chips: _chips,
  loading,
}: {
  text: string;
  chips: BriefChip[];
  loading: boolean;
}) {
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
    }, 16);
    return () => clearInterval(interval);
  }, [text, loading]);

  if (loading) {
    return (
      <div className={`${styles.agentCard} ${styles.agentCardLoading} fade-up`}>
        <div className={styles.agentAvatarWrap}>
          <div className={styles.agentAvatar}>
            <RiSparklingLine size={14} />
          </div>
        </div>
        <div className={styles.agentContent}>
          <div className={styles.agentBubble}>
            <span className={styles.agentLoadingText}>
              EOS is analysing…
            </span>
            <span className={styles.briefCursor}>|</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.agentCard} fade-up`}>
      <div className={styles.agentAvatarWrap}>
        <div className={styles.agentAvatar}>
          <RiSparklingLine size={14} />
        </div>
        <div className={styles.agentPulse} />
      </div>
      <div className={styles.agentContent}>
        <div className={styles.agentBubble}>
          <span className={styles.agentName}>EOS</span>
          <p className={styles.agentText}>
            {displayed}
            {displayed.length < text.length && (
              <span className={styles.briefCursor}>|</span>
            )}
          </p>
        </div>
        {/* {chips.length > 0 && (
          <div className={styles.agentChips}>
            {chips.map((c) => (
              <span
                key={c.label}
                className={styles.agentChip}
                style={{
                  color: chipColor[c.type],
                  borderColor: `${chipColor[c.type]}40`,
                  background: `${chipColor[c.type]}12`,
                }}
              >
                {c.label}
              </span>
            ))}
          </div>
        )} */}
      </div>
    </div>
  );
}

/* ── EOS Insight Feed ───────────────────────────────────── */
function NovaInsightFeed({
  insights,
  loading,
  onTicketClick,
  onNavigate,
}: {
  insights: Insight[];
  loading: boolean;
  onTicketClick: (key: string) => void;
  onNavigate: (path: string) => void;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  if (loading) {
    return (
      <div className={`${styles.insightCard} fade-up-1`}>
        <div className={styles.insightHeader}>
          <RiSparklingLine size={14} />
          <span>EOS Insights</span>
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
        <span>EOS Insights</span>
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
                    onClick={() => {
                      if (insight.actionTarget) {
                        onTicketClick(insight.actionTarget);
                      } else if (insight.actionLabel === "Draft wiki") {
                        onNavigate("/wiki");
                      }
                    }}
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

  return (
    <div className={`${styles.focusCard} fade-up-1`}>
      <div className={styles.focusLeft}>
        <div className={styles.focusHeader}>
          <RiFocus3Line size={16} color="var(--accent)" />
          <span>Smart Focus Block</span>
        </div>
        <p className={styles.focusMessage}>Your top priority right now.</p>
        <p className={styles.focusSub}>
          {t.key} needs ~
          {t.remaining_estimate_hours || t.original_estimate_hours || 2}h —
          start here.
        </p>
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
        </div>
      </div>
    </div>
  );
}

/* ── AI Priority Queue ───────────────────────────────────── */
function AIPriorityQueue({
  tickets,
  loading,
  onQuickAction,
}: {
  tickets: AITicket[];
  loading: boolean;
  onQuickAction: (actionId: string, ticket: AITicket) => void;
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
                      <span className={styles.queueRiskBadge}>
                        {t.deadlineRisk}
                      </span>
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
                    <span className={styles.detailLabel}>EOS Analysis</span>
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
                              t.hours_spent >
                              (t.original_estimate_hours || 0) * 1.3
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
                        <span className={styles.detailMetaVal}>
                          {t.story_points}
                        </span>
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
                      <span className={styles.quickActionsLabel}>
                        Quick Actions
                      </span>
                      <div className={styles.quickActionsRow}>
                        {t.quickActions.map((qa) => (
                          <button
                            key={qa.id}
                            className={styles.quickActionBtn}
                            onClick={() => onQuickAction(qa.id, t)}
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
    case "ping":
      return <RiSendPlaneLine size={12} />;
    case "log":
      return <RiTimeLine size={12} />;
    case "draft":
      return <RiMessage2Line size={12} />;
    case "move":
      return <RiArrowRightLine size={12} />;
    case "review":
      return <RiEyeLine size={12} />;
    case "escalate":
      return <RiArrowUpLine size={12} />;
    default:
      return <RiFlashlightLine size={12} />;
  }
}

/* ── EOS Delivery Forecast ──────────────────────────────── */
function NovaDeliveryForecast({ risk }: { risk: SprintRisk | null }) {
  if (!risk) {
    return (
      <div className={styles.forecastCard}>
        <div className={styles.forecastHeader}>
          <RiRocketLine size={14} />
          <span>Delivery Forecast</span>
        </div>
        <p className={styles.forecastEmpty}>
          No active sprint — start one to see your forecast.
        </p>
      </div>
    );
  }

  const totalDays = 14;
  const daysElapsed = Math.max(1, totalDays - risk.daysLeft);
  const pace = risk.completed / daysElapsed;
  const neededDays = pace > 0 ? risk.remaining / pace : Infinity;
  const buffer = risk.daysLeft - neededDays;

  const pctDone =
    risk.committed > 0
      ? Math.min(100, (risk.completed / risk.committed) * 100)
      : 0;

  const forecastColor =
    buffer >= 2 ? "var(--green)" : buffer >= 0 ? "var(--amber)" : "var(--red)";
  const forecastLabel =
    buffer >= 2 ? "On Track" : buffer >= 0 ? "Tight" : "At Risk";

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
          <span className={styles.forecastStatVal}>
            {pace > 0 ? pace.toFixed(1) : "—"}
          </span>
          <span className={styles.forecastStatLbl}>pts/day</span>
        </div>
        <div className={styles.forecastStat}>
          <span className={styles.forecastStatVal}>{risk.daysLeft}d</span>
          <span className={styles.forecastStatLbl}>remaining</span>
        </div>
        <div className={styles.forecastStat}>
          <span
            className={styles.forecastStatVal}
            style={{ color: forecastColor }}
          >
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

/* ── EOS Knowledge Gaps ─────────────────────────────────── */
function getGapAction(topic: string, count: number): string {
  const t = topic.toLowerCase();
  if (t.includes("auth") || t.includes("security"))
    return "Review security runbook + schedule training session";
  if (t.includes("test") || t.includes("qa"))
    return "Write test patterns wiki for the team";
  if (t.includes("perf") || t.includes("optim"))
    return "Pair with infra team on a profiling session";
  if (t.includes("api") || t.includes("integr"))
    return "Document integration patterns in the wiki";
  if (t.includes("deploy") || t.includes("infra"))
    return "Schedule infra knowledge transfer with the team";
  if (count >= 5) return `High frequency — create a runbook for "${topic}"`;
  if (count >= 3)
    return `Recurring pattern — schedule pair programming on this`;
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

  const sorted = [...gaps]
    .sort((a, b) => b.ticket_count - a.ticket_count)
    .slice(0, 5);

  return (
    <div className={`${styles.kgCard} fade-up-4`}>
      <div className={styles.kgHeader}>
        <RiBookOpenLine size={14} />
        <span>Knowledge Gaps</span>
        <span className={styles.kgCount}>{sorted.length} detected by EOS</span>
      </div>
      <div className={styles.kgGrid}>
        {sorted.map((gap) => {
          const severity =
            gap.ticket_count >= 5
              ? "high"
              : gap.ticket_count >= 2
                ? "medium"
                : "low";
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
                <span
                  className={styles.kgTicketCount}
                  style={{ color: sevColor }}
                >
                  {gap.ticket_count} tickets
                </span>
              </div>
              {gap.suggestion && (
                <p className={styles.kgDesc}>{gap.suggestion}</p>
              )}
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

interface BlockerPred {
  key: string;
  reason: string;
  hoursUntilBlock: number;
}

function Gen2ProactiveSection({
  aiTickets,
  flowAnalysis,
  blockerPredictions,
  velocityPatterns,
  loading,
  onTicketClick,
}: {
  aiTickets: AITicket[];
  flowAnalysis: MyWorkFlowAnalysis;
  blockerPredictions: MyWorkBlockerPrediction[];
  velocityPatterns: VelocityPattern[];
  loading: boolean;
  onTicketClick: (key: string) => void;
}) {
  // Map backend blocker predictions to the local shape
  const predictions: BlockerPred[] =
    blockerPredictions.length > 0
      ? blockerPredictions.map((p) => ({
          key: p.key,
          reason: p.reason,
          hoursUntilBlock: p.hours_until_block,
        }))
      : aiTickets
          .filter(
            (t) =>
              !t.status.toLowerCase().includes("block") && t.daysInStatus > 1,
          )
          .slice(0, 2)
          .map((t, i) => ({
            key: t.key,
            reason:
              t.daysInStatus > 3
                ? `No update for ${t.daysInStatus} days — external dependency at risk`
                : i === 0
                  ? "Awaiting review — comment unanswered for 2d"
                  : "Dependency stalled",
            hoursUntilBlock: i === 0 ? 48 : 16,
          }));

  // Focus-on tickets from backend AI or fall back to top 2
  const focusKeys =
    flowAnalysis.focus_on.length > 0 ? flowAnalysis.focus_on : [];
  const topTickets =
    focusKeys.length > 0
      ? (focusKeys
          .map((k) => aiTickets.find((t) => t.key === k))
          .filter(Boolean) as AITicket[])
      : aiTickets.slice(0, 2);

  return (
    <div className={`${styles.genSection} fade-up-2`}>
      <div className={styles.gen2Grid}>
        <FlowStateCard
          contextSwitches={flowAnalysis.context_switches}
          weeklyAvg={Math.max(1, Math.floor(flowAnalysis.context_switches / 2))}
          flowState={flowAnalysis.flow_state}
          recommendation={flowAnalysis.recommendation}
          topTickets={topTickets}
          onTicketClick={onTicketClick}
          loading={loading}
        />
        <VelocityPatternCard velocityPatterns={velocityPatterns} />
        <BlockerPredictionCard
          predictions={predictions}
          onTicketClick={onTicketClick}
          loading={loading}
        />
      </div>
    </div>
  );
}

function FlowStateCard({
  contextSwitches,
  weeklyAvg,
  flowState,
  recommendation,
  topTickets,
  onTicketClick,
  loading,
}: {
  contextSwitches: number;
  weeklyAvg: number;
  flowState: "focused" | "disrupted" | "scattered";
  recommendation: string;
  topTickets: AITicket[];
  onTicketClick: (key: string) => void;
  loading: boolean;
}) {
  const isHigh = flowState !== "focused";
  const ratio =
    weeklyAvg > 0 ? (contextSwitches / weeklyAvg).toFixed(1) : "1.0";

  return (
    <div
      className={`${styles.proactiveCard} ${isHigh ? styles.proactiveCardAlert : ""}`}
    >
      <div className={styles.proactiveHeader}>
        <RiShieldLine
          size={14}
          color={isHigh ? "var(--amber)" : "var(--accent)"}
        />
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
            <strong style={{ color: isHigh ? "var(--amber)" : "var(--text)" }}>
              {ratio}×
            </strong>{" "}
            your weekly average.
          </p>
          {isHigh && topTickets.length > 0 ? (
            <div className={styles.proactiveFocusList}>
              <span className={styles.proactiveFocusLabel}>
                {recommendation}
              </span>
              {topTickets.slice(0, 2).map((t) => (
                <button
                  key={t.key}
                  className={styles.proactiveFocusItem}
                  onClick={() => onTicketClick(t.key)}
                >
                  <span className={styles.proactiveFocusKey}>{t.key}</span>
                  <span className={styles.proactiveFocusSummary}>
                    {t.summary}
                  </span>
                  <RiArrowRightLine size={12} />
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.proactiveGood}>{recommendation}</p>
          )}
        </>
      )}
    </div>
  );
}

function VelocityPatternCard({
  velocityPatterns,
}: {
  velocityPatterns: VelocityPattern[];
}) {
  const hasData = velocityPatterns.some((v) => v.completed > 0);
  const maxVal = Math.max(...velocityPatterns.map((v) => v.completed), 1);

  return (
    <div className={styles.proactiveCard}>
      <div className={styles.proactiveHeader}>
        <RiLineChartLine size={14} color="var(--accent)" />
        <span>Velocity Patterns</span>
      </div>
      {!hasData ? (
        <div className={styles.proactiveEmpty}>
          <RiLineChartLine size={24} color="var(--text-3)" />
          <p>
            No worklog data yet — log time on tickets to see your velocity
            patterns.
          </p>
        </div>
      ) : (
        <>
          <p className={styles.proactiveMessage}>
            Hours logged over the last 5 business days.
          </p>
          <div className={styles.velocityBars}>
            {velocityPatterns.map((v) => (
              <div key={v.day} className={styles.velocityBarCol}>
                <div className={styles.velocityBarWrap}>
                  <div
                    className={styles.velocityBarFill}
                    style={{
                      height: `${(v.completed / maxVal) * 100}%`,
                      background:
                        v.completed >= 6
                          ? "var(--green)"
                          : v.completed >= 3
                            ? "var(--accent)"
                            : "var(--amber)",
                    }}
                  />
                </div>
                <span className={styles.velocityBarLabel}>{v.day}</span>
                <span className={styles.velocityBarVal}>{v.completed}h</span>
              </div>
            ))}
          </div>
        </>
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
        <p className={styles.proactiveGood}>
          No blocker risks detected in your queue.
        </p>
      ) : (
        <div className={styles.predictionList}>
          {predictions.map((p) => {
            const urgencyColor =
              p.hoursUntilBlock <= 12
                ? "var(--red)"
                : p.hoursUntilBlock <= 24
                  ? "var(--amber)"
                  : "var(--text-3)";
            return (
              <div key={p.key} className={styles.predictionItem}>
                <div className={styles.predictionTop}>
                  <span className={styles.predictionKey}>{p.key}</span>
                  <span
                    className={styles.predictionHours}
                    style={{ color: urgencyColor }}
                  >
                    ~{p.hoursUntilBlock}h until blocked
                  </span>
                </div>
                <p className={styles.predictionReason}>{p.reason}</p>
                <button
                  className={styles.predictionCta}
                  onClick={() => onTicketClick(p.key)}
                >
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

function Gen3PredictiveSection({
  aiTickets,
  sprintRisk,
  cognitiveData,
  loading,
}: {
  aiTickets: AITicket[];
  sprintRisk: SprintRisk | null;
  cognitiveData: CognitiveData;
  loading: boolean;
}) {
  return (
    <div className={`${styles.genSection} fade-up-3`}>
      <div className={styles.gen3Grid}>
        <CognitiveLoadCard cognitiveData={cognitiveData} loading={loading} />
        <FocusWindowCard />
        <CompletionPredictionCard
          aiTickets={aiTickets}
          sprintRisk={sprintRisk}
          loading={loading}
        />
      </div>
    </div>
  );
}

function CognitiveLoadCard({
  cognitiveData,
  loading,
}: {
  cognitiveData: CognitiveData;
  loading: boolean;
}) {
  const { wipCount, blockedCount, staleCount, loadScore, recommendation } =
    cognitiveData;
  const scoreColor =
    loadScore >= 80
      ? "var(--red)"
      : loadScore >= 50
        ? "var(--amber)"
        : "var(--green)";
  const scoreLabel =
    loadScore >= 80 ? "Overloaded" : loadScore >= 50 ? "Elevated" : "Balanced";
  const circumference = 2 * Math.PI * 28;
  const offset = circumference - (loadScore / 100) * circumference;

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
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="none"
                  stroke="var(--surface-3)"
                  strokeWidth="4"
                />
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="none"
                  stroke={scoreColor}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  transform="rotate(-90 28 28)"
                  style={{ transition: "stroke-dashoffset 1s ease" }}
                />
              </svg>
              <span className={styles.cogScore} style={{ color: scoreColor }}>
                {loadScore}
              </span>
            </div>
            <div className={styles.cogMeta}>
              <span className={styles.cogLabel} style={{ color: scoreColor }}>
                {scoreLabel}
              </span>
              <div className={styles.cogBreakdown}>
                <div className={styles.cogItem}>
                  <span className={styles.cogItemLbl}>WIP</span>
                  <span className={styles.cogItemVal}>{wipCount}</span>
                </div>
                <div className={styles.cogItem}>
                  <span className={styles.cogItemLbl}>Blocked</span>
                  <span
                    className={styles.cogItemVal}
                    style={{
                      color: blockedCount > 0 ? "var(--red)" : undefined,
                    }}
                  >
                    {blockedCount}
                  </span>
                </div>
                <div className={styles.cogItem}>
                  <span className={styles.cogItemLbl}>Stale</span>
                  <span className={styles.cogItemVal}>{staleCount}</span>
                </div>
              </div>
            </div>
          </div>
          <p className={styles.predictiveRec}>
            <RiSparklingLine size={10} />
            {recommendation}
          </p>
        </>
      )}
    </div>
  );
}

function FocusWindowCard() {
  return (
    <div className={styles.predictiveCard}>
      <div className={styles.predictiveHeader}>
        <RiCalendarLine size={14} color="#a78bfa" />
        <span>Focus Windows</span>
      </div>
      <div className={styles.proactiveEmpty}>
        <RiCalendarLine size={24} color="var(--text-3)" />
        <p>
          No calendar connected — focus windows need calendar integration to
          detect your deep work blocks.
        </p>
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
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const topTickets = aiTickets.slice(0, 3);
  const preds = topTickets.map((t) => {
    const est = t.remaining_estimate_hours || t.original_estimate_hours || 4;
    const daysAway = Math.ceil(est / 2.5);
    const future = new Date();
    future.setDate(future.getDate() + daysAway);
    return {
      key: t.key,
      predictedBy: days[future.getDay()],
      daysAway,
      sprintEnd: sprintRisk ? `${sprintRisk.daysLeft}d left` : "—",
      onTrack: daysAway <= (sprintRisk?.daysLeft ?? 5),
    };
  });

  return (
    <div className={styles.predictiveCard}>
      <div className={styles.predictiveHeader}>
        <RiRocketLine size={14} color="#a78bfa" />
        <span>Completion Prediction</span>
      </div>
      {loading ? (
        <div className={styles.proactiveSkeleton} />
      ) : preds.length === 0 ? (
        <div className={styles.proactiveEmpty}>
          <RiRocketLine size={24} color="var(--text-3)" />
          <p>No open tickets to predict — queue is clear.</p>
        </div>
      ) : (
        <div className={styles.completionList}>
          {preds.map((p) => (
            <div key={p.key} className={styles.completionItem}>
              <div className={styles.completionTop}>
                <span className={styles.completionKey}>{p.key}</span>
                <span
                  className={styles.completionStatus}
                  style={{ color: p.onTrack ? "var(--green)" : "var(--amber)" }}
                >
                  {p.onTrack ? "On track" : "At risk"}
                </span>
              </div>
              <div className={styles.completionRow}>
                <span className={styles.completionBy}>
                  Done by{" "}
                  <strong
                    style={{
                      color: p.onTrack ? "var(--green)" : "var(--amber)",
                    }}
                  >
                    {p.predictedBy}
                  </strong>
                </span>
                <span className={styles.completionSprint}>
                  Sprint: {p.sprintEnd}
                </span>
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

function AmbientAwarenessWidget({
  ambientEvents,
}: {
  ambientEvents: AmbientEvent[];
}) {
  const typeColor: Record<AmbientEvent["type"], string> = {
    status: "var(--accent)",
    comment: "var(--amber)",
    assign: "var(--green)",
    blocker: "var(--red)",
  };

  return (
    <div className={styles.ambientCard}>
      <div className={styles.ambientHeader}>
        <div className={styles.ambientPulse} />
        <RiEyeLine size={14} color="var(--accent)" />
        <span>Ambient Work Awareness</span>
        <span className={styles.ambientLive}>Live</span>
      </div>
      <p className={styles.ambientSubtitle}>
        EOS is watching — no logging needed
      </p>
      <div className={styles.ambientFeed}>
        {ambientEvents.length === 0 ? (
          <p className={styles.ambientEmpty}>
            No recent activity — queue is quiet.
          </p>
        ) : (
          ambientEvents.map((ev) => (
            <div key={ev.id} className={styles.ambientItem}>
              <div
                className={styles.ambientDot}
                style={{ background: typeColor[ev.type] }}
              />
              <div className={styles.ambientItemBody}>
                <span className={styles.ambientItemText}>
                  <strong>{ev.key}</strong> {ev.change} —{" "}
                  {ev.title.slice(0, 48)}
                  {ev.title.length > 48 ? "…" : ""}
                </span>
                <span className={styles.ambientItemTime}>{ev.time}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ── Quick Log Time Modal ────────────────────────────────── */
function QuickLogTimeModal({
  ticket,
  onClose,
  onSave,
}: {
  ticket: AITicket;
  onClose: () => void;
  onSave: (hours: number, comment: string) => Promise<void>;
}) {
  const [hours, setHours] = useState("1");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const h = parseFloat(hours);
    if (!h || h <= 0) return;
    setSaving(true);
    await onSave(h, comment || `Work on ${ticket.key}`);
    setSaving(false);
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <RiTimeLine size={15} color="var(--accent)" />
          <span>Log Time — {ticket.key}</span>
          <button className={styles.modalClose} onClick={onClose}>
            <RiCloseLine size={16} />
          </button>
        </div>
        <p className={styles.modalSub}>{ticket.summary}</p>
        <div className={styles.modalField}>
          <label className={styles.modalLabel}>Hours spent</label>
          <input
            className={styles.modalInput}
            type="number"
            min="0.25"
            step="0.25"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            autoFocus
          />
        </div>
        <div className={styles.modalField}>
          <label className={styles.modalLabel}>Comment (optional)</label>
          <textarea
            className={styles.modalTextarea}
            placeholder="What did you work on?"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
          />
        </div>
        <div className={styles.modalActions}>
          <button className={styles.modalCancel} onClick={onClose}>
            Cancel
          </button>
          <button
            className={styles.modalSave}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Log Time"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Quick Comment Modal ─────────────────────────────────── */
function QuickCommentModal({
  ticket,
  onClose,
  onSend,
}: {
  ticket: AITicket;
  onClose: () => void;
  onSend: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSend() {
    if (!text.trim()) return;
    setSaving(true);
    await onSend(text.trim());
    setSaving(false);
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <RiMessage2Line size={15} color="var(--accent)" />
          <span>Comment on {ticket.key}</span>
          <button className={styles.modalClose} onClick={onClose}>
            <RiCloseLine size={16} />
          </button>
        </div>
        <p className={styles.modalSub}>{ticket.summary}</p>
        <div className={styles.modalField}>
          <label className={styles.modalLabel}>Message</label>
          <textarea
            className={styles.modalTextarea}
            placeholder="Describe the blocker or what's needed to unblock…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            autoFocus
          />
        </div>
        <div className={styles.modalActions}>
          <button className={styles.modalCancel} onClick={onClose}>
            Cancel
          </button>
          <button
            className={styles.modalSave}
            onClick={handleSend}
            disabled={saving || !text.trim()}
          >
            {saving ? "Sending…" : "Post Comment"}
          </button>
        </div>
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
            <circle
              cx="36"
              cy="36"
              r="32"
              fill="none"
              stroke="var(--surface-3)"
              strokeWidth="5"
            />
            <circle
              cx="36"
              cy="36"
              r="32"
              fill="none"
              stroke={ringColor}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
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
          <span className={styles.energyMetaVal}>
            {energy.totalLogged.toFixed(1)}h
          </span>
        </div>
        <div className={styles.energyMetaItem}>
          <span className={styles.energyMetaLbl}>Estimated</span>
          <span className={styles.energyMetaVal}>
            {energy.totalEstimated.toFixed(1)}h
          </span>
        </div>
        {energy.overrunCount > 0 && (
          <div className={styles.energyMetaItem}>
            <span className={styles.energyMetaLbl}>Overruns</span>
            <span
              className={styles.energyMetaVal}
              style={{ color: "var(--amber)" }}
            >
              {energy.overrunCount}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
