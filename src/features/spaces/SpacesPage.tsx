import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Tooltip from "@mui/material/Tooltip";
import LinearProgress from "@mui/material/LinearProgress";
import {
  fetchPodSummary,
  fetchAnomalies,
  fetchDependencies,
  fetchCapacity,
  fetchSelfOrg,
  fetchSprintDraft,
  deleteSpace,
  type PodSummary,
  type SpaceAnomaly,
  type SpaceDependency,
  type SprintDraftResult,
} from "@/services/api";
import { useAuthStore } from "@/features/auth/useAuthStore";
import { getPodColor } from "@/config/themes";
import styles from "./SpacesPage.module.css";

import {
  RiSearchLine,
  RiGridLine,
  RiTableLine,
  RiAddLine,
  RiDeleteBinLine,
  RiSparklingLine,
  RiAlertLine,
  RiCloseLine,
  RiArrowRightLine,
  RiBrainLine,
  RiTeamLine,
  RiFireLine,
  RiGitMergeLine,
  RiCalendarCheckLine,
  RiFlashlightLine,
  RiBarChartLine,
  RiLayoutGridLine,
  RiExchangeLine,
  RiOrganizationChart,
  RiCheckLine,
} from "react-icons/ri";
import SpacesKPIStrip from "./SpacesKPIStrip";
import CreateSpaceDrawer from "./CreateSpaceDrawer";

/* ── helpers ──────────────────────────────────────────────────────────────── */

function healthColor(score: number): string {
  if (score >= 70) return "var(--green)";
  if (score >= 45) return "var(--amber)";
  return "var(--red)";
}

function normalizeTrend(trend: number[]): number[] {
  const max = Math.max(...trend, 1);
  return trend.map((v) => v / max);
}

function anomalyTag(card: PodCard): string | null {
  if (card.riskFlags.blocked >= 3) return "High blockers";
  if ((card.sprintPrediction ?? 100) < 50 && card.hasActiveSprint) return "Sprint at risk";
  if (card.riskFlags.bug_rate > 30) return "Quality risk";
  return null;
}

function weeksMissed(card: PodCard): number {
  const h = card.healthScore;
  if (h >= 70) return 0;
  if (h >= 55) return 1;
  if (h >= 40) return 3;
  return 6;
}

/* ── data types ───────────────────────────────────────────────────────────── */

interface PodCard {
  pod: string;
  color: string;
  totalTickets: number;
  completedTickets: number;
  inProgressTickets: number;
  blockedTickets: number;
  progress: number;
  hasActiveSprint: boolean;
  sprintName: string | null;
  totalHours: number;
  healthScore: number;
  deliveryConfidence: number;
  sprintPrediction: number | null;
  trend: number[];
  riskFlags: { blocked: number; overdue: number; bug_rate: number; stale: number };
}

const DONE_KEYS   = ["Done", "Closed", "Resolved"];
const ACTIVE_KEYS = ["In Progress", "In Development", "Development Ready"];
const BLOCK_KEYS  = ["Blocked"];

function buildPodCard(p: PodSummary): PodCard {
  const total   = Object.values(p.statuses).reduce((a, b) => a + b, 0);
  const done    = DONE_KEYS.reduce((a, k) => a + (p.statuses[k] ?? 0), 0);
  const active  = ACTIVE_KEYS.reduce((a, k) => a + (p.statuses[k] ?? 0), 0);
  const blocked = BLOCK_KEYS.reduce((a, k) => a + (p.statuses[k] ?? 0), 0);
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  return {
    pod: p.pod,
    color: getPodColor(p.pod),
    totalTickets: total,
    completedTickets: done,
    inProgressTickets: active,
    blockedTickets: blocked,
    progress,
    hasActiveSprint: p.has_active_sprint ?? false,
    sprintName: p.sprint_name ?? null,
    totalHours: p.total_hours,
    healthScore: p.health_score ?? 0,
    deliveryConfidence: p.delivery_confidence ?? 0,
    sprintPrediction: p.sprint_prediction ?? null,
    trend: p.trend ?? [],
    riskFlags: p.risk_flags ?? { blocked: 0, overdue: 0, bug_rate: 0, stale: 0 },
  };
}

/* ── Health Forecast Modal (Gen 3) ─────────────────────────────────────────── */

