import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchSprintRiskHeatmap, fetchSprintBlockers, fetchSprintWikiGaps,
  escalateBlocker,
} from "@/services/api";
import type { SprintRiskTicket } from "@/types";
import {
  RiErrorWarningLine, RiAlertLine, RiCheckLine, RiSparklingLine,
  RiArrowUpLine, RiFlashlightLine, RiFireLine,
} from "react-icons/ri";
import styles from "./SprintRisks.module.css";

export default function SprintRisks({ sprintId }: { sprintId: string; sprintStatus?: string }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"heatmap" | "blockers" | "wiki">("heatmap");

  const { data: heatmap = [], isLoading: heatmapLoading } = useQuery({
    queryKey: ["sprint-risk-heatmap", sprintId],
    queryFn: () => fetchSprintRiskHeatmap(sprintId),
    enabled: !!sprintId,
  });

  const { data: blockers = [], isLoading: blockersLoading } = useQuery({
    queryKey: ["sprint-blockers", sprintId],
    queryFn: () => fetchSprintBlockers(sprintId),
    enabled: !!sprintId,
  });

  const { data: wikiGaps = [], isLoading: wikiLoading } = useQuery({
    queryKey: ["sprint-wiki-gaps", sprintId],
    queryFn: () => fetchSprintWikiGaps(sprintId),
    enabled: !!sprintId,
  });

  const escalateMut = useMutation({
    mutationFn: ({ sprintId, ticketKey }: { sprintId: string; ticketKey: string }) => escalateBlocker(sprintId, ticketKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprint-blockers", sprintId] });
      qc.invalidateQueries({ queryKey: ["sprint-risk-heatmap", sprintId] });
    },
  });

  const criticalCount = heatmap.filter((t) => t.risk_score >= 70).length;
  const highCount = heatmap.filter((t) => t.risk_score >= 40 && t.risk_score < 70).length;

  return (
    <div className={styles.risksPage}>
      {/* Summary Bar */}
      <div className={styles.riskSummary}>
        <div className={`${styles.riskSummaryCard} ${styles.riskSummaryCritical}`}>
          <RiFireLine size={18} />
          <div>
            <strong>{criticalCount}</strong>
            <span>Critical Risk</span>
          </div>
        </div>
        <div className={`${styles.riskSummaryCard} ${styles.riskSummaryHigh}`}>
          <RiAlertLine size={18} />
          <div>
            <strong>{highCount}</strong>
            <span>High Risk</span>
          </div>
        </div>
        <div className={styles.riskSummaryCard}>
          <RiErrorWarningLine size={18} />
          <div>
            <strong>{blockers.length}</strong>
            <span>Blockers</span>
          </div>
        </div>
        <div className={styles.riskSummaryCard}>
          <RiFlashlightLine size={18} />
          <div>
            <strong>{wikiGaps.length}</strong>
            <span>Wiki Gaps</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.riskTabs}>
        {[
          { key: "heatmap" as const, label: "Risk Heatmap", count: heatmap.length },
          { key: "blockers" as const, label: "Blockers", count: blockers.length },
          { key: "wiki" as const, label: "Wiki Gaps", count: wikiGaps.length },
        ].map((t) => (
          <button
            key={t.key}
            className={`${styles.riskTab} ${tab === t.key ? styles.riskTabActive : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            <span className={styles.riskTabCount}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Heatmap Tab */}
      {tab === "heatmap" && (
        <div className={styles.heatmapWrap}>
          {heatmapLoading ? (
            <p className={styles.empty}>Loading risk heatmap…</p>
          ) : heatmap.length === 0 ? (
            <div className={styles.allClear}>
              <RiCheckLine size={24} />
              <span>All tickets are low risk. Sprint is in good shape.</span>
            </div>
          ) : (
            <div className={styles.heatmapGrid}>
              {heatmap.map((ticket) => (
                <RiskHeatCell key={ticket.key} ticket={ticket} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Blockers Tab */}
      {tab === "blockers" && (
        <div className={styles.blockerWrap}>
          {blockersLoading ? (
            <p className={styles.empty}>Loading blockers…</p>
          ) : blockers.length === 0 ? (
            <div className={styles.allClear}>
              <RiCheckLine size={24} />
              <span>No blockers detected. Sprint is flowing smoothly.</span>
            </div>
          ) : (
            <div className={styles.blockerTableWrap}>
              <table className={styles.blockerTable}>
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Assignee</th>
                    <th>Blocked For</th>
                    <th>Blocking</th>
                    <th>AI Analysis</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {blockers.map((b) => (
                    <tr key={b.key} className={styles[`escalation_${b.escalation_level}`]}>
                      <td>
                        <div className={styles.blockerCellTicket}>
                          <span className={styles.blockerCellKey}>{b.key}</span>
                          <span className={styles.blockerCellSummary}>{b.summary}</span>
                        </div>
                      </td>
                      <td>{b.assignee}</td>
                      <td>
                        <span className={styles.blockerCellHours}>{Math.round(b.hours_blocked)}h</span>
                      </td>
                      <td>{b.blocking_count} tickets</td>
                      <td>
                        <div className={styles.blockerCellAi}>
                          <RiSparklingLine size={10} />
                          {b.ai_reason}
                        </div>
                      </td>
                      <td>
                        <button
                          className={styles.escalateBtn}
                          onClick={() => escalateMut.mutate({ sprintId, ticketKey: b.key })}
                          disabled={escalateMut.isPending}
                        >
                          {escalateMut.isPending ? "…" : <><RiArrowUpLine size={12} /> Escalate</>}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Wiki Gaps Tab */}
      {tab === "wiki" && (
        <div className={styles.wikiWrap}>
          {wikiLoading ? (
            <p className={styles.empty}>Loading wiki gaps…</p>
          ) : wikiGaps.length === 0 ? (
            <div className={styles.allClear}>
              <RiCheckLine size={24} />
              <span>All sprint topics are documented. Great knowledge coverage!</span>
            </div>
          ) : (
            <div className={styles.wikiGrid}>
              {wikiGaps.map((gap, i) => (
                <div key={i} className={styles.wikiCard}>
                  <div className={styles.wikiCardHeader}>
                    <span className={styles.wikiCardTopic}>{gap.topic}</span>
                    <span className={`${styles.wikiCardPriority} ${styles[`priority_${gap.priority}`]}`}>{gap.priority}</span>
                  </div>
                  <div className={styles.wikiCardMeta}>
                    <span>{gap.ticket_count} tickets reference this topic</span>
                  </div>
                  <div className={styles.wikiCardTickets}>
                    {gap.example_tickets.slice(0, 3).map((tk) => (
                      <span key={tk} className={styles.wikiCardTicketKey}>{tk}</span>
                    ))}
                  </div>
                  <div className={styles.wikiCardSuggestion}>
                    <RiSparklingLine size={11} />
                    <span>Suggested article: <strong>{gap.suggested_article_title}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RiskHeatCell({ ticket }: { ticket: SprintRiskTicket }) {
  const maxScore = Math.max(...ticket.risk_factors.map((f) => f.score), 1);
  const color = ticket.risk_score >= 70 ? "var(--red)" : ticket.risk_score >= 40 ? "var(--amber)" : "var(--green)";

  return (
    <div className={styles.heatCell} style={{ borderColor: color + "30" }}>
      <div className={styles.heatCellTop}>
        <span className={styles.heatCellKey}>{ticket.key}</span>
        <span className={styles.heatCellScore} style={{ color }}>{ticket.risk_score}</span>
      </div>
      <div className={styles.heatCellSummary}>{ticket.summary}</div>
      <div className={styles.heatCellAssignee}>{ticket.assignee}</div>
      <div className={styles.heatCellFactors}>
        {ticket.risk_factors.map((f, i) => (
          <div key={i} className={styles.heatFactor}>
            <span className={styles.heatFactorName}>{f.name}</span>
            <div className={styles.heatFactorBar}>
              <div className={styles.heatFactorFill} style={{ width: `${(f.score / maxScore) * 100}%`, background: color }} />
            </div>
          </div>
        ))}
      </div>
      {ticket.deadline_risk !== "none" && (
        <div className={`${styles.deadlineRisk} ${styles[`deadline_${ticket.deadline_risk}`]}`}>
          <RiAlertLine size={10} />
          {ticket.deadline_risk === "overdue" ? "Overdue" : "Deadline approaching"}
        </div>
      )}
    </div>
  );
}
