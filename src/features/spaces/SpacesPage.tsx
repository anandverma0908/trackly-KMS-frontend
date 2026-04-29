import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Tooltip from "@mui/material/Tooltip";
import LinearProgress from "@mui/material/LinearProgress";
import toast from "react-hot-toast";
import {
  fetchPodSummary,
  fetchAnomalies,
  fetchDependencies,
  fetchCapacity,
  fetchSelfOrg,
  fetchSprintDraft,
  fetchHealthForecast,
  deleteSpace,
  createSprint,
  generateSprintRetro,
  type PodSummary,
  type SpaceAnomaly,
  type SpaceDependency,
  type SprintDraftResult,
  type HealthForecastResult,
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
import SideDrawer from "@/components/ui/SideDrawer";

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
  if ((card.sprintPrediction ?? 100) < 50 && card.hasActiveSprint)
    return "Sprint at risk";
  if (card.riskFlags.bug_rate > 30) return "Quality risk";
  return null;
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
  sprintId: string | null;
  totalHours: number;
  healthScore: number;
  deliveryConfidence: number;
  sprintPrediction: number | null;
  trend: number[];
  riskFlags: {
    blocked: number;
    overdue: number;
    bug_rate: number;
    stale: number;
  };
}

const DONE_KEYS = ["Done", "Closed", "Resolved"];
const ACTIVE_KEYS = ["In Progress", "In Development", "Development Ready"];
const BLOCK_KEYS = ["Blocked"];

function buildPodCard(p: PodSummary): PodCard {
  const total = Object.values(p.statuses).reduce((a, b) => a + b, 0);
  const done = DONE_KEYS.reduce((a, k) => a + (p.statuses[k] ?? 0), 0);
  const active = ACTIVE_KEYS.reduce((a, k) => a + (p.statuses[k] ?? 0), 0);
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
    sprintId: p.active_sprint_id ?? null,
    totalHours: p.total_hours,
    healthScore: p.health_score ?? 0,
    deliveryConfidence: p.delivery_confidence ?? 0,
    sprintPrediction: p.sprint_prediction ?? null,
    trend: p.trend ?? [],
    riskFlags: p.risk_flags ?? {
      blocked: 0,
      overdue: 0,
      bug_rate: 0,
      stale: 0,
    },
  };
}

/* ── Health Forecast Modal (Gen 3) ─────────────────────────────────────────── */

