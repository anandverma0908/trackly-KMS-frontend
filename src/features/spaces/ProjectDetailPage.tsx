import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchProject } from "@/services/api";
import { getPodColor } from "@/config/themes";
import { getStatusColor } from "./spacesData";
import BacklogTab from "./tabs/BacklogTab";

import SummaryTab from "./tabs/SummaryTab";
import ActiveSprintsTab from "./tabs/ActiveSprintsTab";
import styles from "./ProjectDetailPage.module.css";

import { RiArrowLeftLine, RiCalendarLine, RiTeamLine, RiTaskLine, RiBarChartBoxLine, RiFlashlightLine, RiTimeLine } from "react-icons/ri";

type Tab = "summary" | "backlog" | "roadmap" | "active-sprints";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "summary",
    label: "Summary",
    icon: <RiBarChartBoxLine size={15} />,
  },
  {
    id: "backlog",
    label: "Backlog",
    icon: <RiTaskLine size={15} />,
  },
  // { id: "roadmap", label: "Roadmap", icon: <MapIcon sx={{ fontSize: 15 }} /> },
  {
    id: "active-sprints",
    label: "Active Sprints",
    icon: <RiFlashlightLine size={15} />,
  },
];

const TODAY = new Date().toLocaleDateString("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default function ProjectDetailPage() {
  const { projectId: pod } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("active-sprints");

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
  const sprintPct = activeSprint && activeSprint.totalPoints > 0
    ? Math.round((activeSprint.donePoints / activeSprint.totalPoints) * 100)
    : null;
  const daysLeft = activeSprint && activeSprint.endDate
    ? Math.max(0, Math.ceil((new Date(activeSprint.endDate).getTime() - Date.now()) / 86_400_000))
    : null;

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
                {activeSprint ? "Active Sprint" : "No active sprint"}
              </span>
            </div>
            <p className={styles.projectDesc}>
              {project.totalTickets.toLocaleString()} total tickets ·{" "}
              {project.completedTickets.toLocaleString()} done ·{" "}
              {project.progress}% complete
            </p>
          </div>
        </div>

        <div className={styles.headerRight}>
          {activeSprint ? (
            <div className={styles.sprintCard}>
              <div className={styles.sprintCardHeader}>
                <div className={styles.sprintCardTitle}>{activeSprint.name}</div>
                <div className={styles.sprintCardMeta}>
                  {daysLeft !== null && (
                    <span className={styles.sprintBadge}>
                      <RiTimeLine size={11} />
                      {daysLeft}d left
                    </span>
                  )}
                  <span className={styles.sprintCardPct} style={{ color: podColor }}>
                    {sprintPct}%
                  </span>
                </div>
              </div>
              <div className={styles.sprintBarWrap}>
                <div
                  className={styles.sprintBarBg}
                  style={{ background: `${podColor}22` }}
                >
                  <div
                    className={styles.sprintBarFill}
                    style={{
                      width: `${sprintPct}%`,
                      background: `linear-gradient(90deg, ${podColor}, ${podColor}cc)`,
                    }}
                  />
                </div>
              </div>
              <div className={styles.sprintCardStats}>
                <div className={styles.sprintCardStat}>
                  <span className={styles.sprintCardStatVal} style={{ color: "var(--green)" }}>
                    {activeSprint.donePoints}
                  </span>
                  <span className={styles.sprintCardStatLbl}>Done pts</span>
                </div>
                <div className={styles.sprintCardStat}>
                  <span className={styles.sprintCardStatVal}>
                    {activeSprint.totalPoints}
                  </span>
                  <span className={styles.sprintCardStatLbl}>Total pts</span>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.sprintCardEmpty}>
              <span className={styles.sprintCardEmptyText}>No active sprint</span>
              <span className={styles.sprintCardEmptySub}>Start one from Backlog</span>
            </div>
          )}

          <div className={styles.headerMetaRow}>
            <div className={styles.metaItem}>
              <RiCalendarLine size={13} color="var(--text-3)" />
              <span className={styles.metaLabel}>{TODAY}</span>
            </div>
            {project.members.length > 0 && (
              <div className={styles.metaItem}>
                <RiTeamLine size={13} color="var(--text-3)" />
                <span className={styles.metaLabel}>
                  {project.members.length} assignees
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
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

      {/* ── Color accent line ── */}
      <div
        className={styles.accentLine}
        style={{
          background: `linear-gradient(90deg, ${podColor}, transparent)`,
        }}
      />

      {/* ── Tab Content ── */}
      <div className={styles.tabContent}>
        {activeTab === "summary" && <SummaryTab project={project} />}
        {activeTab === "backlog" && <BacklogTab project={project} />}
        {/* {activeTab === "roadmap" && <RoadmapTab project={project} />} */}
        {activeTab === "active-sprints" && (
          <ActiveSprintsTab project={project} />
        )}
      </div>
    </div>
  );
}
