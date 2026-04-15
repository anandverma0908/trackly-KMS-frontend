import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Tooltip from "@mui/material/Tooltip";
import { fetchProject } from "@/services/api";
import { getPodColor } from "@/config/themes";
import { getStatusColor } from "./spacesData";
import BacklogTab from "./tabs/BacklogTab";
import RoadmapTab from "./tabs/RoadmapTab";
import SummaryTab from "./tabs/SummaryTab";
import ActiveSprintsTab from "./tabs/ActiveSprintsTab";
import styles from "./ProjectDetailPage.module.css";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import AssignmentIcon from "@mui/icons-material/Assignment";
import MapIcon from "@mui/icons-material/Map";
import BarChartIcon from "@mui/icons-material/BarChart";
import SpeedIcon from "@mui/icons-material/Speed";

type Tab = "summary" | "backlog" | "roadmap" | "active-sprints";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "summary",
    label: "Summary",
    icon: <BarChartIcon sx={{ fontSize: 15 }} />,
  },
  {
    id: "backlog",
    label: "Backlog",
    icon: <AssignmentIcon sx={{ fontSize: 15 }} />,
  },
  { id: "roadmap", label: "Roadmap", icon: <MapIcon sx={{ fontSize: 15 }} /> },
  {
    id: "active-sprints",
    label: "Active Sprints",
    icon: <SpeedIcon sx={{ fontSize: 15 }} />,
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
  const [activeTab, setActiveTab] = useState<Tab>("summary");

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

  return (
    <div className={styles.page}>
      {/* ── Project Header ── */}
      <div className={`${styles.header} fade-up`}>
        <div className={styles.headerLeft}>
          <button
            className={styles.backBtn}
            onClick={() => navigate("/spaces")}
          >
            <ArrowBackIcon sx={{ fontSize: 16 }} />
          </button>

          <div className={styles.projectInfo}>
            <div className={styles.projectTitleRow}>
              <h1 className={styles.projectTitle}>{pod}</h1>
              <span
                className={styles.projectStatus}
                style={{ color: statusColor, background: `${statusColor}18` }}
              >
                {project.sprints.some((s) => s.status === "active")
                  ? `${project.sprints.find((s) => s.status === "active")?.name} active`
                  : "No active sprint"}
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
          <div className={styles.headerMeta}>
            <div className={styles.metaItem}>
              <CalendarTodayIcon
                sx={{ fontSize: 13, color: "var(--text-3)" }}
              />
              <span className={styles.metaLabel}>{TODAY}</span>
            </div>
            {project.members.length > 0 && (
              <div className={styles.metaItem}>
                <PeopleAltIcon sx={{ fontSize: 13, color: "var(--text-3)" }} />
                <span className={styles.metaLabel}>
                  {project.members.length} assignees
                </span>
              </div>
            )}
          </div>

          {project.members.length > 0 && (
            <div className={styles.memberAvatars}>
              {project.members.slice(0, 6).map((m, idx) => (
                <Tooltip
                  key={m.id}
                  title={`${m.name} · ${m.role}`}
                  arrow
                  placement="bottom"
                >
                  <div
                    className={styles.memberAvatar}
                    style={{
                      background: m.color,
                      zIndex: 20 - idx,
                      marginLeft: idx === 0 ? 0 : -10,
                    }}
                  >
                    {m.initials}
                  </div>
                </Tooltip>
              ))}
              {project.members.length > 6 && (
                <div
                  className={styles.memberAvatar}
                  style={{
                    background: "var(--surface-2)",
                    zIndex: 0,
                    marginLeft: -10,
                    color: "var(--text-2)",
                    fontSize: 11,
                  }}
                >
                  +{project.members.length - 6}
                </div>
              )}
            </div>
          )}
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
        {activeTab === "roadmap" && <RoadmapTab project={project} />}
        {activeTab === "active-sprints" && (
          <ActiveSprintsTab project={project} />
        )}
      </div>
    </div>
  );
}