function HealthForecastModal({
  card,
  onClose,
}: {
  card: PodCard;
  onClose: () => void;
}) {
  const {
    data: forecast,
    isLoading,
    isError,
    refetch,
  } = useQuery<HealthForecastResult>({
    queryKey: ["health-forecast", card.pod],
    queryFn: () => fetchHealthForecast(card.pod),
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  const conf = forecast?.delivery_confidence ?? card.deliveryConfidence;
  const hColor = healthColor(forecast?.health_score ?? card.healthScore);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <motion.div
        className={styles.forecastModal}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.18 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <RiBarChartLine size={15} /> Space Health Forecast — {card.pod}
          </div>
          <button className={styles.modalClose} onClick={onClose}>
            <RiCloseLine size={17} />
          </button>
        </div>

        <div className={styles.forecastBody}>
          {isLoading ? (
            <div className={styles.eosEmpty}>EOS is analysing {card.pod}…</div>
          ) : isError ? (
            <div className={styles.forecastErrorState}>
              <RiAlertLine size={18} />
              <span>Could not load forecast — EOS may be unavailable</span>
              <button
                className={styles.forecastRetryBtn}
                onClick={() => refetch()}
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {(forecast?.missed_weeks ?? 0) > 0 ? (
                <div className={styles.forecastAlert}>
                  <RiAlertLine size={13} />
                  {forecast!.summary}
                </div>
              ) : (
                <div className={styles.forecastGood}>
                  <RiSparklingLine size={13} />{" "}
                  {forecast?.summary ?? `${card.pod} is on track`}
                </div>
              )}

              <div className={styles.forecastConfRow}>
                <span className={styles.forecastConfLabel}>
                  Delivery confidence
                </span>
                <div className={styles.forecastConfBar}>
                  <div
                    className={styles.forecastConfFill}
                    style={{ width: `${conf}%`, background: hColor }}
                  />
                </div>
                <span
                  className={styles.forecastConfVal}
                  style={{ color: hColor }}
                >
                  {conf}%
                </span>
              </div>

              {(forecast?.options ?? []).length > 0 && (
                <>
                  <div className={styles.forecastSectionTitle}>
                    EOS Course-Correction Options
                  </div>
                  <div className={styles.forecastOptions}>
                    {forecast!.options.map((opt, i) => (
                      <div key={i} className={styles.forecastOption}>
                        <div className={styles.forecastOptionNum}>{i + 1}</div>
                        <div className={styles.forecastOptionBody}>
                          <div className={styles.forecastOptionLabel}>
                            {opt.label}
                          </div>
                          <div className={styles.forecastOptionMeta}>
                            <span className={styles.forecastImpact}>
                              {opt.impact}
                            </span>
                            <span className={styles.forecastRisk}>
                              Risk: {opt.risk}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ── Blocker Cascade Modal (Gen 2) ─────────────────────────────────────────── */

function BlockerCascadeModal({
  card,
  onClose,
}: {
  card: PodCard;
  onClose: () => void;
}) {
  const {
    data: deps = [],
    isLoading: loadingDeps,
    isError: depsError,
  } = useQuery({
    queryKey: ["space-deps"],
    queryFn: fetchDependencies,
    staleTime: 1000 * 60 * 5,
  });

  // Group deps for this pod by affected pod
  const impactMap: Record<string, SpaceDependency[]> = {};
  for (const d of deps.filter(
    (d: SpaceDependency) => d.from_pod === card.pod,
  )) {
    if (!impactMap[d.to_pod]) impactMap[d.to_pod] = [];
    impactMap[d.to_pod].push(d);
  }
  const impacts = Object.entries(impactMap).map(([pod, ds]) => ({
    pod,
    tickets: ds.length,
  }));
  const total = impacts.reduce((a, c) => a + c.tickets, 0);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <motion.div
        className={styles.cascadeModal}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.18 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <RiOrganizationChart size={15} /> Blocker Cascade — {card.pod}
          </div>
          <button className={styles.modalClose} onClick={onClose}>
            <RiCloseLine size={17} />
          </button>
        </div>

        <div className={styles.cascadeBody}>
          {loadingDeps ? (
            <div className={styles.eosEmpty}>Loading dependency map…</div>
          ) : depsError ? (
            <div className={styles.forecastErrorState}>
              <RiAlertLine size={16} />
              <span>Could not load dependency data</span>
            </div>
          ) : (
            <>
              <div className={styles.cascadeOrigin}>
                <div
                  className={styles.cascadeOriginDot}
                  style={{ background: card.color }}
                />
                <div>
                  <div className={styles.cascadeOriginName}>{card.pod}</div>
                  <div className={styles.cascadeOriginSub}>
                    {card.blockedTickets} blocked tickets
                  </div>
                </div>
              </div>

              <div className={styles.cascadeChain}>
                {impacts.length === 0 ? (
                  <div className={styles.eosEmpty} style={{ marginTop: 8 }}>
                    No downstream pods impacted
                  </div>
                ) : (
                  impacts.map((imp, i) => (
                    <div key={i} className={styles.cascadeImpactRow}>
                      <div className={styles.cascadeChainLine} />
                      <RiArrowRightLine
                        size={14}
                        className={styles.cascadeArrow}
                      />
                      <div className={styles.cascadeImpactCard}>
                        <span className={styles.cascadeImpactPod}>
                          {imp.pod}
                        </span>
                        <span className={styles.cascadeImpactCount}>
                          {imp.tickets} ticket{imp.tickets !== 1 ? "s" : ""} at
                          risk
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className={styles.cascadeFooter}>
                <RiSparklingLine size={12} />
                EOS estimates{" "}
                <strong>
                  {total} cross-space ticket{total !== 1 ? "s" : ""}
                </strong>{" "}
                potentially impacted if blockers persist beyond this sprint
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ── Retro helpers ──────────────────────────────────────────────────────────── */

interface RetroSection {
  heading: string;
  body: string;
}
interface RetroToken {
  type: "subheading" | "bullet" | "para";
  text: string;
}

/** True for lines that are purely decorative separators like ---, ===, *** */
function isSeparator(line: string): boolean {
  return /^[\s\-=*_~#>|]{0,3}[-=*_~]{3,}[\s\-=*_~#>|]*$/.test(line.trim());
}

/** Strip emoji characters and excess whitespace */
function stripEmoji(s: string): string {
  return s
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\u{FE0F}\u{FE0E}\u{200D}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Strip markdown syntax characters from a string, keeping readable text */
function cleanText(s: string): string {
  return stripEmoji(
    s
      .replace(/\*\*(.*?)\*\*/g, "$1") // bold markers
      .replace(/\*(.*?)\*/g, "$1") // italic markers
      .replace(/_{2}(.*?)_{2}/g, "$1") // underline markers
      .replace(/`(.*?)`/g, "$1") // code markers
      .replace(/^#+\s*/, "") // leading hashes
      .replace(/[-*•]\s+/g, "") // bullet markers anywhere inline
      .trim(),
  );
}

/** Render text with **bold** as <strong> but strip the ** chars */
function renderInlineBold(raw: string): React.ReactNode {
  const cleaned = stripEmoji(raw);
  const parts = cleaned.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    /^\*\*[^*]+\*\*$/.test(p) ? <strong key={i}>{p.slice(2, -2)}</strong> : p,
  );
}

/** Pre-process raw LLM text: remove separator lines, strip preamble before first ## */
function preprocessRetro(raw: string): string {
  const lines = raw.split("\n");
  const firstSection = lines.findIndex((l) => /^##\s/.test(l.trim()));
  const body = firstSection > 0 ? lines.slice(firstSection) : lines;
  return body.filter((l) => !isSeparator(l)).join("\n");
}

function parseRetro(text: string): RetroSection[] {
  const cleaned = preprocessRetro(text);
  return cleaned
    .split(/\n(?=##\s)/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const nl = s.indexOf("\n");
      const rawHead = (nl === -1 ? s : s.slice(0, nl))
        .replace(/^#+\s*/, "")
        .trim();
      const heading = stripEmoji(rawHead);
      const body = nl === -1 ? "" : s.slice(nl + 1).trim();
      return { heading, body };
    })
    .filter((sec) => sec.heading.length > 0);
}

function tokenizeBody(body: string): RetroToken[] {
  return body
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() && !isSeparator(l))
    .map((line) => {
      const t = line.trim();
      if (/^#{2,}\s/.test(t))
        return { type: "subheading" as const, text: cleanText(t) };
      if (/^[-*•]\s/.test(t))
        return {
          type: "bullet" as const,
          text: stripEmoji(t.replace(/^[-*•]\s*/, "")),
        };
      return { type: "para" as const, text: stripEmoji(t) };
    })
    .filter((tok) => tok.text.length > 0);
}

function sectionMeta(heading: string): {
  color: string;
  bg: string;
  icon: React.ReactNode;
} {
  const h = heading.toLowerCase();
  if (h.includes("well") || h.includes("win") || h.includes("success"))
    return {
      color: "var(--green)",
      bg: "var(--green-glow)",
      icon: <RiCheckLine size={12} />,
    };
  if (
    h.includes("improve") ||
    h.includes("better") ||
    h.includes("could") ||
    h.includes("challenge")
  )
    return {
      color: "var(--amber)",
      bg: "var(--amber-glow)",
      icon: <RiAlertLine size={12} />,
    };
  if (
    h.includes("action") ||
    h.includes("next") ||
    h.includes("todo") ||
    h.includes("plan")
  )
    return {
      color: "var(--accent)",
      bg: "var(--accent-glow)",
      icon: <RiFlashlightLine size={12} />,
    };
  if (
    h.includes("metric") ||
    h.includes("stat") ||
    h.includes("summary") ||
    h.includes("velocity")
  )
    return {
      color: "var(--accent-2)",
      bg: "rgba(129,140,248,0.1)",
      icon: <RiBarChartLine size={12} />,
    };
  return {
    color: "var(--text-2)",
    bg: "var(--surface-2)",
    icon: <RiSparklingLine size={12} />,
  };
}

function RetroSection({ section }: { section: RetroSection }) {
  const { color, bg, icon } = sectionMeta(section.heading);
  const tokens = tokenizeBody(section.body);

  return (
    <div className={styles.retroSection2}>
      <div
        className={styles.retroSectionHeader}
        style={{ color, background: bg }}
      >
        <span className={styles.retroSectionHeaderIcon}>{icon}</span>
        {section.heading}
      </div>
      <div className={styles.retroSectionBody}>
        {tokens.map((token, i) => {
          if (token.type === "subheading")
            return (
              <div key={i} className={styles.retroSubheading}>
                {token.text}
              </div>
            );
          if (token.type === "bullet")
            return (
              <div key={i} className={styles.retroLine}>
                <span
                  className={styles.retroLineDot}
                  style={{ background: color }}
                />
                <span>{renderInlineBold(token.text)}</span>
              </div>
            );
          return (
            <p key={i} className={styles.retroPara}>
              {renderInlineBold(token.text)}
            </p>
          );
        })}
        {tokens.length === 0 && section.body && (
          <p className={styles.retroPara}>{cleanText(section.body)}</p>
        )}
      </div>
    </div>
  );
}

/* ── Retro version history (localStorage) ──────────────────────────────────── */

interface RetroVersion {
  id: string;
  generatedAt: string;
  text: string;
}

function retroKey(sprintId: string) {
  return `retro_v_${sprintId}`;
}

function loadHistory(sprintId: string): RetroVersion[] {
  try {
    return JSON.parse(localStorage.getItem(retroKey(sprintId)) ?? "[]");
  } catch {
    return [];
  }
}

function saveVersion(sprintId: string, text: string): RetroVersion[] {
  const prev = loadHistory(sprintId);
  const next: RetroVersion[] = [
    ...prev,
    { id: Date.now().toString(), generatedAt: new Date().toISOString(), text },
  ];
  localStorage.setItem(retroKey(sprintId), JSON.stringify(next));
  return next;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ── Retro Drawer ───────────────────────────────────────────────────────────── */

function RetroDrawer({
  card,
  onClose,
}: {
  card: PodCard;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<RetroVersion[]>(() =>
    card.sprintId ? loadHistory(card.sprintId) : [],
  );
  const [activeIdx, setActiveIdx] = useState<number>(() =>
    card.sprintId ? Math.max(0, loadHistory(card.sprintId).length - 1) : 0,
  );
  const [loading, setLoading] = useState(false);

  const active = history[activeIdx] ?? null;
  const sections = active ? parseRetro(active.text) : [];

  async function handleGenerate() {
    if (!card.sprintId) return;
    setLoading(true);
    try {
      const result = await generateSprintRetro(card.sprintId);
      const text = result.retro ?? result.content ?? JSON.stringify(result);
      const next = saveVersion(card.sprintId, text);
      setHistory(next);
      setActiveIdx(next.length - 1);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to generate retrospective");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SideDrawer
      open
      onClose={onClose}
      size="md"
      title="Sprint Retrospective"
      subtitle={card.sprintName ?? card.pod}
      avatar={
        <div
          className={styles.retroAvatarIcon}
          style={{
            background: `${card.color}22`,
            border: `1px solid ${card.color}44`,
          }}
        >
          <RiCalendarCheckLine size={16} style={{ color: card.color }} />
        </div>
      }
      badge={
        history.length > 0 ? (
          <span className={styles.retroEosBadge}>
            <RiSparklingLine size={10} /> EOS generated
          </span>
        ) : undefined
      }
      footer={
        <button
          className={styles.generateBtn}
          onClick={handleGenerate}
          disabled={!card.sprintId || loading}
        >
          <RiSparklingLine size={13} />
          {loading
            ? "Generating…"
            : card.sprintId
              ? history.length > 0
                ? "Regenerate"
                : "Generate Retro with EOS"
              : "No active sprint"}
        </button>
      }
    >
      {loading ? (
        /* ── Loading state ── */
        <div className={styles.retroDrawerLoading}>
          <div className={styles.retroDrawerLoadingDots}>
            <span />
            <span />
            <span />
          </div>
          <div className={styles.retroDrawerLoadingTitle}>
            EOS is analysing the sprint…
          </div>
          <div className={styles.retroDrawerLoadingSub}>
            Reading ticket data, velocity, and blockers
          </div>
        </div>
      ) : history.length === 0 ? (
        /* ── Idle state ── */
        <div className={styles.retroDrawerIdle}>
          <div
            className={styles.retroDrawerIdleGlow}
            style={{
              background: `radial-gradient(circle, ${card.color}22 0%, transparent 70%)`,
            }}
          />
          <div
            className={styles.retroDrawerIdleIcon}
            style={{
              color: card.color,
              borderColor: `${card.color}33`,
              background: `${card.color}11`,
            }}
          >
            <RiCalendarCheckLine size={28} />
          </div>
          <div className={styles.retroDrawerIdleTitle}>Ready to retrospect</div>
          <div className={styles.retroDrawerIdleSub}>
            EOS will analyse <strong>{card.sprintName ?? "this sprint"}</strong>{" "}
            — velocity, blockers, ticket patterns, and team cadence — to produce
            an actionable retrospective.
          </div>
          <div className={styles.retroDrawerIdlePills}>
            <span className={styles.retroDrawerIdlePill}>
              <RiCheckLine size={10} /> What went well
            </span>
            <span className={styles.retroDrawerIdlePill}>
              <RiAlertLine size={10} /> Improvements
            </span>
            <span className={styles.retroDrawerIdlePill}>
              <RiFlashlightLine size={10} /> Action items
            </span>
            <span className={styles.retroDrawerIdlePill}>
              <RiBarChartLine size={10} /> Metrics
            </span>
          </div>
          {!card.sprintId && (
            <div className={styles.retroDrawerNoSprint}>
              No active sprint found for this space
            </div>
          )}
        </div>
      ) : (
        /* ── Content ── */
        <div className={styles.retroDrawerContent}>
          {/* Version history bar */}
          {history.length > 1 && (
            <div className={styles.retroVersionBar}>
              <span className={styles.retroVersionLabel}>History</span>
              <div className={styles.retroVersionPills}>
                {history.map((v, i) => (
                  <button
                    key={v.id}
                    className={`${styles.retroVersionPill} ${i === activeIdx ? styles.retroVersionPillActive : ""}`}
                    onClick={() => setActiveIdx(i)}
                  >
                    v{i + 1}
                    <span className={styles.retroVersionPillDate}>
                      {fmtDate(v.generatedAt)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Meta strip */}
          <div className={styles.retroDrawerMeta}>
            <span
              className={styles.retroDrawerMetaPod}
              style={{
                color: card.color,
                background: `${card.color}15`,
                borderColor: `${card.color}30`,
              }}
            >
              {card.pod}
            </span>
            <span className={styles.retroDrawerMetaSprint}>
              {card.sprintName}
            </span>
            <span className={styles.retroDrawerMetaCount}>
              {sections.length} sections
            </span>
          </div>

          {sections.map((s, i) => (
            <RetroSection key={i} section={s} />
          ))}
        </div>
      )}
    </SideDrawer>
  );
}

/* ── EOS Intelligence Panel ────────────────────────────────────────────────── */

type EOSTab = "anomalies" | "deps" | "capacity" | "selforg" | "sprintdraft";

function EOSIntelligencePanel({
  open,
  cards,
  podCapacityMap,
  anomalies,
  loadingAnomalies,
  onClose,
}: {
  open: boolean;
  cards: PodCard[];
  podCapacityMap: Record<string, number>;
  anomalies: SpaceAnomaly[];
  loadingAnomalies: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<EOSTab>("anomalies");
  const [draftPod, setDraftPod] = useState<string | null>(
    cards[0]?.pod ?? null,
  );
  const [draftConfirmed, setDraftConfirmed] = useState(false);
  const [showAllDeps, setShowAllDeps] = useState<Record<string, boolean>>({});

  const confirmSprintMut = useMutation({
    mutationFn: ({
      pod,
      ticketKeys,
    }: {
      pod: string;
      ticketKeys: string[];
    }) => {
      const today = new Date();
      const end = new Date(today);
      end.setDate(end.getDate() + 14);
      return createSprint({
        name: `${pod} — EOS Draft Sprint`,
        goal: "AI-drafted sprint from backlog",
        start_date: today.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        project_id: pod,
        ticket_keys: ticketKeys,
      });
    },
    onSuccess: (_data, { pod }) => {
      setDraftConfirmed(true);
      qc.invalidateQueries({ queryKey: ["sprints"] });
      qc.invalidateQueries({ queryKey: ["pod-summary"] });
      toast.success(
        `Sprint created for ${pod} with ${_data ? "" : ""}drafted tickets`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: deps = [], isLoading: loadingDeps } = useQuery({
    queryKey: ["space-deps"],
    queryFn: fetchDependencies,
    staleTime: 1000 * 60 * 5,
  });

  const { data: selfOrgData, isLoading: loadingSelfOrg } = useQuery({
    queryKey: ["nova-self-org"],
    queryFn: fetchSelfOrg,
    staleTime: 1000 * 60 * 30,
    enabled: tab === "selforg",
  });

  const {
    data: draftData,
    isLoading: draftLoading,
    refetch: refetchDraft,
  } = useQuery({
    queryKey: ["nova-sprint-draft", draftPod],
    queryFn: () => fetchSprintDraft(draftPod!),
    staleTime: 1000 * 60 * 15,
    enabled: !!draftPod && tab === "sprintdraft",
  });

  // Group deps by from_pod
  const depsByPod = useMemo<Record<string, SpaceDependency[]>>(() => {
    const map: Record<string, SpaceDependency[]> = {};
    for (const d of deps) {
      if (!map[d.from_pod]) map[d.from_pod] = [];
      map[d.from_pod].push(d);
    }
    return map;
  }, [deps]);

  const selfOrgSuggestions = selfOrgData?.suggestions ?? [];
  const draftCard = cards.find((c) => c.pod === draftPod) ?? cards[0];

  const tabs: {
    id: EOSTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    {
      id: "anomalies",
      label: "Anomalies",
      icon: <RiFireLine size={13} />,
      badge: anomalies.length,
    },
    {
      id: "deps",
      label: "Deps",
      icon: <RiGitMergeLine size={13} />,
      badge: Object.keys(depsByPod).length,
    },
    { id: "capacity", label: "Capacity", icon: <RiTeamLine size={13} /> },
    { id: "selforg", label: "Self-Org", icon: <RiExchangeLine size={13} /> },
    {
      id: "sprintdraft",
      label: "Sprint Draft",
      icon: <RiFlashlightLine size={13} />,
    },
  ];

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      size="sm"
      title="EOS Intelligence"
      avatar={
        <div className={styles.eosDrawerAvatar}>
          <RiBrainLine size={16} />
        </div>
      }
      badge={
        anomalies.length > 0 ? (
          <span className={styles.eosIntelBadge}>{anomalies.length}</span>
        ) : undefined
      }
    >
      <div className={styles.eosTabs}>
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`${styles.eosTab} ${tab === t.id ? styles.eosTabActive : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.icon} {t.label}
            {t.badge ? (
              <span className={styles.eosTabBadge}>{t.badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className={styles.eosPanelBody}>
        {/* Anomalies */}
        {tab === "anomalies" && (
          <div className={styles.eosSection}>
            <div className={styles.eosSectionSub}>
              {loadingAnomalies
                ? "Scanning pods…"
                : `EOS detected ${anomalies.length} patterns requiring attention`}
            </div>
            {anomalies.length === 0 && !loadingAnomalies ? (
              <div className={styles.eosEmpty}>
                All spaces running healthy — no anomalies detected
              </div>
            ) : (
              anomalies.map((a: SpaceAnomaly, i) => {
                const card = cards.find((c) => c.pod === a.pod);
                const spark = normalizeTrend(card?.trend ?? []);
                return (
                  <div key={i} className={styles.anomalyItem}>
                    <div className={styles.anomalyItemTop}>
                      <div
                        className={styles.anomalyPodDot}
                        style={{ background: card?.color ?? "#8B8FA8" }}
                      />
                      <div className={styles.anomalyPodName}>{a.pod}</div>
                      <div
                        className={styles.anomalyHealth}
                        style={{ color: healthColor(card?.healthScore ?? 0) }}
                      >
                        {card?.healthScore ?? "—"}
                      </div>
                    </div>
                    <div className={styles.anomalyTag}>
                      <RiAlertLine size={10} /> {a.description}
                    </div>
                    {spark.length > 0 && (
                      <div className={styles.anomalyMiniSpark}>
                        {spark.map((v, j) => (
                          <div
                            key={j}
                            className={styles.anomalySparkBar}
                            style={{
                              height: `${Math.max(v, 0.05) * 100}%`,
                              background: card?.color ?? "#8B8FA8",
                            }}
                          />
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
            <div className={styles.eosSectionSub}>
              Cross-space blocker dependencies — cascade risk map
            </div>
            {loadingDeps ? (
              <div className={styles.eosEmpty}>Loading dependencies…</div>
            ) : Object.keys(depsByPod).length === 0 ? (
              <div className={styles.eosEmpty}>
                No cross-space dependencies detected this sprint
              </div>
            ) : (
              Object.entries(depsByPod).map(([fromPod, podDeps]) => {
                const card = cards.find((c) => c.pod === fromPod);
                const expanded = showAllDeps[fromPod] ?? false;
                const visible = expanded ? podDeps : podDeps.slice(0, 3);
                return (
                  <div key={fromPod} className={styles.depItem}>
                    <div className={styles.depOrigin}>
                      <div
                        className={styles.depDot}
                        style={{ background: card?.color ?? "#8B8FA8" }}
                      />
                      <span className={styles.depPodName}>{fromPod}</span>
                      <span className={styles.depBlockedCount}>
                        {podDeps.length} blocker
                        {podDeps.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className={styles.depImpacts}>
                      {visible.map((d, i) => (
                        <div key={i} className={styles.depImpactRow}>
                          <RiArrowRightLine size={11} />
                          <span className={styles.depImpactPod}>
                            {d.to_pod}
                          </span>
                          <span className={styles.depImpactCount}>
                            {d.blocker_ticket_key} — {d.blocker_summary}
                          </span>
                        </div>
                      ))}
                      {podDeps.length > 3 && (
                        <button
                          className={styles.depShowMore}
                          onClick={() =>
                            setShowAllDeps((prev) => ({
                              ...prev,
                              [fromPod]: !expanded,
                            }))
                          }
                        >
                          {expanded
                            ? "Show less"
                            : `+${podDeps.length - 3} more`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div className={styles.eosInsightNote}>
              <RiSparklingLine size={11} /> Blockers are detected via shared
              sprints and clients across spaces
            </div>
          </div>
        )}

        {/* Capacity */}
        {tab === "capacity" && (
          <div className={styles.eosSection}>
            <div className={styles.eosSectionSub}>
              Engineer capacity distribution across all spaces this sprint
            </div>
            {Object.keys(podCapacityMap).length === 0 ? (
              <div className={styles.eosEmpty}>
                No active sprint data — capacity unavailable
              </div>
            ) : (
              <>
                <div className={styles.capacityList}>
                  {cards.map((c) => {
                    const load = podCapacityMap[c.pod] ?? 0;
                    const loadColor =
                      load > 85
                        ? "var(--red)"
                        : load > 65
                          ? "var(--amber)"
                          : "var(--green)";
                    return (
                      <div key={c.pod} className={styles.capacityItem}>
                        <div className={styles.capacityPod}>
                          <div
                            className={styles.capacityDot}
                            style={{ background: c.color }}
                          />
                          <span>{c.pod}</span>
                        </div>
                        <div className={styles.capacityBarWrap}>
                          <div
                            className={styles.capacityBar}
                            style={{
                              width: `${Math.min(load, 100)}%`,
                              background: loadColor,
                            }}
                          />
                        </div>
                        <span
                          className={styles.capacityVal}
                          style={{ color: loadColor }}
                        >
                          {load}%
                        </span>
                      </div>
                    );
                  })}
                </div>
                {(() => {
                  const overloaded = cards.filter(
                    (c) => (podCapacityMap[c.pod] ?? 0) > 85,
                  );
                  const underloaded = cards.filter(
                    (c) =>
                      (podCapacityMap[c.pod] ?? 0) < 50 &&
                      (podCapacityMap[c.pod] ?? 0) > 0,
                  );
                  if (overloaded.length > 0 && underloaded.length > 0) {
                    return (
                      <div className={styles.staffingCard}>
                        <div className={styles.staffingTitle}>
                          <RiTeamLine size={13} /> Staffing Recommendation
                        </div>
                        <div className={styles.staffingBody}>
                          Consider moving engineers from{" "}
                          <strong>
                            {underloaded.map((c) => c.pod).join(", ")}
                          </strong>{" "}
                          (under-allocated) to{" "}
                          <strong>{overloaded[0].pod}</strong> (
                          {podCapacityMap[overloaded[0].pod]}% capacity) to
                          reduce sprint risk.
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className={styles.eosEmpty}>
                      Capacity is well-distributed across all spaces
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {/* Self-Org */}
        {tab === "selforg" && (
          <div className={styles.eosSection}>
            <div className={styles.eosSectionSub}>
              EOS topology analysis — recommendations to optimise pod structure
            </div>
            {loadingSelfOrg ? (
              <div className={styles.eosEmpty}>
                EOS is analysing pod topology…
              </div>
            ) : selfOrgSuggestions.length > 0 ? (
              selfOrgSuggestions.map((s, idx) => (
                <div key={idx} className={styles.selfOrgCard}>
                  <div className={styles.selfOrgHeader}>
                    <RiExchangeLine size={14} /> Suggestion{" "}
                    {selfOrgSuggestions.length > 1 ? idx + 1 : ""}
                  </div>
                  <div className={styles.selfOrgBody}>{s.reason}</div>
                  <div className={styles.selfOrgImpact}>
                    Urgency:{" "}
                    <strong
                      style={{
                        color:
                          s.urgency === "high"
                            ? "var(--red)"
                            : s.urgency === "medium"
                              ? "var(--amber)"
                              : "var(--green)",
                      }}
                    >
                      {s.urgency}
                    </strong>{" "}
                    · Confidence:{" "}
                    <strong>{Math.round(s.confidence * 100)}%</strong>
                  </div>
                  <div className={styles.selfOrgPods}>
                    <span className={styles.selfOrgPod}>{s.from_pod}</span>
                    <RiArrowRightLine size={13} />
                    <span className={styles.selfOrgPod}>{s.to_pod}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.eosEmpty}>
                Pod topology looks optimal — no restructuring needed right now
              </div>
            )}
            <div className={styles.eosInsightNote}>
              <RiSparklingLine size={11} />{" "}
              {selfOrgData?.nova_powered
                ? "EOS analysis powered by NOVA"
                : "Analysis based on health and capacity signals"}
            </div>
          </div>
        )}

        {/* Sprint Draft */}
        {tab === "sprintdraft" && (
          <div className={styles.eosSection}>
            <div className={styles.eosSectionSub}>
              EOS drafts next sprint from backlog — respecting capacity,
              priority, and dependencies
            </div>

            <div className={styles.draftPodPicker}>
              {cards.map((c) => (
                <button
                  key={c.pod}
                  className={`${styles.draftPodBtn} ${draftPod === c.pod ? styles.draftPodBtnActive : ""}`}
                  onClick={() => {
                    setDraftPod(c.pod);
                    setDraftConfirmed(false);
                  }}
                  style={{
                    borderColor: draftPod === c.pod ? c.color : undefined,
                    color: draftPod === c.pod ? c.color : undefined,
                  }}
                >
                  {c.pod}
                </button>
              ))}
            </div>

            {draftLoading ? (
              <div className={styles.eosEmpty}>
                EOS is drafting sprint for {draftPod}…
              </div>
            ) : draftData === null ? (
              <div className={styles.eosEmpty}>
                No backlog tickets available for {draftPod} — add tickets to the
                backlog first
              </div>
            ) : draftData ? (
              <>
                <div className={styles.draftMeta}>
                  <span>
                    Total points: <strong>{draftData.total_points} pts</strong>
                  </span>
                  <span>{draftData.tickets.length} tickets selected</span>
                </div>
                <div className={styles.draftTickets}>
                  {(draftData as SprintDraftResult).tickets.map((t, i) => (
                    <div key={i} className={styles.draftTicket}>
                      <span className={styles.draftTicketKey}>{t.key}</span>
                      <span className={styles.draftTicketTitle}>
                        {t.summary}
                      </span>
                      <span
                        className={styles.draftTicketPriority}
                        style={{
                          color:
                            t.priority.toLowerCase() === "high" ||
                            t.priority.toLowerCase() === "critical"
                              ? "var(--red)"
                              : t.priority.toLowerCase() === "medium"
                                ? "var(--amber)"
                                : "var(--text-3)",
                        }}
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
                  <button
                    className={styles.generateBtn}
                    disabled={confirmSprintMut.isPending}
                    onClick={() =>
                      draftPod &&
                      draftData &&
                      confirmSprintMut.mutate({
                        pod: draftPod,
                        ticketKeys: draftData.tickets.map((t) => t.key),
                      })
                    }
                  >
                    <RiFlashlightLine size={13} />
                    {confirmSprintMut.isPending
                      ? "Creating…"
                      : `Confirm and Create Sprint (${draftData.tickets.length} tickets)`}
                  </button>
                ) : (
                  <div className={styles.generatedNote}>
                    <RiCheckLine size={13} /> Sprint created for{" "}
                    {draftCard?.pod} with {draftData.tickets.length} tickets —
                    view in Sprints tab
                  </div>
                )}
              </>
            ) : (
              <button
                className={styles.generateBtn}
                onClick={() => refetchDraft()}
              >
                <RiFlashlightLine size={13} /> Draft Sprint with EOS
              </button>
            )}
          </div>
        )}
      </div>
    </SideDrawer>
  );
}

/* ── Heatmap View (Gen 2) ───────────────────────────────────────────────────── */

function HeatmapView({
  cards,
  podCapacityMap,
  onCardClick,
}: {
  cards: PodCard[];
  podCapacityMap: Record<string, number>;
  onCardClick: (c: PodCard) => void;
}) {
  return (
    <div className={styles.heatmapGrid}>
      {cards.map((card) => {
        const load = podCapacityMap[card.pod] ?? 0;
        const h = card.healthScore;
        const lColor =
          load > 85
            ? "var(--red)"
            : load > 65
              ? "var(--amber)"
              : "var(--green)";
        const hColor = healthColor(h);

        return (
          <motion.div
            key={card.pod}
            className={styles.heatCell}
            whileHover={{ y: -2 }}
            onClick={() => onCardClick(card)}
          >
            <div
              className={styles.heatCellAccent}
              style={{ background: card.color }}
            />
            <div className={styles.heatCellName}>{card.pod}</div>
            <div className={styles.heatCellRow}>
              <span className={styles.heatCellLabel}>Capacity</span>
              <span className={styles.heatCellVal} style={{ color: lColor }}>
                {load}%
              </span>
            </div>
            <div className={styles.heatBarWrap}>
              <div
                className={styles.heatBarFill}
                style={{ width: `${load}%`, background: lColor }}
              />
            </div>
            <div className={styles.heatCellRow} style={{ marginTop: 8 }}>
              <span className={styles.heatCellLabel}>Health</span>
              <span className={styles.heatCellVal} style={{ color: hColor }}>
                {h}
              </span>
            </div>
            <div className={styles.heatBarWrap}>
              <div
                className={styles.heatBarFill}
                style={{ width: `${h}%`, background: hColor }}
              />
            </div>
            <div className={styles.heatCellFooter}>
              <span>{card.totalTickets} tickets</span>
              {card.hasActiveSprint && (
                <span className={styles.heatActiveSprint}>Active sprint</span>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function SpacesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canManage =
    user?.role === "admin" || user?.role === "engineering_manager";

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "heatmap">("grid");
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [showEOSPanel, setShowEOSPanel] = useState(false);
  const [forecastCard, setForecastCard] = useState<PodCard | null>(null);
  const [cascadeCard, setCascadeCard] = useState<PodCard | null>(null);
  const [retroCard, setRetroCard] = useState<PodCard | null>(null);
  const [confirmDeletePod, setConfirmDeletePod] = useState<string | null>(null);

  const deleteMut = useMutation({
    mutationFn: deleteSpace,
    onSuccess: (_data, pod) => {
      toast.success(`Space "${pod}" deleted`);
      qc.invalidateQueries({ queryKey: ["pod-summary"] });
      qc.invalidateQueries({ queryKey: ["sprints"] });
      setConfirmDeletePod(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const {
    data: podSummaries = [],
    isLoading: loadingPods,
    isError: podsError,
  } = useQuery({
    queryKey: ["pod-summary"],
    queryFn: fetchPodSummary,
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });

  // Hoist anomalies query here so badge and panel always show the same count
  const { data: anomalies = [], isLoading: loadingAnomalies } = useQuery({
    queryKey: ["space-anomalies"],
    queryFn: fetchAnomalies,
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
    for (const r of capacityRows)
      map[r.pod] = Math.max(map[r.pod] ?? 0, r.capacity_pct);
    return map;
  }, [capacityRows]);

  const cards = useMemo<PodCard[]>(() => {
    return validPods
      .map((p) => buildPodCard(p))
      .filter(
        (c) => !search || c.pod.toLowerCase().includes(search.toLowerCase()),
      )
      .sort(
        (a, b) => b.totalTickets - a.totalTickets || a.pod.localeCompare(b.pod),
      );
  }, [validPods, search]);

  const stats = useMemo(
    () => ({
      total: cards.length,
      withSprints: cards.filter((c) => c.hasActiveSprint).length,
      totalHours: Math.round(cards.reduce((a, c) => a + c.totalHours, 0)),
      totalTickets: cards.reduce((a, c) => a + c.totalTickets, 0),
      blockedTickets: cards.reduce((a, c) => a + c.blockedTickets, 0),
    }),
    [cards],
  );

  // Badge uses backend anomaly count so it matches the EOS panel list
  const anomalyCount = anomalies.length;

  return (
    <div className={styles.page}>
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
              <button className={styles.clearBtn} onClick={() => setSearch("")}>
                ✕
              </button>
            )}
          </div>

          <div className={styles.headerActions}>
            {/* EOS Intelligence toggle (Gen 2/3/4) */}
            <Tooltip title="EOS Intelligence Panel" arrow>
              <button
                className={`${styles.eosIntelBtn} ${showEOSPanel ? styles.eosIntelBtnActive : ""}`}
                onClick={() => setShowEOSPanel((v) => !v)}
              >
                <RiBrainLine size={15} />
                EOS Intel
                {anomalyCount > 0 && (
                  <span className={styles.eosIntelBadge}>{anomalyCount}</span>
                )}
              </button>
            </Tooltip>

            {canManage && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowCreateDrawer(true)}
              >
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

        {/* Inline delete confirmation banner */}
        {confirmDeletePod && (
          <div className={styles.confirmBanner}>
            <RiAlertLine size={14} />
            <span>
              Delete <strong>{confirmDeletePod}</strong>? This removes all
              tickets, sprints, and epics.
            </span>
            <button
              className={styles.confirmBannerConfirm}
              onClick={() => deleteMut.mutate(confirmDeletePod)}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? "Deleting…" : "Yes, delete"}
            </button>
            <button
              className={styles.confirmBannerCancel}
              onClick={() => setConfirmDeletePod(null)}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Main content + EOS panel wrapper */}
        <div className={styles.contentArea}>
          <div className={styles.mainContent}>
            {loadingPods ? (
              <div className={styles.loading}>Loading spaces…</div>
            ) : podsError ? (
              <div className={styles.empty}>
                <div className={styles.emptyTitle}>Failed to load spaces</div>
                <div className={styles.emptyDesc}>
                  Check your connection or try refreshing the page
                </div>
              </div>
            ) : validPods.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyTitle}>No spaces yet</div>
                <div className={styles.emptyDesc}>
                  {canManage
                    ? "Create your first space to get started"
                    : "No spaces have been created yet"}
                </div>
              </div>
            ) : cards.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyTitle}>
                  No results for "{search}"
                </div>
                <div className={styles.emptyDesc}>
                  Try a different search term
                </div>
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
                    onDelete={() => setConfirmDeletePod(card.pod)}
                    onEOS={() =>
                      navigate(`/eos?pod=${encodeURIComponent(card.pod)}`)
                    }
                    onForecast={() => setForecastCard(card)}
                    onCascade={() =>
                      card.blockedTickets > 0 && setCascadeCard(card)
                    }
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
                    onDelete={() => setConfirmDeletePod(card.pod)}
                    onForecast={() => setForecastCard(card)}
                    onCascade={() =>
                      card.blockedTickets > 0 && setCascadeCard(card)
                    }
                    onRetro={() => setRetroCard(card)}
                    onEOS={() =>
                      navigate(`/eos?pod=${encodeURIComponent(card.pod)}`)
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="fade-up-2">
                <HeatmapView
                  cards={cards}
                  podCapacityMap={podCapacityMap}
                  onCardClick={(card) => navigate(`/spaces/${card.pod}`)}
                />
              </div>
            )}
          </div>

          {/* EOS Intelligence Panel */}
          <EOSIntelligencePanel
            open={showEOSPanel}
            cards={cards}
            podCapacityMap={podCapacityMap}
            anomalies={anomalies}
            loadingAnomalies={loadingAnomalies}
            onClose={() => setShowEOSPanel(false)}
          />
        </div>
      </div>

      <CreateSpaceDrawer
        open={showCreateDrawer}
        onClose={() => setShowCreateDrawer(false)}
      />

      {/* Modals */}
      <AnimatePresence>
        {forecastCard && (
          <HealthForecastModal
            card={forecastCard}
            onClose={() => setForecastCard(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {cascadeCard && (
          <BlockerCascadeModal
            card={cascadeCard}
            onClose={() => setCascadeCard(null)}
          />
        )}
      </AnimatePresence>
      {retroCard && (
        <RetroDrawer card={retroCard} onClose={() => setRetroCard(null)} />
      )}
    </div>
  );
}

/* ── Pod Card (grid) ──────────────────────────────────────────────────────── */

function PodCardComponent({
  card,
  allCards: _allCards,
  delay,
  onClick,
  canDelete,
  onDelete,
  onEOS,
  onForecast,
  onCascade,
  onRetro,
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
  const health = card.healthScore;
  const hColor = healthColor(health);
  const spark = normalizeTrend(card.trend);
  const anomaly = anomalyTag(card);
  const sprintColor = card.hasActiveSprint ? "var(--green)" : "var(--text-2)";
  const prediction = card.hasActiveSprint ? card.sprintPrediction : null;
  const predColor =
    prediction == null
      ? "var(--text-2)"
      : prediction >= 70
        ? "var(--green)"
        : prediction >= 50
          ? "var(--amber)"
          : "var(--red)";
  // Only show delivery confidence when a sprint exists — 0 without a sprint is meaningless
  const conf = card.hasActiveSprint ? card.deliveryConfidence : null;

  return (
    <motion.div
      className={styles.card}
      style={{ animationDelay: `${delay}s` }}
      whileHover={{ y: -3, transition: { duration: 0.18 } }}
      onClick={onClick}
    >
      {/* <div className={styles.cardAccent} style={{ background: color }} /> */}

      {/* Top row */}
      <div className={styles.cardTop}>
        <div className={styles.cardTitleGroup}>
          <div className={styles.cardTitle}>{card.pod}</div>
          <div className={styles.cardMeta}>
            <span
              className={styles.sprintBadge}
              style={{ color: sprintColor, background: `${sprintColor}18` }}
            >
              {card.hasActiveSprint
                ? `Active ${card.sprintName?.split("—")[1]}`
                : "No Sprint"}
            </span>

            {/* Sprint outcome predictor (Gen 2) */}
            {prediction !== null && (
              <span
                className={styles.predPill}
                style={{
                  color: predColor,
                  background: `${predColor}15`,
                  borderColor: `${predColor}30`,
                }}
              >
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
            style={{
              color: hColor,
              borderColor: `${hColor}33`,
              background: `${hColor}10`,
              cursor: "pointer",
            }}
            onClick={(e) => {
              e.stopPropagation();
              onForecast?.();
            }}
          >
            <span className={styles.healthVal}>{health}</span>
            <span className={styles.healthLbl}>health</span>
          </div>
        </Tooltip>
      </div>

      {/* Ticket stats — blocked is clickable for cascade (Gen 2) */}
      <div className={styles.ticketStats}>
        <div className={styles.tStat}>
          <span className={styles.tStatVal} style={{ color: "var(--green)" }}>
            {card.completedTickets.toLocaleString()}
          </span>
          <span className={styles.tStatLbl}>Done</span>
        </div>
        <div className={styles.tStatDivider} />
        <div className={styles.tStat}>
          <span className={styles.tStatVal} style={{ color: "var(--amber)" }}>
            {card.inProgressTickets.toLocaleString()}
          </span>
          <span className={styles.tStatLbl}>Active</span>
        </div>
        <div className={styles.tStatDivider} />
        <Tooltip
          title={
            card.blockedTickets > 0 ? "View blocker cascade" : "No blockers"
          }
          arrow
        >
          <div
            className={`${styles.tStat} ${card.blockedTickets > 0 ? styles.tStatClickable : ""}`}
            onClick={(e) => {
              if (card.blockedTickets > 0) {
                e.stopPropagation();
                onCascade?.();
              }
            }}
          >
            <span className={styles.tStatVal} style={{ color: "var(--red)" }}>
              {card.blockedTickets.toLocaleString()}
            </span>
            <span className={styles.tStatLbl}>Blocked</span>
          </div>
        </Tooltip>
        <div className={styles.tStatDivider} />
        <div className={styles.tStat}>
          <span className={styles.tStatVal}>
            {card.totalTickets.toLocaleString()}
          </span>
          <span className={styles.tStatLbl}>Total</span>
        </div>
      </div>

      {/* Delivery confidence — only shown when sprint exists */}
      {conf !== null ? (
        <div className={styles.progressSection}>
          <div className={styles.progressHeader}>
            <span className={styles.progressLabel}>Delivery Confidence</span>
            <span className={styles.progressVal} style={{ color }}>
              {conf}%
            </span>
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
      ) : (
        <div className={styles.progressSection}>
          <span
            className={styles.progressLabel}
            style={{ color: "var(--text-3)", fontSize: 11 }}
          >
            No active sprint
          </span>
        </div>
      )}

      {/* Footer: sparkline + actions */}
      <div className={styles.cardFooter}>
        <div className={styles.sparkline}>
          {spark.length > 0 && spark.some((v) => v > 0) ? (
            spark.map((v, i) => (
              <div
                key={i}
                className={styles.sparkBar}
                style={{
                  height: `${Math.max(v * 100, 4)}%`,
                  background: color,
                  opacity: 0.45 + v * 0.55,
                }}
              />
            ))
          ) : (
            <span className={styles.sparkEmpty}>—</span>
          )}
        </div>

        <div
          className={styles.cardActions}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Auto-retro button (Gen 3) */}
          {card.hasActiveSprint && (
            <Tooltip
              title="Generate sprint retrospective"
              arrow
              placement="top"
            >
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
  card,
  onClick,
  canDelete,
  onDelete,
  onForecast,
  onCascade,
  onRetro,
  onEOS,
}: {
  card: PodCard;
  onClick: () => void;
  canDelete?: boolean;
  onDelete?: () => void;
  onForecast?: () => void;
  onCascade?: () => void;
  onRetro?: () => void;
  onEOS?: () => void;
}) {
  const { color } = card;
  const health = card.healthScore;
  const hColor = healthColor(health);
  const anomaly = anomalyTag(card);
  const prediction = card.hasActiveSprint ? card.sprintPrediction : null;
  const predColor =
    prediction == null
      ? "var(--text-2)"
      : prediction >= 70
        ? "var(--green)"
        : prediction >= 50
          ? "var(--amber)"
          : "var(--red)";
  const conf = card.hasActiveSprint ? card.deliveryConfidence : null;

  return (
    <div className={styles.listRow} onClick={onClick}>
      <div className={styles.listColorBar} style={{ background: color }} />
      <div className={styles.listKey} style={{ color }}>
        {card.pod}
      </div>
      <div className={styles.listInfo}>
        <div className={styles.listName}>{card.pod}</div>
        <div className={styles.listDesc}>
          {card.totalTickets.toLocaleString()} tickets ·{" "}
          {card.completedTickets.toLocaleString()} done
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
          onClick={(e) => {
            e.stopPropagation();
            onForecast?.();
          }}
        >
          {health}
        </div>
      </Tooltip>

      {conf !== null ? (
        <>
          <div style={{ width: 80 }}>
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
          <span
            style={{
              fontSize: 12,
              color,
              fontWeight: 700,
              minWidth: 36,
              textAlign: "right",
            }}
          >
            {conf}%
          </span>
        </>
      ) : (
        <span
          style={{
            fontSize: 11,
            color: "var(--text-3)",
            minWidth: 120,
            textAlign: "right",
          }}
        >
          No active sprint
        </span>
      )}

      <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
        {card.hasActiveSprint && onRetro && (
          <Tooltip title="Generate sprint retrospective" arrow>
            <button className={styles.retroBtn} onClick={onRetro}>
              <RiCalendarCheckLine size={12} />
            </button>
          </Tooltip>
        )}
        {card.blockedTickets > 0 && onCascade && (
          <Tooltip title="View blocker cascade" arrow>
            <button className={styles.eosBtn} onClick={onCascade}>
              <RiOrganizationChart size={12} />
            </button>
          </Tooltip>
        )}
        {onEOS && (
          <Tooltip title={`Ask EOS about ${card.pod}`} arrow>
            <button className={styles.eosBtn} onClick={onEOS}>
              <RiSparklingLine size={13} />
            </button>
          </Tooltip>
        )}
        {canDelete && (
          <Tooltip title="Delete space" arrow>
            <button className={styles.deleteBtn} onClick={onDelete}>
              <RiDeleteBinLine size={13} />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
