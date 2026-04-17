import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  fetchProject,
  generateSprintRetro,
  generateReleaseNotes,
  novaQuery,
} from "@/services/api";
import { getPodColor } from "@/config/themes";
import { getStatusColor } from "./spacesData";
import BacklogTab from "./tabs/BacklogTab";
import toast from "react-hot-toast";

import SummaryTab from "./tabs/SummaryTab";
import ActiveSprintsTab from "./tabs/ActiveSprintsTab";
import styles from "./ProjectDetailPage.module.css";

import {
  RiArrowLeftLine,
  RiTaskLine,
  RiBarChartBoxLine,
  RiFlashlightLine,
  RiTimeLine,
  RiAddLine,
  RiSparklingLine,
} from "react-icons/ri";

type Tab = "summary" | "backlog" | "roadmap" | "active-sprints" | "nova";

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
  {
    id: "active-sprints",
    label: "Active Sprints",
    icon: <RiFlashlightLine size={15} />,
  },
  {
    id: "nova",
    label: "EOS",
    icon: <RiSparklingLine size={15} />,
  },
];

export default function ProjectDetailPage() {
  const { projectId: pod } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("active-sprints");
  const [showCreateTask, setShowCreateTask] = useState(false);

  /* ── EOS NOVA tab state ── */
  const [retroResult, setRetroResult] = useState<string | null>(null);
  const [releaseResult, setReleaseResult] = useState<string | null>(null);
  const [predictionText, setPredictionText] = useState<string | null>(null);
  const [predictionLoaded, setPredictionLoaded] = useState(false);

  /* ── Fetch project data ── */
  const { data: project, isLoading } = useQuery({
    queryKey: ["space-project", pod],
    queryFn: () => fetchProject(pod!),
    enabled: !!pod,
    staleTime: 1000 * 60 * 2,
  });

  const podColor = getPodColor(pod ?? "");

  /* ── Sprint retro mutation ── */
  const retroMut = useMutation({
    mutationFn: (sprintId: string) => generateSprintRetro(sprintId),
    onSuccess: (data) => {
      const text =
        data?.retro ?? data?.content ?? data?.result ?? JSON.stringify(data);
      setRetroResult(text);
      toast.success("Sprint retro generated!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const releaseMut = useMutation({
    mutationFn: (sprintId: string) => generateReleaseNotes(sprintId),
    onSuccess: (data) => {
      const text =
        data?.release_notes ??
        data?.content ??
        data?.result ??
        JSON.stringify(data);
      setReleaseResult(text);
      toast.success("Release notes generated!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* ── Sprint prediction (lazy, fires once per project load) ── */
  async function loadPrediction(sprint: {
    name: string;
    donePoints: number;
    totalPoints: number;
    endDate?: string;
  }) {
    if (predictionLoaded) return;
    setPredictionLoaded(true);
    const pct =
      sprint.totalPoints > 0
        ? Math.round((sprint.donePoints / sprint.totalPoints) * 100)
        : 0;
    const daysLeft = sprint.endDate
      ? Math.max(
          0,
          Math.ceil(
            (new Date(sprint.endDate).getTime() - Date.now()) / 86_400_000,
          ),
        )
      : "unknown";
    try {
      const res = await novaQuery(
        `Sprint "${sprint.name}" is ${pct}% done with ${daysLeft} days left. Done: ${sprint.donePoints}pts, Total: ${sprint.totalPoints}pts. In one short sentence (max 80 chars), predict if this sprint will complete on time. Start with ✓ if on track or ⚠ if at risk.`,
      );
      setPredictionText(res.answer.split("\n")[0].trim());
    } catch {
      /* silent — prediction is non-critical */
    }
  }

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
  const sprintPct =
    activeSprint && activeSprint.totalPoints > 0
      ? Math.round((activeSprint.donePoints / activeSprint.totalPoints) * 100)
      : null;
  const daysLeft =
    activeSprint && activeSprint.endDate
      ? Math.max(
          0,
          Math.ceil(
            (new Date(activeSprint.endDate).getTime() - Date.now()) /
              86_400_000,
          ),
        )
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
          {activeSprint ? (
            <div className={styles.sprintCard}>
              <div className={styles.sprintCardHeader}>
                <div className={styles.sprintCardStat}>
                  <span
                    className={styles.sprintCardStatVal}
                    style={{ color: "var(--green)" }}
                  >
                    {activeSprint.donePoints}
                  </span>
                  <span className={styles.sprintCardStatLbl}>Done pts</span>
                </div>
                <div className={styles.stripDivider} />
                <div className={styles.sprintCardStat}>
                  <span className={styles.sprintCardStatVal}>
                    {activeSprint.totalPoints}
                  </span>
                  <span className={styles.sprintCardStatLbl}>Total pts</span>
                </div>
                {/* <div className={styles.stripDivider} /> */}

                <div className={styles.sprintCardMeta}>
                  {daysLeft !== null && (
                    <span className={styles.sprintBadge}>
                      <RiTimeLine size={11} />
                      {daysLeft}d left
                    </span>
                  )}
                  <span
                    className={styles.sprintCardPct}
                    style={{ color: podColor }}
                  >
                    {sprintPct ?? 0}%
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
                      width: `${sprintPct ?? 0}%`,
                      background: `linear-gradient(90deg, ${podColor}, ${podColor}cc)`,
                    }}
                  />
                </div>
              </div>
              <div className={styles.sprintCardStats}></div>

              {/* {!predictionLoaded && (
                <button
                  className={styles.predictionTrigger}
                  onClick={() => loadPrediction(activeSprint)}
                >
                  <RiSparklingLine size={10} /> Ask EOS to predict
                </button>
              )}
              {predictionLoaded && !predictionText && (
                <div className={styles.predictionLoading}>
                  <span className={styles.predDot} /> EOS analysing…
                </div>
              )}
              {predictionText && (
                <div
                  className={styles.predictionChip}
                  style={{
                    borderColor: predictionText.startsWith("✓")
                      ? "var(--green)"
                      : "var(--amber)",
                    color: predictionText.startsWith("✓")
                      ? "var(--green)"
                      : "var(--amber)",
                    background: predictionText.startsWith("✓")
                      ? "rgba(52,211,153,0.08)"
                      : "rgba(251,191,36,0.08)",
                  }}
                >
                  {predictionText}
                </div>
              )} */}
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
          {activeTab === "active-sprints" && (
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
          {activeTab === "summary" && <SummaryTab project={project} />}
          {activeTab === "backlog" && <BacklogTab project={project} />}
          {activeTab === "active-sprints" && (
            <ActiveSprintsTab
              project={project}
              externalCreateOpen={showCreateTask}
              setExternalCreateOpen={setShowCreateTask}
            />
          )}
          {activeTab === "nova" && (
            <div className={styles.novaTab}>
              <div className={styles.novaTabHeader}>
                <RiSparklingLine size={16} color="var(--accent)" />
                <span className={styles.novaTabTitle}>EOS Intelligence</span>
                <span className={styles.novaTabSub}>
                  Powered by Llama 3.1 · 100% Local
                </span>
              </div>

              <div className={styles.novaActions}>
                {/* Sprint Retro */}
                <div className={styles.novaCard}>
                  <div className={styles.novaCardTitle}>
                    <RiFlashlightLine size={14} color="var(--accent)" />
                    Sprint Retrospective
                  </div>
                  <p className={styles.novaCardDesc}>
                    EOS analyses all Done tickets from the active sprint and
                    generates a structured retrospective — What went well,
                    Delta, and Action items.
                  </p>
                  <button
                    className={styles.novaGenBtn}
                    disabled={!activeSprint || retroMut.isPending}
                    onClick={() =>
                      activeSprint && retroMut.mutate(activeSprint.id)
                    }
                  >
                    {retroMut.isPending ? (
                      <>
                        <span className={styles.novaSpinner} /> Generating…
                      </>
                    ) : (
                      <>
                        <RiSparklingLine size={12} /> Generate Retro
                      </>
                    )}
                  </button>
                  {!activeSprint && (
                    <p className={styles.novaCardEmpty}>
                      No active sprint to generate retro for.
                    </p>
                  )}
                  {retroResult && (
                    <div className={styles.novaResult}>{retroResult}</div>
                  )}
                </div>

                {/* Release Notes */}
                <div className={styles.novaCard}>
                  <div className={styles.novaCardTitle}>
                    <RiTaskLine size={14} color="var(--accent)" />
                    Release Notes
                  </div>
                  <p className={styles.novaCardDesc}>
                    EOS groups all Done tickets by type (Features, Bug Fixes,
                    Improvements) and produces a clean changelog ready to share.
                  </p>
                  <button
                    className={styles.novaGenBtn}
                    disabled={!activeSprint || releaseMut.isPending}
                    onClick={() =>
                      activeSprint && releaseMut.mutate(activeSprint.id)
                    }
                  >
                    {releaseMut.isPending ? (
                      <>
                        <span className={styles.novaSpinner} /> Generating…
                      </>
                    ) : (
                      <>
                        <RiSparklingLine size={12} /> Generate Notes
                      </>
                    )}
                  </button>
                  {!activeSprint && (
                    <p className={styles.novaCardEmpty}>
                      No active sprint to generate notes for.
                    </p>
                  )}
                  {releaseResult && (
                    <div className={styles.novaResult}>{releaseResult}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
