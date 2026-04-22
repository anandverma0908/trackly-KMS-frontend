import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";
import {
  fetchSprintWikiGaps,
} from "@/services/api";
import type { Sprint, SprintCapacity, SprintForecast, BurndownPoint, VelocityPoint, SprintBlocker } from "@/types";
import {
  RiSparklingLine, RiAlertLine, RiCheckLine, RiTimerLine,
  RiFireLine, RiBrainLine, RiFlashlightLine, RiErrorWarningLine,
  RiArrowUpLine, RiArrowDownLine,
} from "react-icons/ri";
// import styles from "../SprintPage.module.css";
import overviewStyles from "./SprintOverview.module.css";

interface Props {
  sprint: Sprint;
  sprintDetail?: Sprint | null;
  sprintHealth: {
    probability: number;
    daysLeft: number;
    committed: number;
    done: number;
    remaining: number;
    pace: number;
    neededPace: number;
    blockedCount: number;
    atRiskTickets: any[];
    moveToBacklog: any[];
    recommendation: string;
    wipCount: number;
    reviewCount: number;
    totalDays: number;
    daysElapsed: number;
  } | null;
  capacityData?: SprintCapacity | null;
  forecastData?: SprintForecast | null;
  blockers: SprintBlocker[];
  burndown: BurndownPoint[];
  velocity: VelocityPoint[];
  onTicketClick?: (key: string) => void;
}

