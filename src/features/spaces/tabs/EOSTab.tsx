import { useState } from "react";
import toast from "react-hot-toast";
import {
  RiSparklingLine, RiFileCopyLine, RiCheckLine,
  RiAlertLine, RiFlashlightLine, RiTaskLine, RiBarChartLine,
  RiTeamLine, RiFileTextLine, RiLightbulbLine, RiShieldLine,
  RiRocketLine, RiEyeLine, RiArrowRightLine,
  RiUserLine,
} from "react-icons/ri";
import { novaQuery } from "@/services/api";
import SideDrawer from "@/components/ui/SideDrawer";
import type { SprintForecast, KnowledgeGap } from "@/types";
import type { UserRole } from "@/features/auth/types";
import { useAuthStore } from "@/features/auth/useAuthStore";
import type { Project, ProjectSprint } from "../spacesData";
import styles from "./EOSTab.module.css";

// ─── Types ─────────────────────────────────────────────────────────────────

interface RetroSection { title: string; items: string[] }
interface RiskItem { title: string; description: string; impact: "high" | "medium" | "low"; confidence: number; mitigation: string }

type DrawerType = "retro" | "release" | "risk" | "debt" | "teamperf" | "client" | "forecast" | "anomaly" | "gaps" | "sprint_fail" | "silent_blockers";
interface DrawerState { type: DrawerType; title: string; loading: boolean; data: any }

// ─── Parsers ────────────────────────────────────────────────────────────────

function parseRetroSections(text: string): RetroSection[] {
  const lines = text.split(/\r?\n/);
  const sections: RetroSection[] = [];
  let current: RetroSection | null = null;
  const HEADERS: { pattern: RegExp; title: string }[] = [
    { pattern: /went well|positives?|strengths?|wins?|highlights?/i, title: "What went well" },
    { pattern: /didn.?t|negatives?|challenges?|delta|not well/i,    title: "What didn't go well" },
    { pattern: /action items?|next steps?|actions?|todo/i,           title: "Action items" },
  ];
  for (const line of lines) {
    const clean = line.replace(/^#+\s*/, "").replace(/^\*{1,3}\s*/, "").trim();
    if (!clean) continue;
    const hdr = HEADERS.find(({ pattern }) => pattern.test(clean));
    if (hdr) { current = { title: hdr.title, items: [] }; sections.push(current); continue; }
    if (/^[-•*]\s+|^\d+\.\s+/.test(line)) {
      const item = line.replace(/^[-•*]\s+/, "").replace(/^\d+\.\s+/, "").trim();
      if (item && current) current.items.push(item);
    }
  }
  return sections.filter((s) => s.items.length > 0);
}

function parseReleaseNoteSections(text: string): { type: string; items: string[] }[] {
  const lines = text.split(/\r?\n/);
  const sections: { type: string; items: string[] }[] = [];
  let current: { type: string; items: string[] } | null = null;
  const TYPES: { pattern: RegExp; label: string }[] = [
    { pattern: /^features?$|new features?|enhancements?/i, label: "Features" },
    { pattern: /bug fixes?|fixes?|resolved|defects?/i,     label: "Bug Fixes" },
    { pattern: /improvements?|chores?|maintenance|tasks?/i, label: "Improvements" },
  ];
  for (const line of lines) {
    const clean = line.replace(/^#+\s*/, "").replace(/^\*{1,3}\s*/, "").trim();
    if (!clean) continue;
    const t = TYPES.find(({ pattern }) => pattern.test(clean));
    if (t) { current = { type: t.label, items: [] }; sections.push(current); continue; }
    if (/^[-•*]\s+|^\d+\.\s+/.test(line)) {
      const item = line.replace(/^[-•*]\s+/, "").replace(/^\d+\.\s+/, "").trim();
      if (item && current) current.items.push(item);
    }
  }
  return sections.filter((s) => s.items.length > 0);
}

function tryParseJsonArray<T>(text: string): T[] | null {
  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]) as T[];
    return null;
  } catch { return null; }
}

// ─── Shared UI ──────────────────────────────────────────────────────────────

function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button className={styles.copyBtn} onClick={copy}>
      {copied ? <RiCheckLine size={11} /> : <RiFileCopyLine size={11} />}
      {copied ? "Copied" : label}
    </button>
  );
}

function ImpactBadge({ impact }: { impact: "high" | "medium" | "low" }) {
  const map = { high: { label: "High", color: "var(--red)" }, medium: { label: "Medium", color: "var(--amber)" }, low: { label: "Low", color: "var(--green)" } };
  const { label, color } = map[impact];
  return <span className={styles.impactBadge} style={{ color, background: `${color}15`, borderColor: `${color}30` }}>{label}</span>;
}

function ConfBar({ value }: { value: number }) {
  const color = value >= 80 ? "var(--green)" : value >= 60 ? "var(--amber)" : "var(--red)";
  return (
    <div className={styles.confRow}>
      <span className={styles.confLabel}>Confidence</span>
      <div className={styles.confBarWrap}><div className={styles.confBarFill} style={{ width: `${value}%`, background: color }} /></div>
      <span className={styles.confValue} style={{ color }}>{value}%</span>
    </div>
  );
}

function DrawerSpinner() {
  return (
    <div className={styles.drawerLoading}>
      <span className={styles.drawerSpinner} />
      <span className={styles.drawerLoadingText}>EOS is analysing…</span>
    </div>
  );
}

// ─── Drawer content renderers ──────────────────────────────────────────────

