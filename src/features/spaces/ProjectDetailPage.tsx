import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchProject } from "@/services/api";
import { getPodColor } from "@/config/themes";
import { getStatusColor } from "./spacesData";
import BacklogTab from "./tabs/BacklogTab";
import SummaryTab from "./tabs/SummaryTab";
import ActiveSprintsTab from "./tabs/ActiveSprintsTab";
import RoadmapTab from "./tabs/RoadmapTab";
import SprintsTab from "./tabs/SprintsTab";
import EOSTab from "./tabs/EOSTab";
import SettingsTab from "./tabs/SettingsTab";
import styles from "./ProjectDetailPage.module.css";

import {
  RiArrowLeftLine,
  RiTaskLine,
  RiBarChartBoxLine,
  RiFlashlightLine,
  RiAddLine,
  RiSparklingLine,
  RiRoadMapLine,
  RiCalendar2Line,
  RiCheckLine,
  RiAlertLine,
  RiSettings3Line,
} from "react-icons/ri";

function VelocityRing({ done, total, size = 28 }: { done: number; total: number; size?: number }) {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(done / total, 1) : 0;
  const color = pct >= 1 ? "var(--green)" : pct >= 0.5 ? "var(--accent)" : "var(--amber)";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-2)" strokeWidth={2.5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={2.5}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.5s ease" }} />
    </svg>
  );
}

type Tab = "summary" | "backlog" | "board" | "sprints" | "roadmap" | "nova" | "settings";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "summary",  label: "Summary",  icon: <RiBarChartBoxLine size={15} /> },
  { id: "backlog",  label: "Backlog",  icon: <RiTaskLine size={15} /> },
  { id: "board",    label: "Board",    icon: <RiFlashlightLine size={15} /> },
  { id: "sprints",  label: "Sprints",  icon: <RiCalendar2Line size={15} /> },
  { id: "roadmap",  label: "Roadmap",  icon: <RiRoadMapLine size={15} /> },
  { id: "nova",     label: "EOS",      icon: <RiSparklingLine size={15} /> },
  { id: "settings", label: "Settings", icon: <RiSettings3Line size={15} /> },
];