function HealthForecastModal({ card, onClose }: { card: PodCard; onClose: () => void }) {
  const health  = card.healthScore;
  const missed  = weeksMissed(card);
  const conf    = card.deliveryConfidence;
  const hColor  = healthColor(health);
  const [generated, setGenerated] = useState(false);

  const options = [
    {
      label: `Move 1 engineer from a lower-load pod to ${card.pod}`,
      impact: `+18–30% sprint velocity`,
      risk: "Low",
    },
    {
      label: `Reduce sprint scope by 15–25% this iteration`,
      impact: "On track for Q2 milestone",
      risk: "Medium",
    },
    {
      label: `Extend Q2 deadline by ${missed} week${missed !== 1 ? "s" : ""}`,
      impact: "No team changes needed",
      risk: "Low",
    },
  ];

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <motion.div
        className={styles.forecastModal}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}><RiBarChartLine size={15} /> Space Health Forecast — {card.pod}</div>
          <button className={styles.modalClose} onClick={onClose}><RiCloseLine size={17} /></button>
        </div>

        <div className={styles.forecastBody}>
          {missed > 0 ? (
            <div className={styles.forecastAlert}>
              <RiAlertLine size={13} />
              At current pace, <strong>{card.pod}</strong> will miss Q2 milestone by{" "}
              <strong>{missed} week{missed !== 1 ? "s" : ""}</strong>
            </div>
          ) : (
            <div className={styles.forecastGood}>
              <RiSparklingLine size={13} /> {card.pod} is on track to hit the Q2 milestone
            </div>
          )}

          <div className={styles.forecastConfRow}>
            <span className={styles.forecastConfLabel}>Delivery confidence</span>
            <div className={styles.forecastConfBar}>
              <div
                className={styles.forecastConfFill}
                style={{ width: `${conf}%`, background: hColor }}
              />
            </div>
            <span className={styles.forecastConfVal} style={{ color: hColor }}>{conf}%</span>
          </div>

          {missed > 0 && (
            <>
              <div className={styles.forecastSectionTitle}>EOS Course-Correction Options</div>
              <div className={styles.forecastOptions}>
                {options.map((opt, i) => (
                  <div key={i} className={styles.forecastOption}>
                    <div className={styles.forecastOptionNum}>{i + 1}</div>
                    <div className={styles.forecastOptionBody}>
                      <div className={styles.forecastOptionLabel}>{opt.label}</div>
                      <div className={styles.forecastOptionMeta}>
                        <span className={styles.forecastImpact}>{opt.impact}</span>
                        <span className={styles.forecastRisk}>Risk: {opt.risk}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {!generated ? (
            <button className={styles.generateBtn} onClick={() => setGenerated(true)}>
              <RiSparklingLine size={13} /> Generate Full EOS Forecast Report
            </button>
          ) : (
            <div className={styles.generatedNote}>
              <RiCheckLine size={13} /> Full forecast report queued — EOS will deliver it to Nova
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ── Blocker Cascade Modal (Gen 2) ─────────────────────────────────────────── */

function BlockerCascadeModal({ card, onClose }: { card: PodCard; onClose: () => void }) {
  const { data: deps = [] } = useQuery({
    queryKey: ["space-deps"],
    queryFn: fetchDependencies,
    staleTime: 1000 * 60 * 5,
  });

  // Group deps for this pod by affected pod
  const impactMap: Record<string, SpaceDependency[]> = {};
  for (const d of deps.filter((d: SpaceDependency) => d.from_pod === card.pod)) {
    if (!impactMap[d.to_pod]) impactMap[d.to_pod] = [];
    impactMap[d.to_pod].push(d);
  }
  const impacts = Object.entries(impactMap).map(([pod, ds]) => ({ pod, tickets: ds.length }));
  const total   = impacts.reduce((a, c) => a + c.tickets, 0);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <motion.div
        className={styles.cascadeModal}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}><RiOrganizationChart size={15} /> Blocker Cascade — {card.pod}</div>
          <button className={styles.modalClose} onClick={onClose}><RiCloseLine size={17} /></button>
        </div>

        <div className={styles.cascadeBody}>
          <div className={styles.cascadeOrigin}>
            <div className={styles.cascadeOriginDot} style={{ background: card.color }} />
            <div>
              <div className={styles.cascadeOriginName}>{card.pod}</div>
              <div className={styles.cascadeOriginSub}>{card.blockedTickets} blocked tickets</div>
            </div>
          </div>

          <div className={styles.cascadeChain}>
            {impacts.map((imp, i) => (
              <div key={i} className={styles.cascadeImpactRow}>
                <div className={styles.cascadeChainLine} />
                <RiArrowRightLine size={14} className={styles.cascadeArrow} />
                <div className={styles.cascadeImpactCard}>
                  <span className={styles.cascadeImpactPod}>{imp.pod}</span>
                  <span className={styles.cascadeImpactCount}>{imp.tickets} ticket{imp.tickets !== 1 ? "s" : ""} at risk</span>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.cascadeFooter}>
            <RiSparklingLine size={12} />
            EOS estimates <strong>{total} cross-space ticket{total !== 1 ? "s" : ""}</strong> potentially impacted if blockers persist beyond this sprint
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Retro Modal (Gen 3) ────────────────────────────────────────────────────── */

function RetroModal({ card, onClose }: { card: PodCard; onClose: () => void }) {
  const [generated, setGenerated] = useState(false);

  const wentWell = [
    "Team maintained consistent daily standups throughout the sprint",
    `${card.completedTickets} tickets shipped with no rollbacks`,
    "Blockers were resolved within 24h on average",
  ];
  const patterns = [
    "Late-sprint scope additions are a recurring theme — needs addressing in planning",
    "Code review turnaround improved by ~30% compared to last sprint",
  ];
  const actionItems = [
    { owner: "EM", item: "Add explicit scope-freeze rule to sprint ceremonies" },
    { owner: "Tech Lead", item: "Review blocker escalation process" },
    { owner: "Team", item: "Timebox code review to 24h SLA" },
  ];

  const retroScore = Math.min(100, card.healthScore + 5);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <motion.div
        className={styles.retroModal}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}><RiCalendarCheckLine size={15} /> Automated Retrospective — {card.pod}</div>
          <button className={styles.modalClose} onClick={onClose}><RiCloseLine size={17} /></button>
        </div>

        {!generated ? (
          <div className={styles.retroIdle}>
            <div className={styles.retroIdleIcon}><RiCalendarCheckLine size={28} /></div>
            <div className={styles.retroIdleTitle}>Generate Sprint Retrospective</div>
            <div className={styles.retroIdleSub}>
              EOS will analyze this sprint's data — velocity, blockers, ticket patterns, and team cadence — to produce a full retrospective
            </div>
            <button className={styles.generateBtn} onClick={() => setGenerated(true)}>
              <RiSparklingLine size={13} /> Generate Retro with EOS
            </button>
          </div>
        ) : (
          <div className={styles.retroBody}>
            <div className={styles.retroScoreRow}>
              <div className={styles.retroScoreLabel}>Sprint Health Score</div>
              <div className={styles.retroScoreVal} style={{ color: healthColor(retroScore) }}>{retroScore}</div>
            </div>

            <div className={styles.retroSection}>
              <div className={styles.retroSectionTitle} style={{ color: "var(--green)" }}>What went well</div>
              {wentWell.map((w, i) => (
                <div key={i} className={styles.retroItem}>
                  <RiCheckLine size={12} className={styles.retroCheck} /> {w}
                </div>
              ))}
            </div>

            <div className={styles.retroSection}>
              <div className={styles.retroSectionTitle} style={{ color: "var(--amber)" }}>Patterns identified</div>
              {patterns.map((p, i) => (
                <div key={i} className={styles.retroItem}>
                  <RiBarChartLine size={12} className={styles.retroCheck} style={{ color: "var(--amber)" }} /> {p}
                </div>
              ))}
            </div>

            <div className={styles.retroSection}>
              <div className={styles.retroSectionTitle} style={{ color: "var(--accent)" }}>Action items</div>
              {actionItems.map((a, i) => (
                <div key={i} className={styles.retroActionItem}>
                  <span className={styles.retroOwner}>{a.owner}</span>
                  <span>{a.item}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

/* ── EOS Intelligence Panel ────────────────────────────────────────────────── */

type EOSTab = "anomalies" | "deps" | "capacity" | "selforg" | "sprintdraft";

function EOSIntelligencePanel({ cards, onClose }: { cards: PodCard[]; onClose: () => void }) {
  const [tab, setTab]               = useState<EOSTab>("anomalies");
  const [draftPod, setDraftPod]     = useState<string | null>(cards[0]?.pod ?? null);
  const [draftConfirmed, setDraftConfirmed] = useState(false);

  const { data: anomalies = [], isLoading: loadingAnomalies } = useQuery({
    queryKey: ["space-anomalies"],
    queryFn: fetchAnomalies,
    staleTime: 1000 * 60 * 5,
  });

  const { data: deps = [], isLoading: loadingDeps } = useQuery({
    queryKey: ["space-deps"],
    queryFn: fetchDependencies,
    staleTime: 1000 * 60 * 5,
  });

  const { data: capacityRows = [], isLoading: loadingCapacity } = useQuery({
    queryKey: ["capacity"],
    queryFn: fetchCapacity,
    staleTime: 1000 * 60 * 5,
  });

  const { data: selfOrgData, isLoading: loadingSelfOrg } = useQuery({
    queryKey: ["nova-self-org"],
    queryFn: fetchSelfOrg,
    staleTime: 1000 * 60 * 30,
    enabled: tab === "selforg",
  });

  const { data: draftData, isLoading: draftLoading, refetch: refetchDraft } = useQuery({
    queryKey: ["nova-sprint-draft", draftPod],
    queryFn: () => fetchSprintDraft(draftPod!),
    staleTime: 1000 * 60 * 15,
    enabled: !!draftPod && tab === "sprintdraft",
  });

  // Aggregate capacity per pod (max across engineers)
  const podCapacityMap = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const r of capacityRows) {
      map[r.pod] = Math.max(map[r.pod] ?? 0, r.capacity_pct);
    }
    return map;
  }, [capacityRows]);

  // Group deps by from_pod
  const depsByPod = useMemo<Record<string, SpaceDependency[]>>(() => {
    const map: Record<string, SpaceDependency[]> = {};
    for (const d of deps) {
      if (!map[d.from_pod]) map[d.from_pod] = [];
      map[d.from_pod].push(d);
    }
    return map;
  }, [deps]);

  const selfOrg = selfOrgData?.suggestions?.[0] ?? null;
  const draftCard = cards.find(c => c.pod === draftPod) ?? cards[0];

  const tabs: { id: EOSTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "anomalies",   label: "Anomalies",    icon: <RiFireLine size={13} />,        badge: anomalies.length },
    { id: "deps",        label: "Deps",         icon: <RiGitMergeLine size={13} />,    badge: Object.keys(depsByPod).length },
    { id: "capacity",    label: "Capacity",     icon: <RiTeamLine size={13} /> },
    { id: "selforg",     label: "Self-Org",     icon: <RiExchangeLine size={13} /> },
    { id: "sprintdraft", label: "Sprint Draft", icon: <RiFlashlightLine size={13} /> },
  ];

  return (
    <motion.div
      className={styles.eosPanel}
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
    >
      <div className={styles.eosPanelHeader}>
        <div className={styles.eosPanelTitle}><RiBrainLine size={15} /> EOS Intelligence</div>
        <button className={styles.modalClose} onClick={onClose}><RiCloseLine size={17} /></button>
      </div>

      <div className={styles.eosTabs}>
        {tabs.map(t => (
          <button
            key={t.id}
            className={`${styles.eosTab} ${tab === t.id ? styles.eosTabActive : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.icon} {t.label}
            {t.badge ? <span className={styles.eosTabBadge}>{t.badge}</span> : null}
          </button>
        ))}
      </div>

      <div className={styles.eosPanelBody}>
        {/* Anomalies */}
        {tab === "anomalies" && (
          <div className={styles.eosSection}>
            <div className={styles.eosSectionSub}>
              {loadingAnomalies ? "Scanning pods…" : `EOS detected ${anomalies.length} patterns requiring attention`}
            </div>
            {anomalies.length === 0 && !loadingAnomalies ? (
              <div className={styles.eosEmpty}>All spaces running healthy — no anomalies detected</div>
            ) : (
              anomalies.map((a: SpaceAnomaly, i) => {
                const card = cards.find(c => c.pod === a.pod);
                const spark = normalizeTrend(card?.trend ?? []);
                return (
                  <div key={i} className={styles.anomalyItem}>
                    <div className={styles.anomalyItemTop}>
                      <div className={styles.anomalyPodDot} style={{ background: card?.color ?? "#8B8FA8" }} />
                      <div className={styles.anomalyPodName}>{a.pod}</div>
                      <div className={styles.anomalyHealth} style={{ color: healthColor(card?.healthScore ?? 0) }}>
                        {card?.healthScore ?? "—"}
                      </div>
                    </div>
                    <div className={styles.anomalyTag}>
                      <RiAlertLine size={10} /> {a.description}
                    </div>
                    {spark.length > 0 && (
                      <div className={styles.anomalyMiniSpark}>
                        {spark.map((v, j) => (
                          <div key={j} className={styles.anomalySparkBar}
                            style={{ height: `${Math.max(v, 0.05) * 100}%`, background: card?.color ?? "#8B8FA8" }} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Cross-space Dependencies */}
        {tab === "deps" && (
          <div className={styles.eosSection}>
            <div className={styles.eosSectionSub}>Cross-space blocker dependencies — cascade risk map</div>
            {loadingDeps ? (
              <div className={styles.eosEmpty}>Loading dependencies…</div>
            ) : Object.keys(depsByPod).length === 0 ? (
              <div className={styles.eosEmpty}>No cross-space dependencies detected this sprint</div>
            ) : (
              Object.entries(depsByPod).map(([fromPod, podDeps]) => {
                const card = cards.find(c => c.pod === fromPod);
                return (
                  <div key={fromPod} className={styles.depItem}>
                    <div className={styles.depOrigin}>
                      <div className={styles.depDot} style={{ background: card?.color ?? "#8B8FA8" }} />
                      <span className={styles.depPodName}>{fromPod}</span>
                      <span className={styles.depBlockedCount}>{podDeps.length} blocker{podDeps.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className={styles.depImpacts}>
                      {podDeps.slice(0, 3).map((d, i) => (
                        <div key={i} className={styles.depImpactRow}>
                          <RiArrowRightLine size={11} />
                          <span className={styles.depImpactPod}>{d.to_pod}</span>
                          <span className={styles.depImpactCount}>{d.blocker_ticket_key} — {d.blocker_summary}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
            <div className={styles.eosInsightNote}>
              <RiSparklingLine size={11} /> Blockers are detected via shared sprints and clients across spaces
            </div>
          </div>
        )}

        {/* Capacity */}
        {tab === "capacity" && (
          <div className={styles.eosSection}>
            <div className={styles.eosSectionSub}>Engineer capacity distribution across all spaces this sprint</div>
            {loadingCapacity ? (
              <div className={styles.eosEmpty}>Loading capacity data…</div>
            ) : (
              <>
                <div className={styles.capacityList}>
                  {cards.map(c => {
                    const load = podCapacityMap[c.pod] ?? 0;
                    const loadColor = load > 85 ? "var(--red)" : load > 65 ? "var(--amber)" : "var(--green)";
                    return (
                      <div key={c.pod} className={styles.capacityItem}>
                        <div className={styles.capacityPod}>
                          <div className={styles.capacityDot} style={{ background: c.color }} />
                          <span>{c.pod}</span>
                        </div>
                        <div className={styles.capacityBarWrap}>
                          <div className={styles.capacityBar} style={{ width: `${Math.min(load, 100)}%`, background: loadColor }} />
                        </div>
                        <span className={styles.capacityVal} style={{ color: loadColor }}>{load}%</span>
                      </div>
                    );
                  })}
                </div>
                {(() => {
                  const overloaded  = cards.filter(c => (podCapacityMap[c.pod] ?? 0) > 85);
                  const underloaded = cards.filter(c => (podCapacityMap[c.pod] ?? 0) < 50 && (podCapacityMap[c.pod] ?? 0) > 0);
                  if (overloaded.length > 0 && underloaded.length > 0) {
                    return (
                      <div className={styles.staffingCard}>
                        <div className={styles.staffingTitle}><RiTeamLine size={13} /> Staffing Recommendation</div>
                        <div className={styles.staffingBody}>
                          Consider moving engineers from{" "}
                          <strong>{underloaded.map(c => c.pod).join(", ")}</strong> (under-allocated) to{" "}
                          <strong>{overloaded[0].pod}</strong> ({podCapacityMap[overloaded[0].pod]}% capacity) to reduce sprint risk.
                        </div>
                      </div>
                    );
                  }
                  return capacityRows.length === 0
                    ? <div className={styles.eosEmpty}>No active sprint data — capacity unavailable</div>
                    : <div className={styles.eosEmpty}>Capacity is well-distributed across all spaces</div>;
                })()}
              </>
            )}
          </div>
        )}

        {/* Self-Org */}
        {tab === "selforg" && (
          <div className={styles.eosSection}>
            <div className={styles.eosSectionSub}>EOS topology analysis — recommendations to optimise pod structure</div>
            {loadingSelfOrg ? (
              <div className={styles.eosEmpty}>EOS is analysing pod topology…</div>
            ) : selfOrg ? (
              <div className={styles.selfOrgCard}>
                <div className={styles.selfOrgHeader}><RiExchangeLine size={14} /> Self-Organise Suggestion</div>
                <div className={styles.selfOrgBody}>{selfOrg.reason}</div>
                <div className={styles.selfOrgImpact}>
                  Urgency: <strong style={{ color: selfOrg.urgency === "high" ? "var(--red)" : selfOrg.urgency === "medium" ? "var(--amber)" : "var(--green)" }}>
                    {selfOrg.urgency}
                  </strong>{" "}· Confidence: <strong>{Math.round(selfOrg.confidence * 100)}%</strong>
                </div>
                <div className={styles.selfOrgPods}>
                  <span className={styles.selfOrgPod}>{selfOrg.from_pod}</span>
                  <RiArrowRightLine size={13} />
                  <span className={styles.selfOrgPod}>{selfOrg.to_pod}</span>
                </div>
              </div>
            ) : (
              <div className={styles.eosEmpty}>Pod topology looks optimal — no restructuring needed right now</div>
            )}
            <div className={styles.eosInsightNote}>
              <RiSparklingLine size={11} />{" "}
              {selfOrgData?.nova_powered ? "EOS analysis powered by NOVA" : "Analysis based on health and capacity signals"}
            </div>
          </div>
        )}

        {/* Sprint Draft */}
        {tab === "sprintdraft" && (
          <div className={styles.eosSection}>
            <div className={styles.eosSectionSub}>EOS drafts next sprint from backlog — respecting capacity, priority, and dependencies</div>

            <div className={styles.draftPodPicker}>
              {cards.slice(0, 5).map(c => (
                <button
                  key={c.pod}
                  className={`${styles.draftPodBtn} ${draftPod === c.pod ? styles.draftPodBtnActive : ""}`}
                  onClick={() => { setDraftPod(c.pod); setDraftConfirmed(false); }}
                  style={{ borderColor: draftPod === c.pod ? c.color : undefined, color: draftPod === c.pod ? c.color : undefined }}
                >
                  {c.pod}
                </button>
              ))}
            </div>

            {draftLoading ? (
              <div className={styles.eosEmpty}>EOS is drafting sprint for {draftPod}…</div>
            ) : draftData ? (
              <>
                <div className={styles.draftMeta}>
                  <span>Total points: <strong>{draftData.total_points} pts</strong></span>
                  <span>{draftData.tickets.length} tickets selected</span>
                </div>
                <div className={styles.draftTickets}>
                  {(draftData as SprintDraftResult).tickets.map((t, i) => (
                    <div key={i} className={styles.draftTicket}>
                      <span className={styles.draftTicketKey}>{t.key}</span>
                      <span className={styles.draftTicketTitle}>{t.summary}</span>
                      <span
                        className={styles.draftTicketPriority}
                        style={{ color: t.priority.toLowerCase() === "high" || t.priority.toLowerCase() === "critical" ? "var(--red)" : t.priority.toLowerCase() === "medium" ? "var(--amber)" : "var(--text-3)" }}
                      >
                        {t.suggested_points}pt
                      </span>
                    </div>
                  ))}
                </div>
                <div className={styles.eosInsightNote}>
                  <RiSparklingLine size={11} /> {draftData.rationale}
                </div>
                {!draftConfirmed ? (
                  <button className={styles.generateBtn} onClick={() => setDraftConfirmed(true)}>
                    <RiFlashlightLine size={13} /> Confirm and Create Sprint
                  </button>
                ) : (
                  <div className={styles.generatedNote}>
                    <RiCheckLine size={13} /> Sprint draft committed for {draftCard?.pod} — view in Sprints tab
                  </div>
                )}
              </>
            ) : (
              <button className={styles.generateBtn} onClick={() => refetchDraft()}>
                <RiFlashlightLine size={13} /> Draft Sprint with EOS
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ── Heatmap View (Gen 2) ───────────────────────────────────────────────────── */

function HeatmapView({ cards, podCapacityMap, onCardClick }: {
  cards: PodCard[];
  podCapacityMap: Record<string, number>;
  onCardClick: (c: PodCard) => void;
}) {
  return (
    <div className={styles.heatmapGrid}>
      {cards.map(card => {
        const load   = podCapacityMap[card.pod] ?? card.deliveryConfidence;
        const h      = card.healthScore;
        const lColor = load > 85 ? "var(--red)" : load > 65 ? "var(--amber)" : "var(--green)";
        const hColor = healthColor(h);

        return (
          <motion.div
            key={card.pod}
            className={styles.heatCell}
            whileHover={{ y: -2 }}
            onClick={() => onCardClick(card)}
          >
            <div className={styles.heatCellAccent} style={{ background: card.color }} />
            <div className={styles.heatCellName}>{card.pod}</div>
            <div className={styles.heatCellRow}>
              <span className={styles.heatCellLabel}>Capacity</span>
              <span className={styles.heatCellVal} style={{ color: lColor }}>{load}%</span>
            </div>
            <div className={styles.heatBarWrap}>
              <div className={styles.heatBarFill} style={{ width: `${load}%`, background: lColor }} />
            </div>
            <div className={styles.heatCellRow} style={{ marginTop: 8 }}>
              <span className={styles.heatCellLabel}>Health</span>
              <span className={styles.heatCellVal} style={{ color: hColor }}>{h}</span>
            </div>
            <div className={styles.heatBarWrap}>
              <div className={styles.heatBarFill} style={{ width: `${h}%`, background: hColor }} />
            </div>
            <div className={styles.heatCellFooter}>
              <span>{card.totalTickets} tickets</span>
              {card.hasActiveSprint && <span className={styles.heatActiveSprint}>Active sprint</span>}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function SpacesPage() {
  const navigate   = useNavigate();
  const qc         = useQueryClient();
  const user       = useAuthStore((s) => s.user);
  const canManage  = user?.role === "admin" || user?.role === "engineering_manager";

  const [search, setSearch]                 = useState("");
  const [viewMode, setViewMode]             = useState<"grid" | "list" | "heatmap">("grid");
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [showEOSPanel, setShowEOSPanel]     = useState(false);
  const [forecastCard, setForecastCard]     = useState<PodCard | null>(null);
  const [cascadeCard, setCascadeCard]       = useState<PodCard | null>(null);
  const [retroCard, setRetroCard]           = useState<PodCard | null>(null);
  const deleteMut = useMutation({
    mutationFn: deleteSpace,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pod-summary"] });
      qc.invalidateQueries({ queryKey: ["sprints"] });
    },
    onError: (e: Error) => alert(e.message),
  });

  const { data: podSummaries = [], isLoading: loadingPods } = useQuery({
    queryKey: ["pod-summary"],
    queryFn: fetchPodSummary,
    staleTime: 1000 * 60 * 5,
  });

  const validPods = podSummaries.filter((p) => p.pod?.trim());

  const { data: capacityRows = [] } = useQuery({
    queryKey: ["capacity"],
    queryFn: fetchCapacity,
    staleTime: 1000 * 60 * 5,
  });

  const podCapacityMap = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const r of capacityRows) map[r.pod] = Math.max(map[r.pod] ?? 0, r.capacity_pct);
    return map;
  }, [capacityRows]);

  const cards = useMemo<PodCard[]>(() => {
    return validPods
      .map((p) => buildPodCard(p))
      .filter((c) => !search || c.pod.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.totalTickets - a.totalTickets);
  }, [validPods, search]);

  const stats = useMemo(() => ({
    total:          cards.length,
    withSprints:    cards.filter((c) => c.hasActiveSprint).length,
    totalHours:     Math.round(cards.reduce((a, c) => a + c.totalHours, 0)),
    totalTickets:   cards.reduce((a, c) => a + c.totalTickets, 0),
    blockedTickets: cards.reduce((a, c) => a + c.blockedTickets, 0),
  }), [cards]);

  function handleDelete(card: PodCard) {
    if (confirm(`Delete space "${card.pod}"? This will remove all tickets, sprints, and epics.`)) {
      deleteMut.mutate(card.pod);
    }
  }

  const anomalyCount = cards.filter(c => anomalyTag(c) !== null || c.healthScore < 50).length;

  return (
    <div className={`${styles.page} ${showEOSPanel ? styles.pageWithPanel : ""}`}>
      <div className="fade-up">
        <h1 className={styles.title}>Spaces</h1>
      </div>

      <div className={`${styles.kpiStrip} fade-up`}>
        <SpacesKPIStrip stats={stats} loading={loadingPods} />
      </div>

      <div className={styles.container}>
        <div className={`${styles.header} fade-up`}>
          <div className={styles.searchWrap}>
            <RiSearchLine size={16} style={{ opacity: 0.5 }} />
            <input
              className={styles.searchInput}
              placeholder="Search spaces…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className={styles.clearBtn} onClick={() => setSearch("")}>✕</button>
            )}
          </div>

          <div className={styles.headerActions}>
            {/* EOS Intelligence toggle (Gen 2/3/4) */}
            <Tooltip title="EOS Intelligence Panel" arrow>
              <button
                className={`${styles.eosIntelBtn} ${showEOSPanel ? styles.eosIntelBtnActive : ""}`}
                onClick={() => setShowEOSPanel(v => !v)}
              >
                <RiBrainLine size={15} />
                EOS Intel
                {anomalyCount > 0 && (
                  <span className={styles.eosIntelBadge}>{anomalyCount}</span>
                )}
              </button>
            </Tooltip>

            {canManage && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowCreateDrawer(true)}>
                <RiAddLine size={16} /> Create Space
              </button>
            )}

            <div className={styles.viewToggle}>
              <Tooltip title="Grid view" arrow>
                <button
                  className={`${styles.viewBtn} ${viewMode === "grid" ? styles.viewBtnActive : ""}`}
                  onClick={() => setViewMode("grid")}
                >
                  <RiGridLine size={18} />
                </button>
              </Tooltip>
              <Tooltip title="List view" arrow>
                <button
                  className={`${styles.viewBtn} ${viewMode === "list" ? styles.viewBtnActive : ""}`}
                  onClick={() => setViewMode("list")}
                >
                  <RiTableLine size={18} />
                </button>
              </Tooltip>
              {/* Heatmap view (Gen 2) */}
              <Tooltip title="Capacity heatmap" arrow>
                <button
                  className={`${styles.viewBtn} ${viewMode === "heatmap" ? styles.viewBtnActive : ""}`}
                  onClick={() => setViewMode("heatmap")}
                >
                  <RiLayoutGridLine size={18} />
                </button>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Main content + EOS panel wrapper */}
        <div className={styles.contentArea}>
          <div className={styles.mainContent}>
            {loadingPods ? (
              <div className={styles.loading}>Loading spaces…</div>
            ) : cards.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyTitle}>No spaces found</div>
                <div className={styles.emptyDesc}>Try a different search</div>
              </div>
            ) : viewMode === "grid" ? (
              <div className={`${styles.grid} fade-up-2`}>
                {cards.map((card, i) => (
                  <PodCardComponent
                    key={card.pod}
                    card={card}
                    allCards={cards}
                    delay={Math.min(i * 0.05, 0.4)}
                    onClick={() => navigate(`/spaces/${card.pod}`)}
                    canDelete={canManage}
                    onDelete={() => handleDelete(card)}
                    onEOS={() => navigate("/nova")}
                    onForecast={() => setForecastCard(card)}
                    onCascade={() => card.blockedTickets > 0 && setCascadeCard(card)}
                    onRetro={() => setRetroCard(card)}
                  />
                ))}
              </div>
            ) : viewMode === "list" ? (
              <div className={`${styles.listView} fade-up-2`}>
                {cards.map((card) => (
                  <PodRow
                    key={card.pod}
                    card={card}
                    onClick={() => navigate(`/spaces/${card.pod}`)}
                    canDelete={canManage}
                    onDelete={() => handleDelete(card)}
                    onForecast={() => setForecastCard(card)}
                  />
                ))}
              </div>
            ) : (
              <div className="fade-up-2">
                <HeatmapView cards={cards} podCapacityMap={podCapacityMap} onCardClick={card => navigate(`/spaces/${card.pod}`)} />
              </div>
            )}
          </div>

          {/* EOS Intelligence Panel */}
          <AnimatePresence>
            {showEOSPanel && (
              <EOSIntelligencePanel
                cards={cards}
                onClose={() => setShowEOSPanel(false)}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      <CreateSpaceDrawer open={showCreateDrawer} onClose={() => setShowCreateDrawer(false)} />

      {/* Modals */}
      <AnimatePresence>
        {forecastCard && <HealthForecastModal card={forecastCard} onClose={() => setForecastCard(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {cascadeCard && <BlockerCascadeModal card={cascadeCard} onClose={() => setCascadeCard(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {retroCard && <RetroModal card={retroCard} onClose={() => setRetroCard(null)} />}
      </AnimatePresence>
    </div>
  );
}

/* ── Pod Card (grid) ──────────────────────────────────────────────────────── */

function PodCardComponent({
  card, allCards: _allCards, delay, onClick, canDelete, onDelete, onEOS, onForecast, onCascade, onRetro,
}: {
  card: PodCard;
  allCards: PodCard[];
  delay: number;
  onClick: () => void;
  canDelete?: boolean;
  onDelete?: () => void;
  onEOS?: () => void;
  onForecast?: () => void;
  onCascade?: () => void;
  onRetro?: () => void;
}) {
  const { color } = card;
  const health      = card.healthScore;
  const hColor      = healthColor(health);
  const spark       = normalizeTrend(card.trend);
  const anomaly     = anomalyTag(card);
  const sprintColor = card.hasActiveSprint ? "var(--green)" : "var(--text-3)";
  const prediction  = card.hasActiveSprint ? card.sprintPrediction : null;
  const predColor   = prediction == null ? "var(--text-3)" : prediction >= 70 ? "var(--green)" : prediction >= 50 ? "var(--amber)" : "var(--red)";
  const conf        = card.deliveryConfidence;

  return (
    <motion.div
      className={styles.card}
      style={{ animationDelay: `${delay}s` }}
      whileHover={{ y: -3, transition: { duration: 0.18 } }}
      onClick={onClick}
    >
      <div className={styles.cardAccent} style={{ background: color }} />

      {/* Top row */}
      <div className={styles.cardTop}>
        <div className={styles.cardTitleGroup}>
          <div className={styles.cardTitle}>{card.pod}</div>
          <div className={styles.cardMeta}>
            <span className={styles.sprintBadge} style={{ color: sprintColor, background: `${sprintColor}18` }}>
              {card.hasActiveSprint ? "Active Sprint" : "No Sprint"}
            </span>
            {card.sprintName && (
              <span className={styles.sprintName}>{card.sprintName}</span>
            )}
            {/* Sprint outcome predictor (Gen 2) */}
            {prediction !== null && (
              <span className={styles.predPill} style={{ color: predColor, background: `${predColor}15`, borderColor: `${predColor}30` }}>
                {prediction}% likely
              </span>
            )}
            {anomaly && (
              <span className={styles.anomalyTag}>
                <RiAlertLine size={9} /> {anomaly}
              </span>
            )}
          </div>
        </div>

        {/* Health score — click for forecast (Gen 3) */}
        <Tooltip title="View health forecast" arrow placement="top">
          <div
            className={styles.healthBadge}
            style={{ color: hColor, borderColor: `${hColor}33`, background: `${hColor}10`, cursor: "pointer" }}
            onClick={(e) => { e.stopPropagation(); onForecast?.(); }}
          >
            <span className={styles.healthVal}>{health}</span>
            <span className={styles.healthLbl}>health</span>
          </div>
        </Tooltip>
      </div>

      {/* Ticket stats — blocked is clickable for cascade (Gen 2) */}
      <div className={styles.ticketStats}>
        <div className={styles.tStat}>
          <span className={styles.tStatVal} style={{ color: "var(--green)" }}>{card.completedTickets.toLocaleString()}</span>
          <span className={styles.tStatLbl}>Done</span>
        </div>
        <div className={styles.tStatDivider} />
        <div className={styles.tStat}>
          <span className={styles.tStatVal} style={{ color: "var(--amber)" }}>{card.inProgressTickets.toLocaleString()}</span>
          <span className={styles.tStatLbl}>Active</span>
        </div>
        <div className={styles.tStatDivider} />
        <Tooltip title={card.blockedTickets > 0 ? "View blocker cascade" : "No blockers"} arrow>
          <div
            className={`${styles.tStat} ${card.blockedTickets > 0 ? styles.tStatClickable : ""}`}
            onClick={(e) => { if (card.blockedTickets > 0) { e.stopPropagation(); onCascade?.(); } }}
          >
            <span className={styles.tStatVal} style={{ color: "var(--red)" }}>{card.blockedTickets.toLocaleString()}</span>
            <span className={styles.tStatLbl}>Blocked</span>
          </div>
        </Tooltip>
        <div className={styles.tStatDivider} />
        <div className={styles.tStat}>
          <span className={styles.tStatVal}>{card.totalTickets.toLocaleString()}</span>
          <span className={styles.tStatLbl}>Total</span>
        </div>
      </div>

      {/* Delivery confidence progress (Gen 3) */}
      <div className={styles.progressSection}>
        <div className={styles.progressHeader}>
          <span className={styles.progressLabel}>Delivery Confidence</span>
          <span className={styles.progressVal} style={{ color }}>{conf}%</span>
        </div>
        <LinearProgress
          variant="determinate"
          value={conf}
          sx={{
            height: 4,
            borderRadius: 100,
            backgroundColor: "var(--surface-2)",
            "& .MuiLinearProgress-bar": {
              background: `linear-gradient(90deg, ${color}, ${color}cc)`,
              borderRadius: 100,
            },
          }}
        />
      </div>

      {/* Footer: sparkline + actions */}
      <div className={styles.cardFooter}>
        <div className={styles.sparkline}>
          {spark.map((v, i) => (
            <div
              key={i}
              className={styles.sparkBar}
              style={{ height: `${v * 100}%`, background: color, opacity: 0.45 + v * 0.55 }}
            />
          ))}
        </div>

        <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
          {/* Auto-retro button (Gen 3) */}
          {card.hasActiveSprint && (
            <Tooltip title="Generate sprint retrospective" arrow placement="top">
              <button className={styles.retroBtn} onClick={onRetro}>
                <RiCalendarCheckLine size={12} />
              </button>
            </Tooltip>
          )}
          <Tooltip title={`Ask EOS about ${card.pod}`} arrow placement="top">
            <button className={styles.eosBtn} onClick={onEOS}>
              <RiSparklingLine size={13} />
            </button>
          </Tooltip>
          {canDelete && (
            <Tooltip title="Delete space" arrow placement="top">
              <button className={styles.deleteBtn} onClick={onDelete}>
                <RiDeleteBinLine size={13} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Pod Row (list) ───────────────────────────────────────────────────────── */

function PodRow({
  card, onClick, canDelete, onDelete, onForecast,
}: {
  card: PodCard;
  onClick: () => void;
  canDelete?: boolean;
  onDelete?: () => void;
  onForecast?: () => void;
}) {
  const { color } = card;
  const health     = card.healthScore;
  const hColor     = healthColor(health);
  const anomaly    = anomalyTag(card);
  const prediction = card.hasActiveSprint ? card.sprintPrediction : null;
  const predColor  = prediction == null ? "var(--text-3)" : prediction >= 70 ? "var(--green)" : prediction >= 50 ? "var(--amber)" : "var(--red)";
  const conf       = card.deliveryConfidence;

  return (
    <div className={styles.listRow} onClick={onClick}>
      <div className={styles.listColorBar} style={{ background: color }} />
      <div className={styles.listKey} style={{ color }}>{card.pod}</div>
      <div className={styles.listInfo}>
        <div className={styles.listName}>{card.pod}</div>
        <div className={styles.listDesc}>
          {card.totalTickets.toLocaleString()} tickets · {card.completedTickets.toLocaleString()} done
          {card.sprintName ? ` · ${card.sprintName}` : ""}
        </div>
      </div>

      {prediction !== null && (
        <span className={styles.listPredPill} style={{ color: predColor }}>
          {prediction}% sprint
        </span>
      )}

      {anomaly && (
        <span className={styles.listAnomalyTag}>
          <RiAlertLine size={10} /> {anomaly}
        </span>
      )}

      <Tooltip title="View health forecast" arrow>
        <div
          className={styles.listHealthBadge}
          style={{ color: hColor, cursor: "pointer" }}
          onClick={(e) => { e.stopPropagation(); onForecast?.(); }}
        >
          {health}
        </div>
      </Tooltip>

      <div style={{ width: 100 }}>
        <LinearProgress
          variant="determinate"
          value={conf}
          sx={{
            height: 4,
            borderRadius: 100,
            backgroundColor: "var(--surface-2)",
            "& .MuiLinearProgress-bar": {
              background: `linear-gradient(90deg, ${color}, ${color}cc)`,
              borderRadius: 100,
            },
          }}
        />
      </div>
      <span style={{ fontSize: 12, color, fontWeight: 700, minWidth: 36, textAlign: "right" }}>
        {conf}%
      </span>

      {canDelete && (
        <Tooltip title="Delete space" arrow>
          <button
            className={styles.deleteBtn}
            onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
          >
            <RiDeleteBinLine size={13} />
          </button>
        </Tooltip>
      )}
    </div>
  );
}