function RetroContent({ data }: { data: RetroSection[] }) {
  return (
    <div className={styles.drawerContent}>
      {data.map((section) => (
        <div key={section.title} className={styles.drawerSection}>
          <div className={styles.drawerSectionHeader}>
            <span className={styles.drawerSectionTitle}>{section.title}</span>
            <CopyBtn text={section.items.join("\n")} />
          </div>
          <ul className={styles.bulletList}>
            {section.items.map((item, i) => (
              <li key={i} className={styles.bulletItem}><span className={styles.bullet} />{item}</li>
            ))}
          </ul>
        </div>
      ))}
      <div className={styles.drawerFooter}>
        <CopyBtn text={data.map((s) => `${s.title}\n${s.items.map((i) => `• ${i}`).join("\n")}`).join("\n\n")} label="Copy all" />
      </div>
    </div>
  );
}

function ReleaseContent({ data }: { data: { version: string; sections: { type: string; items: string[] }[] } }) {
  const markdown = data.sections.map((s) => `## ${s.type}\n${s.items.map((i) => `- ${i}`).join("\n")}`).join("\n\n");
  return (
    <div className={styles.drawerContent}>
      <div className={styles.releaseVersionRow}>
        <span className={styles.releaseVersion}>{data.version}</span>
        <CopyBtn text={markdown} label="Copy markdown" />
      </div>
      {data.sections.map((section) => (
        <div key={section.type} className={styles.drawerSection}>
          <span className={styles.drawerSectionTitle}>{section.type}</span>
          <ul className={styles.releaseList}>
            {section.items.map((item, i) => (
              <li key={i} className={styles.releaseItem}><RiArrowRightLine size={10} color="var(--text-3)" />{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function RiskContent({ data }: { data: RiskItem[] }) {
  return (
    <div className={styles.drawerContent}>
      {data.map((risk, i) => (
        <div key={i} className={styles.riskCard}>
          <div className={styles.riskCardHeader}>
            <span className={styles.riskNum}>0{i + 1}</span>
            <span className={styles.riskTitle}>{risk.title}</span>
            <ImpactBadge impact={risk.impact} />
          </div>
          <p className={styles.riskDesc}>{risk.description}</p>
          <ConfBar value={risk.confidence} />
          <div className={styles.mitBox}><RiLightbulbLine size={11} color="var(--accent)" /><span>{risk.mitigation}</span></div>
        </div>
      ))}
    </div>
  );
}

function DebtContent({ data }: { data: { overall_percentage?: number; percentage?: number; threshold: number; insight?: string; recommendation: string; dimensions?: { name: string; score: number; detail: string }[] } }) {
  const pct = data.overall_percentage ?? data.percentage ?? 0;
  const over = pct > data.threshold;
  const overallColor = over ? "var(--red)" : "var(--green)";
  return (
    <div className={styles.drawerContent}>
      <div className={styles.debtGaugeRow}>
        <div className={styles.debtGauge}>
          <div className={styles.debtGaugeFill} style={{ width: `${Math.min(100, (pct / 40) * 100)}%`, background: overallColor }} />
          <div className={styles.debtThresholdLine} style={{ left: `${(data.threshold / 40) * 100}%` }} />
        </div>
        <span className={styles.debtPct} style={{ color: overallColor }}>{pct}%</span>
      </div>
      <div className={styles.debtMeta}>
        <span className={styles.debtLabel} style={{ color: overallColor }}>{over ? `${pct - data.threshold}pp above safe threshold` : "Within safe threshold"}</span>
        <span className={styles.debtThreshLabel}>Safe limit: {data.threshold}%</span>
      </div>
      {data.dimensions && data.dimensions.length > 0 && (
        <div className={styles.drawerSection} style={{ marginTop: 12 }}>
          <span className={styles.drawerSectionTitle}>Debt Dimensions</span>
          {data.dimensions.map((d) => {
            const dimColor = d.score >= 60 ? "var(--red)" : d.score >= 35 ? "var(--amber)" : "var(--green)";
            return (
              <div key={d.name} className={styles.debtDimRow}>
                <div className={styles.debtDimHeader}>
                  <span className={styles.debtDimName}>{d.name}</span>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: dimColor }}>{d.score}</span>
                </div>
                <div className={styles.debtDimBar}>
                  <div className={styles.debtDimFill} style={{ width: `${d.score}%`, background: dimColor }} />
                </div>
                {d.detail && <p className={styles.debtDimDetail}>{d.detail}</p>}
              </div>
            );
          })}
        </div>
      )}
      {data.insight && <p className={styles.bodyText}>{data.insight}</p>}
      <div className={styles.mitBox}><RiLightbulbLine size={11} color="var(--accent)" /><span>{data.recommendation}</span></div>
    </div>
  );
}

function TeamPerfContent({ data }: {
  data: { members: { name: string; role: string; utilization: number; overloaded: boolean; ticketCount: number; assignedPoints: number }[]; pattern: string };
}) {
  return (
    <div className={styles.drawerContent}>
      {data.members.map((m) => (
        <div key={m.name} className={styles.memberCard}>
          <div className={styles.memberInitials}>{m.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}</div>
          <div className={styles.memberCardBody}>
            <div className={styles.memberNameRow}>
              <span className={styles.memberName}>{m.name}</span>
              <span className={styles.memberRole}>{m.role}</span>
              {m.overloaded && <span className={styles.overloadBadge}>Overloaded</span>}
            </div>
            <div className={styles.memberStats}><span>{m.ticketCount} tickets</span><span>·</span><span>{m.assignedPoints} pts assigned</span></div>
            <div className={styles.utilRow}>
              <div className={styles.utilBar}><div className={styles.utilFill} style={{ width: `${Math.min(100, m.utilization)}%`, background: m.overloaded ? "var(--red)" : "var(--green)" }} /></div>
              <span className={styles.utilPct} style={{ color: m.overloaded ? "var(--red)" : "var(--text-3)" }}>{m.utilization}%</span>
            </div>
          </div>
        </div>
      ))}
      {data.pattern && <div className={styles.mitBox}><RiSparklingLine size={11} color="var(--accent)" /><span>{data.pattern}</span></div>}
    </div>
  );
}

function ClientContent({ data }: { data: string }) {
  return (
    <div className={styles.drawerContent}>
      <div className={styles.clientHeader}><span className={styles.clientReadyBadge}>Ready to send</span><CopyBtn text={data} label="Copy text" /></div>
      <div className={styles.clientBody}>{data}</div>
    </div>
  );
}

function ForecastContent({ data }: { data: SprintForecast }) {
  const prob = Math.round(data.current_probability);
  const color = prob >= 80 ? "var(--green)" : prob >= 60 ? "var(--amber)" : "var(--red)";
  const r = 26; const circ = 2 * Math.PI * r;
  return (
    <div className={styles.drawerContent}>
      <div className={styles.forecastProbRow}>
        <div className={styles.forecastRing}>
          <svg width={72} height={72} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={36} cy={36} r={r} fill="none" stroke="var(--border-2)" strokeWidth={6} />
            <circle cx={36} cy={36} r={r} fill="none" stroke={color} strokeWidth={6} strokeDasharray={circ} strokeDashoffset={circ * (1 - prob / 100)} strokeLinecap="round" />
          </svg>
          <span className={styles.forecastPct} style={{ color }}>{prob}%</span>
        </div>
        <div className={styles.forecastMeta}>
          <span className={styles.forecastLabel}>Completion probability</span>
          {data.predicted_completion_date && <p className={styles.forecastNote}>Predicted: {data.predicted_completion_date}</p>}
          <p className={styles.forecastNote}>Historical accuracy: {Math.round(data.historical_accuracy)}%</p>
          <p className={styles.forecastNote}>Range: {Math.round(data.confidence_interval.lower)}% – {Math.round(data.confidence_interval.upper)}%</p>
        </div>
      </div>
      {data.nova_summary && <p className={styles.bodyText}>{data.nova_summary}</p>}
      {data.risk_factors?.length > 0 && (
        <div className={styles.drawerSection}>
          <span className={styles.drawerSectionTitle}>Risk factors</span>
          {data.risk_factors.map((rf, i) => (
            <div key={i} className={styles.factorRow}>
              <RiAlertLine size={11} color={rf.severity === "high" ? "var(--red)" : rf.severity === "medium" ? "var(--amber)" : "var(--text-3)"} />
              <span>{rf.factor}</span>
              <span className={styles.factorImpact}>−{Math.round(rf.impact * 100)}pp</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AnomalyContent({ data, summary }: { data: { type: string; severity: "high" | "medium" | "low"; description: string; date: string }[]; summary?: string }) {
  if (data.length === 0) {
    return <div className={styles.drawerContent}><div className={styles.emptyDrawer}><RiEyeLine size={28} color="var(--text-3)" /><p>No anomalies detected — sprint is on a normal trajectory.</p></div></div>;
  }
  return (
    <div className={styles.drawerContent}>
      {summary && <p className={styles.bodyText}>{summary}</p>}
      {data.map((a, i) => {
        const color = a.severity === "high" ? "var(--red)" : a.severity === "medium" ? "var(--amber)" : "var(--accent)";
        return (
          <div key={i} className={styles.anomalyCard}>
            <div className={styles.anomalyCardHeader}>
              <span className={styles.anomalySev} style={{ color, background: `${color}12`, borderColor: `${color}28` }}>{a.severity}</span>
              <span className={styles.anomalyDate}>{a.date}</span>
            </div>
            <span className={styles.anomalyType}>{a.type}</span>
            <p className={styles.anomalyDesc}>{a.description}</p>
          </div>
        );
      })}
    </div>
  );
}

function GapsContent({ data }: { data: KnowledgeGap[] }) {
  if (data.length === 0) {
    return <div className={styles.drawerContent}><div className={styles.emptyDrawer}><RiSparklingLine size={28} color="var(--text-3)" /><p>No knowledge gaps detected — wiki coverage looks good.</p></div></div>;
  }
  return (
    <div className={styles.drawerContent}>
      {data.slice(0, 6).map((gap) => (
        <div key={gap.id} className={styles.gapCard}>
          <div className={styles.gapCardHeader}>
            <span className={styles.gapTopic}>{gap.topic}</span>
            <span className={styles.gapPriority} style={{ color: gap.wiki_coverage < 30 ? "var(--red)" : "var(--amber)", background: gap.wiki_coverage < 30 ? "#ff000015" : "#f5a62315", borderColor: gap.wiki_coverage < 30 ? "#ff000025" : "#f5a62325" }}>
              {gap.wiki_coverage < 30 ? "High" : "Medium"}
            </span>
          </div>
          <div className={styles.gapMeta}><span>{gap.ticket_count} related tickets</span><span>·</span><span>{gap.wiki_coverage}% wiki coverage</span></div>
          {gap.suggestion && <div className={styles.mitBox}><RiLightbulbLine size={10} color="var(--accent)" /><span>{gap.suggestion}</span></div>}
        </div>
      ))}
    </div>
  );
}

function SprintFailContent({ data }: { data: { probability: number; warning_signs: { sign: string; severity: "high" | "medium" | "low"; detail: string }[]; root_causes: string[]; recommendation: string } }) {
  const color = data.probability >= 60 ? "var(--red)" : data.probability >= 35 ? "var(--amber)" : "var(--green)";
  const label = data.probability >= 60 ? "High Failure Risk" : data.probability >= 35 ? "Moderate Risk" : "Low Risk";
  return (
    <div className={styles.drawerContent}>
      <div className={styles.forecastProbRow}>
        <div className={styles.forecastRing}>
          <svg width={72} height={72} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={36} cy={36} r={26} fill="none" stroke="var(--border-2)" strokeWidth={6} />
            <circle cx={36} cy={36} r={26} fill="none" stroke={color} strokeWidth={6}
              strokeDasharray={2 * Math.PI * 26}
              strokeDashoffset={2 * Math.PI * 26 * (1 - data.probability / 100)}
              strokeLinecap="round" />
          </svg>
          <span className={styles.forecastPct} style={{ color }}>{data.probability}%</span>
        </div>
        <div className={styles.forecastMeta}>
          <span className={styles.forecastLabel}>Failure probability</span>
          <p className={styles.forecastNote} style={{ color }}>{label}</p>
        </div>
      </div>
      {data.warning_signs?.length > 0 && (
        <div className={styles.drawerSection}>
          <span className={styles.drawerSectionTitle}>Warning Signs</span>
          {data.warning_signs.map((w, i) => (
            <div key={i} className={styles.factorRow}>
              <RiAlertLine size={11} color={w.severity === "high" ? "var(--red)" : w.severity === "medium" ? "var(--amber)" : "var(--text-3)"} />
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, fontSize: "0.82rem" }}>{w.sign}</span>
                {w.detail && <p style={{ margin: "2px 0 0", fontSize: "0.76rem", color: "var(--text-3)" }}>{w.detail}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
      {data.root_causes?.length > 0 && (
        <div className={styles.drawerSection}>
          <span className={styles.drawerSectionTitle}>Root Causes</span>
          <ul className={styles.bulletList}>
            {data.root_causes.map((c, i) => <li key={i} className={styles.bulletItem}><span className={styles.bullet} />{c}</li>)}
          </ul>
        </div>
      )}
      {data.recommendation && (
        <div className={styles.mitBox}><RiLightbulbLine size={11} color="var(--accent)" /><span>{data.recommendation}</span></div>
      )}
    </div>
  );
}

function SilentBlockersContent({ data }: { data: { blockers: { key: string; summary: string; risk: string; signal: string; severity: "high" | "medium" | "low" }[]; summary: string } }) {
  if (!data.blockers?.length) {
    return <div className={styles.drawerContent}><div className={styles.emptyDrawer}><RiEyeLine size={28} color="var(--text-3)" /><p>No silent blockers detected — ticket flow looks healthy.</p></div></div>;
  }
  return (
    <div className={styles.drawerContent}>
      {data.summary && <p className={styles.bodyText}>{data.summary}</p>}
      {data.blockers.map((b, i) => {
        const color = b.severity === "high" ? "var(--red)" : b.severity === "medium" ? "var(--amber)" : "var(--text-3)";
        return (
          <div key={i} className={styles.anomalyCard}>
            <div className={styles.anomalyCardHeader}>
              <span className={styles.anomalySev} style={{ color, background: `${color}12`, borderColor: `${color}28` }}>{b.severity}</span>
              <span className={styles.anomalyType}>{b.key}</span>
            </div>
            <p style={{ margin: "4px 0 2px", fontSize: "0.84rem", fontWeight: 600 }}>{b.summary}</p>
            <p className={styles.anomalyDesc}><strong>Signal:</strong> {b.signal}</p>
            <p className={styles.anomalyDesc}><strong>Risk:</strong> {b.risk}</p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Drawer shell ───────────────────────────────────────────────────────────

function Drawer({ drawer, onClose }: { drawer: DrawerState; onClose: () => void }) {
  const badge = (
    <span className={styles.eosBadge}><RiSparklingLine size={8} />EOS</span>
  );
  return (
    <SideDrawer
      open
      onClose={onClose}
      size="md"
      title={drawer.title}
      badge={badge}
      avatar={<RiSparklingLine size={18} color="var(--accent)" />}
    >
      {drawer.loading ? <DrawerSpinner /> :
       !drawer.data    ? <div className={styles.emptyDrawer}><p>No data returned. Try again.</p></div> :
       drawer.type === "retro"    ? <RetroContent data={drawer.data} /> :
       drawer.type === "release"  ? <ReleaseContent data={drawer.data} /> :
       drawer.type === "risk"     ? <RiskContent data={drawer.data} /> :
       drawer.type === "debt"     ? <DebtContent data={drawer.data} /> :
       drawer.type === "teamperf" ? <TeamPerfContent data={drawer.data} /> :
       drawer.type === "client"   ? <ClientContent data={drawer.data} /> :
       drawer.type === "forecast"        ? <ForecastContent data={drawer.data} /> :
       drawer.type === "anomaly"         ? <AnomalyContent data={drawer.data.anomalies} summary={drawer.data.summary} /> :
       drawer.type === "gaps"            ? <GapsContent data={drawer.data} /> :
       drawer.type === "sprint_fail"     ? <SprintFailContent data={drawer.data} /> :
       drawer.type === "silent_blockers" ? <SilentBlockersContent data={drawer.data} /> : null}
    </SideDrawer>
  );
}

// ─── Capability card ────────────────────────────────────────────────────────

function CapCard({ icon, title, description, onActivate, loading, ctaLabel }: {
  icon: React.ReactNode; title: string; description: string;
  onActivate: () => void; loading: boolean; ctaLabel: string;
}) {
  return (
    <button className={styles.capCard} onClick={onActivate} disabled={loading}>
      <div className={styles.capCardIcon}>{icon}</div>
      <div className={styles.capCardBody}>
        <span className={styles.capCardTitle}>{title}</span>
        <p className={styles.capCardDesc}>{description}</p>
      </div>
      <div className={styles.capCardFooter}>
        {loading
          ? <span className={styles.capCardLoading}><span className={styles.spinner} />Analysing…</span>
          : <span className={styles.capCardCta}><RiSparklingLine size={11} />{ctaLabel}</span>}
      </div>
    </button>
  );
}

// ─── Permission map ─────────────────────────────────────────────────────────

const CARD_ROLES: Record<DrawerType, UserRole[]> = {
  retro:           ["admin", "engineering_manager", "tech_lead", "team_member"],
  release:         ["admin", "engineering_manager", "tech_lead"],
  risk:            ["admin", "engineering_manager", "tech_lead"],
  debt:            ["admin", "engineering_manager", "tech_lead"],
  teamperf:        ["admin", "engineering_manager", "tech_lead"],
  client:          ["admin", "engineering_manager"],
  forecast:        ["admin", "engineering_manager", "tech_lead"],
  anomaly:         ["admin", "engineering_manager", "tech_lead"],
  gaps:            ["admin", "engineering_manager", "tech_lead", "team_member"],
  sprint_fail:     ["admin", "engineering_manager", "tech_lead"],
  silent_blockers: ["admin", "engineering_manager", "tech_lead", "team_member"],
};

// ─── Main component ─────────────────────────────────────────────────────────

interface EOSTabProps {
  project: Project;
  activeSprint: ProjectSprint | undefined;
  pod: string;
}

export default function EOSTab({ project, activeSprint, pod }: EOSTabProps) {
  const user = useAuthStore((s) => s.user);
  const userRole: UserRole = user?.role ?? "team_member";

  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [activeLoading, setActiveLoading] = useState<DrawerType | null>(null);

  function open(type: DrawerType, title: string) { setDrawer({ type, title, loading: true, data: null }); }
  function resolve(data: any) { setDrawer((p) => p ? { ...p, loading: false, data } : null); }
  function closeDrawer() { setDrawer(null); }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function sprintContext() {
    if (!activeSprint) return `Project: ${project.name} (pod: ${pod}), no active sprint.`;
    const tasks = activeSprint.tasks;
    const done = tasks.filter((t) => t.status === "Done");
    const blocked = tasks.filter((t) => t.status === "Blocked");
    const inProgress = tasks.filter((t) => t.status === "In Progress");
    const bugs = tasks.filter((t) => t.type === "Bug");
    const pct = activeSprint.totalPoints > 0 ? Math.round((activeSprint.donePoints / activeSprint.totalPoints) * 100) : 0;
    return `Project: ${project.name} (pod: ${pod}).
Sprint: ${activeSprint.name}, goal: "${activeSprint.goal}", ${activeSprint.startDate} → ${activeSprint.endDate}.
Progress: ${activeSprint.donePoints}/${activeSprint.totalPoints} pts (${pct}% done).
Done (${done.length}): ${done.map((t) => `[${t.key}] ${t.title} (${t.storyPoints}pts, ${t.type})`).join("; ") || "none"}.
In Progress (${inProgress.length}): ${inProgress.map((t) => `[${t.key}] ${t.title} assigned to ${t.assignee}`).join("; ") || "none"}.
Blocked (${blocked.length}): ${blocked.map((t) => `[${t.key}] ${t.title} assigned to ${t.assignee}`).join("; ") || "none"}.
Bugs: ${bugs.length}/${tasks.length} tickets.
Team (${project.members.length}): ${project.members.map((m) => `${m.name} (${m.role})`).join(", ")}.`;
  }

  function parseJson<T>(text: string): T | null {
    try { const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/); return m ? JSON.parse(m[0]) as T : null; }
    catch { return null; }
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleRetro() {
    if (!activeSprint) return;
    setActiveLoading("retro"); open("retro", "Sprint Retrospective");
    try {
      const ctx = sprintContext();
      const res = await novaQuery(
        `You are EOS, an AI scrum master. Generate a structured sprint retrospective.
${ctx}
Output with these exact headings followed by bullet points:
## What went well
## What didn't go well
## Action items
Be specific, reference ticket keys and team members where relevant. 3-5 bullets per section.`
      );
      const sections = parseRetroSections(res.answer);
      resolve(sections.length > 0 ? sections : [{ title: "Retrospective", items: res.answer.split("\n").filter(Boolean) }]);
    } catch (e: any) { toast.error(e?.message ?? "Failed to generate retro"); closeDrawer(); }
    finally { setActiveLoading(null); }
  }

  async function handleRelease() {
    if (!activeSprint) return;
    setActiveLoading("release"); open("release", "Release Notes");
    try {
      const ctx = sprintContext();
      const today = new Date().toISOString().slice(0, 10);
      const res = await novaQuery(
        `You are EOS. Generate professional release notes for publication.
${ctx}
Group completed work into these exact headings:
## Features
## Bug Fixes
## Improvements
Write each item as a concise user-facing bullet. Skip headings that have no items.`
      );
      const sections = parseReleaseNoteSections(res.answer);
      resolve({ version: `v${today}`, sections: sections.length > 0 ? sections : [{ type: "Release Notes", items: res.answer.split("\n").filter(Boolean) }] });
    } catch (e: any) { toast.error(e?.message ?? "Failed to generate release notes"); closeDrawer(); }
    finally { setActiveLoading(null); }
  }

  async function handleRisk() {
    setActiveLoading("risk"); open("risk", "Risk Assessment");
    try {
      const ctx = sprintContext();
      const res = await novaQuery(
        `You are EOS, an AI engineering risk analyst.
${ctx}
Identify the top 3 delivery risks. Return a JSON array ONLY with exactly 3 objects:
[{"title": string, "description": string, "impact": "high"|"medium"|"low", "confidence": 0-100, "mitigation": string}]`
      );
      const parsed = tryParseJsonArray<RiskItem>(res.answer);
      if (parsed && parsed.length > 0) {
        resolve(parsed);
      } else {
        const lines = res.answer.split("\n").filter((l) => l.trim());
        resolve(lines.slice(0, 3).map((l, i) => ({ title: `Risk ${i + 1}`, description: l.trim(), impact: (["high", "medium", "low"][i] as "high" | "medium" | "low"), confidence: 75 - i * 5, mitigation: "Review with the team and escalate if needed." })));
      }
    } catch (e: any) { toast.error(e?.message ?? "Risk assessment failed"); closeDrawer(); }
    finally { setActiveLoading(null); }
  }

  async function handleDebt() {
    setActiveLoading("debt"); open("debt", "Technical Debt Radar");
    try {
      const ctx = sprintContext();
      const bugCount = activeSprint?.tasks.filter((t) => t.type === "Bug").length ?? 0;
      const total = Math.max(1, activeSprint?.tasks.length ?? 10);
      const res = await novaQuery(
        `You are EOS, a technical debt radar engine.
${ctx}
Analyse debt across 4 dimensions. Return JSON ONLY:
{"dimensions": [{"name": "Code Debt", "score": 0-100, "detail": string}, {"name": "Test Debt", "score": 0-100, "detail": string}, {"name": "Documentation Debt", "score": 0-100, "detail": string}, {"name": "Dependency Debt", "score": 0-100, "detail": string}], "overall_percentage": 0-100, "threshold": 15, "recommendation": string}
score = how severe the debt is (0=none, 100=critical). Be data-driven: code debt from bug ratio, test debt from bug recurrence, doc debt from knowledge gap signals, dependency debt from blocked tickets.`
      );
      const parsed = parseJson<any>(res.answer);
      const fallbackPct = Math.min(40, Math.round((bugCount / total) * 100) + 8);
      resolve({
        dimensions: parsed?.dimensions ?? [
          { name: "Code Debt", score: fallbackPct + 5, detail: `${bugCount} bugs out of ${total} tickets indicates accumulated code quality issues.` },
          { name: "Test Debt", score: Math.max(10, fallbackPct - 5), detail: "Recurring bugs suggest insufficient test coverage." },
          { name: "Documentation Debt", score: 35, detail: "Ticket patterns show undocumented areas causing repeated issues." },
          { name: "Dependency Debt", score: 20, detail: "Blocked tickets may indicate outdated or fragile dependencies." },
        ],
        overall_percentage: parsed?.overall_percentage ?? fallbackPct,
        threshold: 15,
        recommendation: parsed?.recommendation ?? "Allocate 20% of next sprint to debt reduction, prioritising code and test debt.",
      });
    } catch (e: any) { toast.error(e?.message ?? "Tech debt analysis failed"); closeDrawer(); }
    finally { setActiveLoading(null); }
  }

  async function handleTeamPerf() {
    if (!activeSprint) return;
    setActiveLoading("teamperf"); open("teamperf", "Team Performance");
    try {
      // Derive per-member stats purely from task data
      const memberStats = project.members.map((member) => {
        const assigned = activeSprint.tasks.filter((t) => t.assignee === member.name);
        const points = assigned.reduce((a, t) => a + t.storyPoints, 0);
        const doneCount = assigned.filter((t) => t.status === "Done").length;
        const capacity = assigned.length > 0 ? Math.max(points, 10) : 10;
        return { name: member.name, role: member.role, tickets: assigned.length, points, doneCount, capacity };
      }).filter((m) => m.tickets > 0 || project.members.length <= 4);

      const avgPoints = memberStats.length > 0 ? memberStats.reduce((a, m) => a + m.points, 0) / memberStats.length : 1;

      const members = memberStats.map((m) => ({
        name: m.name,
        role: m.role,
        utilization: Math.round((m.points / Math.max(avgPoints * 1.5, 1)) * 100),
        overloaded: m.points > avgPoints * 1.5,
        ticketCount: m.tickets,
        assignedPoints: m.points,
      }));

      const patternRes = await novaQuery(
        `You are EOS. Analyse workload distribution for sprint "${activeSprint.name}" (${project.name}).
Members: ${memberStats.map((m) => `${m.name} (${m.role}): ${m.tickets} tickets, ${m.points} pts, ${m.doneCount} done`).join("; ")}.
In one sentence, identify the most important workload pattern or imbalance to address.`
      );

      resolve({ members, pattern: patternRes.answer });
    } catch (e: any) { toast.error(e?.message ?? "Team analysis failed"); closeDrawer(); }
    finally { setActiveLoading(null); }
  }

  async function handleClient() {
    setActiveLoading("client"); open("client", "Client Status Update");
    try {
      const ctx = sprintContext();
      const res = await novaQuery(
        `You are EOS. Write a professional project status update to send directly to a client.
${ctx}
Write exactly 3 short paragraphs: (1) overall status, (2) key achievements this sprint, (3) next milestone and timeline.
Tone: professional, positive, concise. No bullet points — flowing prose only.`
      );
      resolve(res.answer);
    } catch (e: any) { toast.error(e?.message ?? "Failed to generate client update"); closeDrawer(); }
    finally { setActiveLoading(null); }
  }

  async function handleForecast() {
    if (!activeSprint) return;
    setActiveLoading("forecast"); open("forecast", "Sprint Health Forecast");
    try {
      const ctx = sprintContext();
      const pct = activeSprint.totalPoints > 0 ? Math.round((activeSprint.donePoints / activeSprint.totalPoints) * 100) : 0;
      const res = await novaQuery(
        `You are EOS, an AI sprint forecasting engine.
${ctx}
Analyse sprint trajectory and return a JSON object ONLY:
{"current_probability": number, "trend_probability": number, "nova_summary": string, "risk_factors": [{"factor": string, "impact": number, "severity": "high"|"medium"|"low"}], "historical_accuracy": number}
current_probability = likelihood (0-100) the sprint completes on time. Be data-driven.`
      );
      const parsed = parseJson<any>(res.answer);
      resolve({
        sprint_id: activeSprint.id,
        current_probability: parsed?.current_probability ?? pct,
        trend_probability: parsed?.trend_probability ?? pct,
        predicted_completion_date: activeSprint.endDate ?? null,
        predicted_points: activeSprint.totalPoints,
        confidence_interval: { lower: Math.max(0, (parsed?.current_probability ?? pct) - 15), upper: Math.min(100, (parsed?.current_probability ?? pct) + 15) },
        risk_factors: parsed?.risk_factors ?? [],
        nova_summary: parsed?.nova_summary ?? res.answer,
        historical_accuracy: parsed?.historical_accuracy ?? 80,
      });
    } catch (e: any) { toast.error(e?.message ?? "Forecast failed"); closeDrawer(); }
    finally { setActiveLoading(null); }
  }

  async function handleAnomaly() {
    if (!activeSprint) return;
    setActiveLoading("anomaly"); open("anomaly", "Anomaly Detection");
    try {
      const ctx = sprintContext();
      const today = new Date().toISOString().slice(0, 10);
      const res = await novaQuery(
        `You are EOS anomaly detection engine.
${ctx}
Detect any statistical or behavioural anomalies (velocity drops, blocker spikes, bug surges, stale tickets, assignee overload, etc.).
Return JSON ONLY: {"anomalies": [{"type": string, "severity": "high"|"medium"|"low", "description": string, "date": "${today}"}], "nova_summary": string}
If everything looks normal return an empty anomalies array with a positive nova_summary.`
      );
      const parsed = parseJson<{ anomalies: { type: string; severity: "high" | "medium" | "low"; description: string; date: string }[]; nova_summary: string }>(res.answer);
      resolve({ anomalies: parsed?.anomalies ?? [], summary: parsed?.nova_summary ?? res.answer });
    } catch (e: any) { toast.error(e?.message ?? "Anomaly scan failed"); closeDrawer(); }
    finally { setActiveLoading(null); }
  }

  async function handleSprintFail() {
    if (!activeSprint) return;
    setActiveLoading("sprint_fail"); open("sprint_fail", "Sprint Failure Predictor");
    try {
      const ctx = sprintContext();
      const res = await novaQuery(
        `You are EOS, a sprint failure prediction engine.
${ctx}
Analyse this sprint and predict the probability it will FAIL (not complete on time or scope).
Return JSON ONLY:
{"probability": 0-100, "warning_signs": [{"sign": string, "severity": "high"|"medium"|"low", "detail": string}], "root_causes": [string], "recommendation": string}
probability = likelihood the sprint will NOT complete. Be data-driven: consider blocked tickets, bug ratio, WIP, team capacity, and progress vs timeline.`
      );
      const parsed = parseJson<any>(res.answer);
      const pct = activeSprint.totalPoints > 0 ? Math.round((activeSprint.donePoints / activeSprint.totalPoints) * 100) : 0;
      const bugs = activeSprint.tasks.filter((t) => t.type === "Bug").length;
      const blocked = activeSprint.tasks.filter((t) => t.status === "Blocked").length;
      const fallbackProb = Math.min(90, blocked * 20 + (bugs > 3 ? 15 : 0) + Math.max(0, 60 - pct));
      resolve({
        probability: parsed?.probability ?? fallbackProb,
        warning_signs: parsed?.warning_signs ?? (blocked > 0 ? [{ sign: `${blocked} blocked ticket(s)`, severity: "high", detail: "Blockers directly impede sprint completion." }] : []),
        root_causes: parsed?.root_causes ?? ["Sprint data insufficient for full analysis"],
        recommendation: parsed?.recommendation ?? "Review blocked tickets immediately and escalate unresolved dependencies.",
      });
    } catch (e: any) { toast.error(e?.message ?? "Failure prediction failed"); closeDrawer(); }
    finally { setActiveLoading(null); }
  }

  async function handleSilentBlockers() {
    if (!activeSprint) return;
    setActiveLoading("silent_blockers"); open("silent_blockers", "Silent Blocker Detection");
    try {
      const ctx = sprintContext();
      const res = await novaQuery(
        `You are EOS, a blocker detection engine.
${ctx}
Identify tickets that are NOT marked as "Blocked" but show signs of being blocked: stale updates, external dependencies, waiting-on-others signals, or vague status.
Return JSON ONLY:
{"blockers": [{"key": string, "summary": string, "risk": string, "signal": string, "severity": "high"|"medium"|"low"}], "summary": string}
Focus on In Progress or To Do tickets that haven't moved. Return empty array if none found.`
      );
      const parsed = parseJson<any>(res.answer);
      resolve({ blockers: parsed?.blockers ?? [], summary: parsed?.summary ?? res.answer });
    } catch (e: any) { toast.error(e?.message ?? "Silent blocker scan failed"); closeDrawer(); }
    finally { setActiveLoading(null); }
  }

  async function handleGaps() {
    setActiveLoading("gaps"); open("gaps", "Knowledge Gap Analysis");
    try {
      const ctx = sprintContext();
      const res = await novaQuery(
        `You are EOS, an AI knowledge management analyst.
${ctx}
Identify knowledge gaps — areas where repeated tickets suggest missing documentation, tribal knowledge, or onboarding gaps.
Return a JSON array ONLY of up to 5 gap objects:
[{"id": string, "topic": string, "suggestion": string, "ticket_count": number, "wiki_coverage": 0-100, "example_tickets": [string], "detected_at": null}]`
      );
      const parsed = tryParseJsonArray<{ id: string; topic: string; suggestion: string; ticket_count: number; wiki_coverage: number; example_tickets: string[]; detected_at: null }>(res.answer);
      resolve(parsed ?? []);
    } catch (e: any) { toast.error(e?.message ?? "Knowledge gap analysis failed"); closeDrawer(); }
    finally { setActiveLoading(null); }
  }

  // ── Card definitions ──────────────────────────────────────────────────────

  const ALL_CARDS: {
    type: DrawerType;
    icon: React.ReactNode;
    title: string;
    description: string;
    cta: string;
    handler: () => void;
    requiresSprint: boolean;
  }[] = [
    {
      type: "retro",
      icon: <RiFlashlightLine size={20} color="var(--accent)" />,
      title: "Sprint Retrospective",
      description: "Structured retro from Done tickets — What went well, What didn't, Action items.",
      cta: "Generate Retro",
      handler: handleRetro,
      requiresSprint: true,
    },
    {
      type: "release",
      icon: <RiTaskLine size={20} color="var(--accent)" />,
      title: "Release Notes",
      description: "Changelog grouped by Features, Bug Fixes, and Improvements — ready to share.",
      cta: "Generate Notes",
      handler: handleRelease,
      requiresSprint: true,
    },
    {
      type: "risk",
      icon: <RiShieldLine size={20} color="var(--accent)" />,
      title: "Risk Assessment",
      description: "Top risks with impact rating, confidence level, and EOS mitigation strategies.",
      cta: "Analyse Risks",
      handler: handleRisk,
      requiresSprint: false,
    },
    {
      type: "debt",
      icon: <RiBarChartLine size={20} color="var(--accent)" />,
      title: "Technical Debt Radar",
      description: "Multi-dimensional debt scan: code, test, docs, and dependency debt — with severity scores.",
      cta: "Run Debt Radar",
      handler: handleDebt,
      requiresSprint: false,
    },
    {
      type: "teamperf",
      icon: <RiTeamLine size={20} color="var(--accent)" />,
      title: "Team Performance",
      description: "Workload distribution and utilisation across team members in the active sprint.",
      cta: "Analyse Team",
      handler: handleTeamPerf,
      requiresSprint: true,
    },
    {
      type: "client",
      icon: <RiFileTextLine size={20} color="var(--accent)" />,
      title: "Client Status Update",
      description: "A polished, professional project update — written by EOS and ready to send.",
      cta: "Generate Update",
      handler: handleClient,
      requiresSprint: false,
    },
    {
      type: "forecast",
      icon: <RiRocketLine size={20} color="var(--accent)" />,
      title: "Sprint Forecast",
      description: "Completion probability, risk factors, and suggestions for the active sprint.",
      cta: "Forecast Sprint",
      handler: handleForecast,
      requiresSprint: true,
    },
    {
      type: "anomaly",
      icon: <RiEyeLine size={20} color="var(--accent)" />,
      title: "Anomaly Detection",
      description: "Statistical drift in velocity, bug rates, and PR review times — caught early.",
      cta: "Run Scan",
      handler: handleAnomaly,
      requiresSprint: true,
    },
    {
      type: "gaps",
      icon: <RiUserLine size={20} color="var(--accent)" />,
      title: "Knowledge Gaps",
      description: "Wiki coverage gaps from ticket topics, with EOS training recommendations.",
      cta: "Identify Gaps",
      handler: handleGaps,
      requiresSprint: false,
    },
    {
      type: "sprint_fail",
      icon: <RiAlertLine size={20} color="var(--accent)" />,
      title: "Sprint Failure Predictor",
      description: "Probability the sprint will not complete — based on blockers, bugs, WIP, and pace.",
      cta: "Predict Failure Risk",
      handler: handleSprintFail,
      requiresSprint: true,
    },
    {
      type: "silent_blockers",
      icon: <RiEyeLine size={20} color="var(--accent)" />,
      title: "Silent Blocker Detection",
      description: "Tickets not marked Blocked but showing hidden dependency or stall signals.",
      cta: "Scan for Blockers",
      handler: handleSilentBlockers,
      requiresSprint: true,
    },
  ];

  // Filter by permissions and sprint availability
  const visibleCards = ALL_CARDS.filter((c) => {
    if (!CARD_ROLES[c.type].includes(userRole)) return false;
    if (c.requiresSprint && !activeSprint) return false;
    return true;
  });

  if (visibleCards.length === 0) {
    return (
      <div className={styles.root}>
        <div className={styles.emptyState}>
          <RiSparklingLine size={32} color="var(--text-3)" />
          <p>EOS Intelligence isn't available for your role in this project.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.tabHeader}>
        <RiSparklingLine size={15} color="var(--accent)" />
        <span className={styles.tabHeaderTitle}>EOS Intelligence</span>
        <span className={styles.eosBadge}><RiSparklingLine size={8} />EOS</span>
        {activeSprint ? (
          <span className={styles.sprintChip}>{activeSprint.name} · {activeSprint.donePoints}/{activeSprint.totalPoints} pts</span>
        ) : (
          <span className={styles.noSprintChip}>No active sprint — some features unavailable</span>
        )}
      </div>

      <div className={styles.capGrid}>
        {visibleCards.map((card) => (
          <CapCard
            key={card.type}
            icon={card.icon}
            title={card.title}
            description={card.description}
            onActivate={card.handler}
            loading={activeLoading === card.type}
            ctaLabel={card.cta}
          />
        ))}
      </div>

      {drawer && <Drawer drawer={drawer} onClose={closeDrawer} />}
    </div>
  );
}