export default function ProjectDetailPage() {
  const { projectId: pod } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [showCreateTask, setShowCreateTask] = useState(false);

  /* ── EOS tab state (handled inside EOSTab component) ── */

  /* ── Fetch project data ── */
  const { data: project, isLoading } = useQuery({
    queryKey: ["space-project", pod],
    queryFn: () => fetchProject(pod!),
    enabled: !!pod,
    staleTime: 1000 * 60 * 2,
  });

  const podColor = getPodColor(pod ?? "");


  if (isLoading) {
    return (
      <div className={styles.notFound}>
        {/* <div className={styles.notFoundIcon}>⏳</div> */}
        <div className={styles.notFoundTitle}>Loading project…</div>
      </div>
    );
  }

  if (!pod || !project) {
    return (
      <div className={styles.notFound}>
        {/* <div className={styles.notFoundIcon}>🗂️</div> */}
        <div className={styles.notFoundTitle}>Project not found</div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate("/spaces")}
        >
          ← Back to Spaces
        </button>
      </div>
    );
  }

  const statusColor = getStatusColor(project.status);
  const activeSprint = project.sprints.find((s) => s.status === "active");

  const sprintHealth = (() => {
    if (!activeSprint?.startDate || !activeSprint?.endDate) return null;
    const now = new Date();
    const start = new Date(activeSprint.startDate);
    const end = new Date(activeSprint.endDate);
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
    const daysElapsed = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / 86_400_000));
    const daysLeft = Math.max(0, totalDays - daysElapsed);
    const done = activeSprint.donePoints;
    const total = activeSprint.totalPoints;
    const remaining = total - done;
    const pace = done / daysElapsed;
    const neededPace = daysLeft > 0 ? remaining / daysLeft : remaining > 0 ? 0 : pace;
    const probability = Math.min(100, Math.round((neededPace > 0 ? pace / neededPace : 1) * 100));
    const status = probability >= 80 ? "on-track" : probability >= 50 ? "at-risk" : "behind";
    const color = status === "on-track" ? "var(--green)" : status === "at-risk" ? "var(--amber)" : "var(--red)";
    const blockedCount = activeSprint.tasks.filter((t) => t.status === "Blocked").length;
    const recommendation =
      probability >= 80
        ? "Sprint on track — protect the team from scope additions."
        : probability >= 50
        ? blockedCount > 0
          ? `At risk — unblock ${blockedCount} ticket${blockedCount > 1 ? "s" : ""} immediately.`
          : "At risk — consider moving low-priority items to backlog."
        : "Behind — escalate blockers and negotiate scope now.";
    const sprintPct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { probability, status, color, daysLeft, done, total, blockedCount, recommendation, sprintPct };
  })();

  return (
    <div className={styles.page}>
      {/* ── Project Header ── */}
      <div className={`${styles.header} fade-up`}>
        <div className={styles.headerLeft}>
          <button
            className={styles.backBtn}
            onClick={() => navigate("/spaces")}
          >
            <RiArrowLeftLine size={16} />
          </button>

          <div className={styles.projectInfo}>
            <div className={styles.projectTitleRow}>
              <h1 className={styles.projectTitle}>{pod}</h1>
              <span
                className={styles.projectStatus}
                style={{ color: statusColor, background: `${statusColor}18` }}
              >
                {activeSprint ? activeSprint.name : ""}
              </span>
            </div>
            {/* <p className={styles.projectDesc}>
              {project.totalTickets.toLocaleString()} total tickets ·{" "}
              {project.completedTickets.toLocaleString()} done ·{" "}
              {project.progress}% complete
            </p> */}

            {activeSprint ? (
              <>
                <div className={styles.sprintDates}>
                  {activeSprint.startDate} → {activeSprint.endDate}
                </div>
                <div className={styles.sprintGoal}>
                  Goal: {activeSprint.goal}
                </div>
              </>
            ) : (
              <>
                <div className={styles.sprintDates}>
                  <span>No active sprint</span>
                </div>
                <div className={styles.sprintGoal}>
                  <span>
                  Start one from Backlog
                </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className={styles.headerRight}>
          {activeSprint && sprintHealth ? (
            <div className={styles.healthWidget}>
              {/* Row 1: ring + probability + badge + bar + pts + days + blocked */}
              <div className={styles.hwRow1}>
                <VelocityRing done={sprintHealth.done} total={sprintHealth.total} size={28} />
                <span className={styles.hwProb} style={{ color: sprintHealth.color }}>
                  {sprintHealth.probability}%
                </span>
                <span
                  className={styles.hwBadge}
                  style={{ color: sprintHealth.color, background: `${sprintHealth.color}18`, border: `1px solid ${sprintHealth.color}33` }}
                >
                  {sprintHealth.status === "on-track"
                    ? <><RiCheckLine size={9} /> On Track</>
                    : sprintHealth.status === "at-risk"
                    ? <><RiAlertLine size={9} /> At Risk</>
                    : <><RiAlertLine size={9} /> Behind</>}
                </span>
                <div className={styles.hwBar}>
                  <div className={styles.hwBarFill} style={{ width: `${sprintHealth.sprintPct}%`, background: sprintHealth.color }} />
                </div>
                <span className={styles.hwStats}>{sprintHealth.done}/{sprintHealth.total} pts</span>
                <span className={styles.hwDot}>·</span>
                <span className={styles.hwStats}>{sprintHealth.daysLeft}d left</span>
                {sprintHealth.blockedCount > 0 && (
                  <>
                    <span className={styles.hwDot}>·</span>
                    <span className={styles.hwBlocked}>🚫 {sprintHealth.blockedCount}</span>
                  </>
                )}
              </div>
              {/* Row 2: EOS recommendation */}
              <div className={styles.hwRow2}>
                <RiSparklingLine size={9} color="var(--accent)" style={{ flexShrink: 0 }} />
                <span className={styles.hwRec}>{sprintHealth.recommendation}</span>
              </div>
            </div>
          ) : activeSprint ? (
            <div className={styles.healthWidget}>
              <div className={styles.hwRow1}>
                <span className={styles.hwStats}>{activeSprint.donePoints}/{activeSprint.totalPoints} pts</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className={styles.tabContainer}>
        {/* ── Tabs ── */}
        <div className={styles.tabBarWrap}>
          <div className={styles.tabBar}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ""}`}
                onClick={() => setActiveTab(tab.id)}
                style={
                  activeTab === tab.id
                    ? { color: podColor, borderBottomColor: podColor }
                    : {}
                }
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
          {activeTab === "board" && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowCreateTask(true)}
            >
              <RiAddLine size={16} />
              Create Task
            </button>
          )}
        </div>

        {/* ── Color accent line ── */}
        <div
          className={styles.accentLine}
          style={{
            background: `linear-gradient(90deg, ${podColor}, transparent)`,
          }}
        />

        {/* ── Tab Content ── */}
        <div className={styles.tabContent}>
          {activeTab === "summary"  && <SummaryTab project={project} />}
          {activeTab === "backlog"  && <BacklogTab project={project} />}
          {activeTab === "sprints"  && <SprintsTab project={project} />}
          {activeTab === "roadmap"  && <RoadmapTab project={project} />}
          {activeTab === "board" && (
            <ActiveSprintsTab
              project={project}
              externalCreateOpen={showCreateTask}
              setExternalCreateOpen={setShowCreateTask}
            />
          )}
          {activeTab === "nova" && (
            <EOSTab project={project} activeSprint={activeSprint} pod={pod ?? ""} />
          )}
          {activeTab === "settings" && <SettingsTab project={project} />}
        </div>
      </div>
    </div>
  );
}