export default function SprintOverview({
  sprint, sprintHealth, capacityData, forecastData, blockers, burndown, velocity, onTicketClick,
}: Props) {
  const { data: wikiGaps = [] } = useQuery({
    queryKey: ["sprint-wiki-gaps", sprint.id],
    queryFn: () => fetchSprintWikiGaps(sprint.id),
    enabled: !!sprint,
  });

  const health = sprintHealth;
  const probColor = health && health.probability >= 80 ? "var(--green)" : health && health.probability >= 50 ? "var(--amber)" : "var(--red)";
  const probLabel = health && health.probability >= 80 ? "On Track" : health && health.probability >= 50 ? "At Risk" : "Behind Pace";

  // Mini sparkline data from last 7 burndown points
  const sparkData = useMemo(() => burndown.slice(-7).map((b) => b.actual), [burndown]);

  return (
    <div className={overviewStyles.overview}>
      {/* Top Row: Health + Forecast + Capacity */}
      <div className={overviewStyles.topGrid}>
        {/* Health Card */}
        <div className={overviewStyles.healthCard}>
          <div className={overviewStyles.cardHeader}>
            <RiSparklingLine size={14} className={overviewStyles.aiIcon} />
            <span>Sprint Health</span>
            <span className={overviewStyles.eosBadge}><RiSparklingLine size={9} /> EOS</span>
          </div>
          {health ? (
            <>
              <div className={overviewStyles.probRow}>
                <span className={overviewStyles.probVal} style={{ color: probColor }}>{health.probability}%</span>
                <span className={overviewStyles.probLbl}>completion probability</span>
                <span className={overviewStyles.probChip} style={{ color: probColor, borderColor: probColor + "40" }}>{probLabel}</span>
              </div>
              <div className={overviewStyles.probBar}>
                <div className={overviewStyles.probFill} style={{ width: `${health.probability}%`, background: probColor }} />
              </div>
              <div className={overviewStyles.healthStats}>
                <div className={overviewStyles.healthStat}>
                  <span style={{ color: "var(--green)" }}>{health.done}</span>
                  <span>pts done</span>
                </div>
                <div className={overviewStyles.healthStat}>
                  <span>{health.remaining}</span>
                  <span>pts left</span>
                </div>
                <div className={overviewStyles.healthStat}>
                  <span>{health.daysLeft}d</span>
                  <span>remaining</span>
                </div>
                <div className={overviewStyles.healthStat}>
                  <span style={{ color: health.blockedCount > 0 ? "var(--red)" : "var(--text-3)" }}>{health.blockedCount}</span>
                  <span>blocked</span>
                </div>
                <div className={overviewStyles.healthStat}>
                  <span>{health.wipCount}</span>
                  <span>WIP</span>
                </div>
                <div className={overviewStyles.healthStat}>
                  <span>{health.reviewCount}</span>
                  <span>in review</span>
                </div>
              </div>
              <div className={overviewStyles.aiRec}>
                <span className={overviewStyles.aiRecLabel}>EOS Recommends</span>
                <p>{health.recommendation}</p>
              </div>
            </>
          ) : (
            <p className={overviewStyles.empty}>Sprint is not active. Health metrics available once sprint starts.</p>
          )}
        </div>

        {/* Forecast Card */}
        <div className={overviewStyles.forecastCard}>
          <div className={overviewStyles.cardHeader}>
            <RiBrainLine size={14} className={overviewStyles.aiIcon} />
            <span>AI Delivery Forecast</span>
          </div>
          {forecastData ? (
            <>
              <div className={overviewStyles.forecastMain}>
                <div className={overviewStyles.forecastItem}>
                  <span className={overviewStyles.forecastNum}>{forecastData.current_probability}%</span>
                  <span>Current Confidence</span>
                </div>
                <div className={overviewStyles.forecastItem}>
                  <span className={overviewStyles.forecastNum}>{forecastData.predicted_points ?? "—"}</span>
                  <span>Predicted Points</span>
                </div>
                <div className={overviewStyles.forecastItem}>
                  <span className={overviewStyles.forecastNum}>
                    {forecastData.predicted_completion_date ? new Date(forecastData.predicted_completion_date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
                  </span>
                  <span>Predicted EOS</span>
                </div>
              </div>
              {forecastData.confidence_interval && (
                <div className={overviewStyles.confidenceBar}>
                  <div className={overviewStyles.confidenceRange}>
                    <span>{forecastData.confidence_interval.lower}</span>
                    <div className={overviewStyles.confidenceTrack}>
                      <div className={overviewStyles.confidenceFill} style={{ left: `${((forecastData.predicted_points ?? 0) - forecastData.confidence_interval.lower) / (forecastData.confidence_interval.upper - forecastData.confidence_interval.lower) * 40 + 30}%`, width: "40%" }} />
                    </div>
                    <span>{forecastData.confidence_interval.upper}</span>
                  </div>
                </div>
              )}
              <div className={overviewStyles.forecastRisks}>
                {forecastData.risk_factors.slice(0, 3).map((r, i) => (
                  <span key={i} className={`${overviewStyles.riskTag} ${overviewStyles[`risk_${r.severity}`]}`}>
                    {r.factor}
                  </span>
                ))}
              </div>
              <p className={overviewStyles.forecastNova}>{forecastData.nova_summary}</p>
              <div className={overviewStyles.forecastAccuracy}>
                <RiCheckLine size={11} /> Historical accuracy: {Math.round((forecastData.historical_accuracy ?? 0.75) * 100)}%
              </div>
            </>
          ) : (
            <p className={overviewStyles.empty}>No forecast data available.</p>
          )}
        </div>

        {/* Capacity Card */}
        <div className={overviewStyles.capacityCard}>
          <div className={overviewStyles.cardHeader}>
            <RiTimerLine size={14} />
            <span>Capacity Load</span>
          </div>
          {capacityData ? (
            <>
              <div className={overviewStyles.capacityMain}>
                <div className={overviewStyles.capacityRingWrap}>
                  <svg viewBox="0 0 100 100" className={overviewStyles.capacityRing}>
                    <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-2)" strokeWidth="10" />
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke={capacityData.utilization_pct > 90 ? "var(--red)" : capacityData.utilization_pct > 75 ? "var(--amber)" : "var(--green)"}
                      strokeWidth="10"
                      strokeDasharray={`${capacityData.utilization_pct * 2.64} ${264 - capacityData.utilization_pct * 2.64}`}
                      strokeLinecap="round"
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <div className={overviewStyles.capacityRingText}>
                    <strong>{capacityData.utilization_pct}%</strong>
                    <span>utilized</span>
                  </div>
                </div>
                <div className={overviewStyles.capacityBreakdown}>
                  <div><strong>{capacityData.total_capacity_hours}h</strong> <span>total capacity</span></div>
                  <div><strong>{capacityData.allocated_hours}h</strong> <span>allocated</span></div>
                  <div style={{ color: capacityData.available_hours < 0 ? "var(--red)" : "var(--green)" }}>
                    <strong>{capacityData.available_hours}h</strong> <span>available</span>
                  </div>
                </div>
              </div>
              {capacityData.members.filter((m) => m.overloaded).length > 0 && (
                <div className={overviewStyles.overloadAlert}>
                  <RiAlertLine size={12} />
                  <span>{capacityData.members.filter((m) => m.overloaded).length} member(s) overloaded</span>
                </div>
              )}
            </>
          ) : (
            <p className={overviewStyles.empty}>No capacity data.</p>
          )}
        </div>
      </div>

      {/* Middle Row: Burndown Mini + Velocity Mini + Blockers */}
      <div className={overviewStyles.middleGrid}>
        {/* Mini Burndown */}
        <div className={overviewStyles.miniChartCard}>
          <div className={overviewStyles.miniChartHeader}>
            <span>Burndown</span>
            {sparkData.length > 1 && sparkData[sparkData.length - 1] > sparkData[0] && (
              <span className={overviewStyles.trendUp}><RiArrowUpLine size={10} /> Scope up</span>
            )}
          </div>
          {burndown.length > 0 ? (
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={burndown.slice(-10)} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <Line type="monotone" dataKey="actual" stroke="var(--accent)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="ideal" stroke="var(--text-3)" strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className={overviewStyles.empty}>No data</p>
          )}
        </div>

        {/* Mini Velocity */}
        <div className={overviewStyles.miniChartCard}>
          <div className={overviewStyles.miniChartHeader}>
            <span>Velocity</span>
            {velocity.length > 1 && (
              <span className={velocity[velocity.length - 1].completed >= velocity[velocity.length - 2].completed ? overviewStyles.trendUp : overviewStyles.trendDown}>
                {velocity[velocity.length - 1].completed >= velocity[velocity.length - 2].completed ? <RiArrowUpLine size={10} /> : <RiArrowDownLine size={10} />}
                {velocity[velocity.length - 1].completed - velocity[velocity.length - 2].completed} pts
              </span>
            )}
          </div>
          {velocity.length > 0 ? (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={velocity.slice(-6)} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <Bar dataKey="completed" fill="var(--accent)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="committed" fill="var(--text-3)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className={overviewStyles.empty}>No data</p>
          )}
        </div>

        {/* Blocker Alert Panel */}
        <div className={overviewStyles.blockerCard}>
          <div className={overviewStyles.cardHeader}>
            <RiErrorWarningLine size={14} />
            <span>Blocker Tracker</span>
            {blockers.length > 0 && <span className={overviewStyles.blockerCount}>{blockers.length}</span>}
          </div>
          {blockers.length > 0 ? (
            <div className={overviewStyles.blockerList}>
              {blockers.slice(0, 4).map((b) => (
                <div key={b.key} className={`${overviewStyles.blockerItem} ${overviewStyles[`escalation_${b.escalation_level}`]}`}>
                  <div className={overviewStyles.blockerTop}>
                    <span className={overviewStyles.blockerKey}>{b.key}</span>
                    <span className={overviewStyles.blockerHours}>{Math.round(b.hours_blocked)}h blocked</span>
                  </div>
                  <div className={overviewStyles.blockerSummary}>{b.summary}</div>
                  <div className={overviewStyles.blockerAi}><RiSparklingLine size={9} /> {b.ai_reason}</div>
                </div>
              ))}
              {blockers.length > 4 && <span className={overviewStyles.blockerMore}>+{blockers.length - 4} more</span>}
            </div>
          ) : (
            <div className={overviewStyles.noBlockers}>
              <RiCheckLine size={16} />
              <span>No blockers detected. Sprint is flowing smoothly.</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Wiki Gaps + At-Risk Tickets */}
      <div className={overviewStyles.bottomGrid}>
        {/* Wiki Gaps */}
        <div className={overviewStyles.wikiCard}>
          <div className={overviewStyles.cardHeader}>
            <RiFlashlightLine size={14} />
            <span>Wiki Gaps</span>
            {wikiGaps.length > 0 && <span className={overviewStyles.wikiCount}>{wikiGaps.length}</span>}
          </div>
          {wikiGaps.length > 0 ? (
            <div className={overviewStyles.wikiList}>
              {wikiGaps.slice(0, 3).map((g, i) => (
                <div key={i} className={overviewStyles.wikiItem}>
                  <div className={overviewStyles.wikiTopic}>{g.topic}</div>
                  <div className={overviewStyles.wikiMeta}>
                    <span>{g.ticket_count} tickets</span>
                    <span className={`${overviewStyles.wikiPriority} ${overviewStyles[`priority_${g.priority}`]}`}>{g.priority}</span>
                  </div>
                  <div className={overviewStyles.wikiSuggestion}><RiSparklingLine size={9} /> Suggested: {g.suggested_article_title}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className={overviewStyles.empty}>No wiki gaps detected.</p>
          )}
        </div>

        {/* At-Risk Tickets */}
        <div className={overviewStyles.riskTicketCard}>
          <div className={overviewStyles.cardHeader}>
            <RiFireLine size={14} />
            <span>At-Risk Tickets</span>
            {health && health.atRiskTickets.length > 0 && (
              <span className={overviewStyles.riskTicketCount}>{health.atRiskTickets.length}</span>
            )}
          </div>
          {health && health.atRiskTickets.length > 0 ? (
            <div className={overviewStyles.riskTicketList}>
              {health.atRiskTickets.slice(0, 5).map((t) => (
                <div key={t.key} className={overviewStyles.riskTicketItem} onClick={() => onTicketClick?.(t.key)}>
                  <span className={overviewStyles.riskTicketKey}>{t.key}</span>
                  <span className={overviewStyles.riskTicketSummary}>{t.summary}</span>
                  <span className={overviewStyles.riskTicketStatus}>{t.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className={overviewStyles.noBlockers}>
              <RiCheckLine size={16} />
              <span>All tickets on track. No risks detected.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
