import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  RiBugLine,
  RiCloseLine,
  RiGitRepositoryLine,
  RiPlayLine,
  RiShieldCheckLine,
  RiHistoryLine,
  RiTimeLine,
} from "react-icons/ri";
import {
  fetchFilters,
  fetchCodeReviewHistory,
  fetchCodeReviewSnapshot,
} from "@/services/api";
import type { CodeReviewSnapshotMeta } from "@/services/api";
import { useAuthStore } from "@/features/auth/useAuthStore";
import CreateTicketDrawer from "@/features/tickets/CreateTicketDrawer";
import styles from "./CodeReviewPage.module.css";
import {
  mergeFindingsWithState,
  updateFindingState,
  type CodeReviewFindingRecord,
  type CodeReviewFindingState,
  type ReviewSeverity,
  type ReviewStatus,
} from "./codeReviewData";

/* ─── Types ──────────────────────────────────────────────── */

type Phase = "idle" | "scanning" | "done";
type LogLevel =
  | "CONN"
  | "INDEX"
  | "PARSE"
  | "SCAN"
  | "XREF"
  | "COMPILE"
  | "DONE"
  | "WARN";

interface LogLine {
  id: number;
  ts: string;
  level: LogLevel;
  message: string;
}

interface RepoOption {
  slug: string;
  name: string;
  full_name: string;
}

/* ─── Constants ──────────────────────────────────────────── */

const SEV_LABEL: Record<ReviewSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
};

const STATUS_LABEL: Record<ReviewStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  approved: "Approved",
  rejected: "Rejected",
  ticketed: "Ticketed",
};

const SCAN_STEPS_PLACEHOLDER = [
  "src/app/App.tsx",
  "src/features/wiki/WikiPage.tsx",
  "src/features/tickets/TicketsPage.tsx",
  "src/features/dashboard/widgets/QuickActions.tsx",
  "src/services/api.ts",
  "src/features/auth/LoginPage.tsx",
  "src/features/spaces/SpacesPage.tsx",
  "src/features/nova/NovaPage.tsx",
  "src/features/my-work/MyWorkPage.tsx",
  "src/features/standup/StandupPage.tsx",
  "src/features/analytics/AnalyticsPage.tsx",
  "src/config/queryKeys.ts",
  "src/components/layout/AppShell.tsx",
  "src/components/guards/RequireAuth.tsx",
  "src/features/decisions/DecisionsPage.tsx",
  "src/features/processes/ProcessesPage.tsx",
];

// Semantic steps → structured log entries
const STEP_LOGS: { level: LogLevel; messages: string[] }[] = [
  {
    level: "CONN",
    messages: [
      "Establishing connection to GitHub...",
      "Authentication verified via token",
    ],
  },
  {
    level: "INDEX",
    messages: ["Fetching repository tree...", "Discovering source files..."],
  },
  {
    level: "PARSE",
    messages: [
      "Resolving TypeScript component tree...",
      "Mapping route registrations",
    ],
  },
  { level: "PARSE", messages: ["Analyzing data flow patterns..."] },
  { level: "SCAN", messages: ["Starting batch analysis..."] },
  { level: "XREF", messages: ["Validating API contracts..."] },
  { level: "XREF", messages: ["Cross-referencing downstream dependencies..."] },
  { level: "COMPILE", messages: ["Compiling validated findings..."] },
];

function fmtTs(startMs: number): string {
  const elapsed = Date.now() - startMs;
  const d = new Date(elapsed);
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  const s = String(d.getUTCSeconds()).padStart(2, "0");
  const ms = String(d.getUTCMilliseconds()).padStart(3, "0");
  return `${h}:${m}:${s}.${ms}`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ─── Main Page ──────────────────────────────────────────── */

export default function CodeReviewPage() {
  const user = useAuthStore((s) => s.user);

  const [phase, setPhase] = useState<Phase>("idle");
  const [repos, setRepos] = useState<RepoOption[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [records, setRecords] = useState<CodeReviewFindingRecord[]>([]);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [activeSnapshotId, setActiveSnapshotId] = useState<string | null>(null);
  const [isHistoricalView, setIsHistoricalView] = useState(false);

  // AI terminal state
  const [logLines, setLogLines] = useState<LogLine[]>([]);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStepLabel, setScanStepLabel] = useState("");
  const [scannedFiles, setScannedFiles] = useState<string[]>(
    SCAN_STEPS_PLACEHOLDER,
  );
  const scanStartRef = useRef<number>(0);
  const logIdRef = useRef(0);

  // Drawer state
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [ticketFindingId, setTicketFindingId] = useState<string | null>(null);

  const { data: filtersData } = useQuery({
    queryKey: ["filters"],
    queryFn: fetchFilters,
  });

  const defaultPod = user?.pod ?? filtersData?.pods?.[0] ?? "DPAI";

  // Run history for selected repo
  const { data: history = [], refetch: refetchHistory } = useQuery({
    queryKey: ["code-review-history", selectedRepo],
    queryFn: () => fetchCodeReviewHistory(selectedRepo!),
    enabled: !!selectedRepo,
  });

  // Load repos on mount
  useEffect(() => {
    const raw = localStorage.getItem("eap-auth");
    const token: string | null = raw
      ? (JSON.parse(raw)?.state?.token ?? null)
      : null;
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
    fetch(`${apiUrl}/api/code-review/repos`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data) => {
        const list: RepoOption[] = data?.repos ?? [];
        setRepos(list);
        if (list.length === 1) setSelectedRepo(list[0].slug);
      })
      .catch(() => {});
  }, []);

  // Push a log line
  const pushLog = useCallback((level: LogLevel, message: string) => {
    const id = ++logIdRef.current;
    const ts = fmtTs(scanStartRef.current);
    setLogLines((prev) => [...prev, { id, ts, level, message }]);
  }, []);

  // AI terminal animation
  useEffect(() => {
    if (phase !== "scanning") return;

    scanStartRef.current = Date.now();
    setLogLines([]);
    setScanProgress(0);
    setScanStepLabel("Initialising...");
    logIdRef.current = 0;

    const timeouts: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;

    // Stream semantic step logs
    STEP_LOGS.forEach((step, stepIdx) => {
      step.messages.forEach((msg, msgIdx) => {
        const t = setTimeout(
          () => {
            pushLog(step.level, msg);
            setScanStepLabel(msg);
            setScanProgress(
              Math.round(((stepIdx + 1) / STEP_LOGS.length) * 85),
            );
          },
          elapsed + msgIdx * 220,
        );
        timeouts.push(t);
      });
      elapsed += step.messages.length * 220 + 350;
    });

    // Stream file scan lines interleaved
    const fileStart = 900;
    scannedFiles.forEach((file, i) => {
      const t = setTimeout(
        () => {
          pushLog("SCAN", `${file}`);
        },
        fileStart + i * 90,
      );
      timeouts.push(t);
    });

    // Backend call
    const backendDelay =
      Math.max(elapsed, fileStart + scannedFiles.length * 90) + 600;
    const backendTimeout = setTimeout(async () => {
      try {
        const raw = localStorage.getItem("eap-auth");
        const token: string | null = raw
          ? (JSON.parse(raw)?.state?.token ?? null)
          : null;
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
        const res = await fetch(`${apiUrl}/api/code-review/analyze`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ github_repo: selectedRepo }),
        });
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const data = await res.json();
        const findings = Array.isArray(data?.findings) ? data.findings : [];
        const serverFiles: string[] = Array.isArray(data?.scanned_files)
          ? data.scanned_files
          : [];
        if (serverFiles.length > 0) setScannedFiles(serverFiles);
        setActiveSnapshotId(data?.snapshot_id ?? null);
        setRecords(mergeFindingsWithState(findings));
        pushLog(
          "DONE",
          `Analysis complete — ${findings.length} finding${findings.length !== 1 ? "s" : ""} validated`,
        );
        setScanProgress(100);
        setScanStepLabel("Done");
        // Refresh history so new run appears
        refetchHistory();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Analysis failed";
        pushLog("WARN", `Analysis failed: ${msg}`);
        setAnalyzeError(msg);
        setRecords([]);
      }
      setIsHistoricalView(false);
      setPhase("done");
    }, backendDelay);
    timeouts.push(backendTimeout);

    return () => timeouts.forEach(clearTimeout);
  }, [phase]);

  function handleStart() {
    setPhase("scanning");
    setRecords([]);
    setActiveSnapshotId(null);
    setAnalyzeError(null);
    setIsHistoricalView(false);
    setViewingId(null);
    setTicketFindingId(null);
    setScannedFiles(SCAN_STEPS_PLACEHOLDER);
  }

  async function handleLoadSnapshot(snap: CodeReviewSnapshotMeta) {
    try {
      const detail = await fetchCodeReviewSnapshot(snap.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setRecords(mergeFindingsWithState(detail.findings as any));
      setActiveSnapshotId(snap.id);
      setIsHistoricalView(true);
      setAnalyzeError(null);
      setPhase("done");
      setViewingId(null);
    } catch {
      // silently ignore
    }
  }

  function handleSelectRepo(slug: string) {
    if (slug === selectedRepo) return;
    setSelectedRepo(slug);
    setPhase("idle");
    setRecords([]);
    setActiveSnapshotId(null);
    setAnalyzeError(null);
    setIsHistoricalView(false);
    setViewingId(null);
  }

  function patchFinding(
    findingId: string,
    patch: Partial<CodeReviewFindingState>,
  ) {
    setRecords((prev) => updateFindingState(findingId, patch, prev));
  }

  function handleApprove(findingId: string) {
    patchFinding(findingId, { status: "approved" });
    setViewingId(null);
    setTicketFindingId(findingId);
  }

  const stats = {
    critical: records.filter((r) => r.severity === "critical").length,
    high: records.filter((r) => r.severity === "high").length,
    medium: records.filter((r) => r.severity === "medium").length,
    total: records.length,
  };

  const viewing = records.find((r) => r.id === viewingId) ?? null;
  const ticketFinding = records.find((r) => r.id === ticketFindingId) ?? null;
  const activeSnap = history.find((h) => h.id === activeSnapshotId);

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div>
        <h1 className={styles.headerTitle}>Code Review</h1>
      </div>

      {/* ── Body ── */}
      <div className={styles.body}>
        {/* Left Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarScroll}>
            {/* Repositories */}
            <div className={styles.sidebarSection}>Repositories</div>
            {repos.length === 0 ? (
              <div className={styles.sidebarEmpty}>
                No repos configured.
                <br />
                Add <code>GITHUB_REPOS</code> to backend <code>.env</code>
              </div>
            ) : (
              <div className={styles.repoList}>
                {repos.map((repo) => {
                  const lastRun =
                    history.length > 0 && selectedRepo === repo.slug
                      ? history[0]
                      : null;
                  return (
                    <button
                      key={repo.slug}
                      className={`${styles.repoTab} ${selectedRepo === repo.slug ? styles.repoTabActive : ""}`}
                      onClick={() => handleSelectRepo(repo.slug)}
                    >
                      <div className={styles.repoTabIcon}>
                        <RiGitRepositoryLine size={13} />
                      </div>
                      <div className={styles.repoTabInfo}>
                        <span className={styles.repoTabName}>{repo.name}</span>
                        <span className={styles.repoTabFull}>
                          {repo.full_name}
                        </span>
                        {lastRun && (
                          <div className={styles.repoTabMeta}>
                            {lastRun.critical_count > 0 && (
                              <span className={styles.metaPillCritical}>
                                {lastRun.critical_count}C
                              </span>
                            )}
                            {lastRun.high_count > 0 && (
                              <span className={styles.metaPillHigh}>
                                {lastRun.high_count}H
                              </span>
                            )}
                            {lastRun.medium_count > 0 && (
                              <span className={styles.metaPillMed}>
                                {lastRun.medium_count}M
                              </span>
                            )}
                            <span className={styles.metaTime}>
                              {relativeTime(lastRun.run_at)}
                            </span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Run History */}
            {selectedRepo && (
              <>
                <div className={styles.sidebarSection} style={{ marginTop: 8 }}>
                  <RiHistoryLine size={11} />
                  Run History
                </div>
                {history.length === 0 ? (
                  <div className={styles.sidebarEmpty}>
                    No runs yet for this repo.
                  </div>
                ) : (
                  <div className={styles.historyList}>
                    {history.map((snap, idx) => {
                      const isActive = snap.id === activeSnapshotId;
                      return (
                        <button
                          key={snap.id}
                          className={`${styles.historyEntry} ${isActive ? styles.historyEntryActive : ""}`}
                          onClick={() => handleLoadSnapshot(snap)}
                        >
                          <div className={styles.historyEntryTop}>
                            <span className={styles.historyEntryTime}>
                              <RiTimeLine size={10} />
                              {relativeTime(snap.run_at)}
                            </span>
                            {idx === 0 && (
                              <span className={styles.latestBadge}>Latest</span>
                            )}
                          </div>
                          <div className={styles.historyEntryDate}>
                            {new Date(snap.run_at).toLocaleDateString(
                              undefined,
                              {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </div>
                          <div className={styles.historyEntryStats}>
                            {snap.critical_count > 0 && (
                              <span className={styles.metaPillCritical}>
                                {snap.critical_count} Critical
                              </span>
                            )}
                            {snap.high_count > 0 && (
                              <span className={styles.metaPillHigh}>
                                {snap.high_count} High
                              </span>
                            )}
                            {snap.medium_count > 0 && (
                              <span className={styles.metaPillMed}>
                                {snap.medium_count} Med
                              </span>
                            )}
                            {snap.total_count === 0 && (
                              <span className={styles.metaPillClean}>
                                Clean
                              </span>
                            )}
                            <span className={styles.historyFileCount}>
                              {snap.scanned_files_count} files
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className={styles.main}>
          {/* No repo selected */}
          {!selectedRepo && (
            <div className={styles.emptyMain}>
              <RiGitRepositoryLine size={32} color="var(--text-2)" />
              <p>Select a repository from the left panel to begin</p>
            </div>
          )}

          {/* Run bar — idle phase only */}
          {selectedRepo && phase === "idle" && (
            <div className={styles.idleRunBar}>
              <button className={styles.runBtn} onClick={handleStart}>
                <RiPlayLine size={13} />
                Run Analysis
              </button>
            </div>
          )}

          {/* Idle — repo selected */}
          {selectedRepo && phase === "idle" && (
            <IdleMain
              repo={repos.find((r) => r.slug === selectedRepo)!}
              history={history}
              onStart={handleStart}
              onLoadSnapshot={handleLoadSnapshot}
            />
          )}

          {/* Scanning — AI terminal */}
          {phase === "scanning" && (
            <ScanTerminal
              repo={selectedRepo!}
              logLines={logLines}
              progress={scanProgress}
              stepLabel={scanStepLabel}
            />
          )}

          {/* Done — findings */}
          {phase === "done" && (
            <FindingsMain
              records={records}
              stats={stats}
              analyzeError={analyzeError}
              isHistorical={isHistoricalView}
              activeSnap={activeSnap}
              onView={(id) => setViewingId(id)}
              onApprove={handleApprove}
              onRerun={handleStart}
            />
          )}
        </main>
      </div>

      {/* Bug Detail Drawer */}
      {viewing && (
        <BugDrawer
          finding={viewing}
          onClose={() => setViewingId(null)}
          onApprove={() => handleApprove(viewing.id)}
          onPatch={(patch) => patchFinding(viewing.id, patch)}
        />
      )}

      {/* Create Ticket Drawer */}
      {ticketFinding && (
        <CreateTicketDrawer
          open
          onClose={() => setTicketFindingId(null)}
          defaultStatus="To Do"
          defaultPod={ticketFinding.ticketDraft.pod ?? defaultPod}
          initialData={{
            title: ticketFinding.ticketDraft.title,
            description: ticketFinding.ticketDraft.description,
            issue_type: "Bug",
            priority:
              ticketFinding.severity === "critical"
                ? "Highest"
                : ticketFinding.severity === "high"
                  ? "High"
                  : "Medium",
            labels: ticketFinding.ticketDraft.labels,
            pod: ticketFinding.ticketDraft.pod ?? defaultPod,
          }}
          onSuccess={() => {
            patchFinding(ticketFinding.id, { status: "ticketed" });
            setTicketFindingId(null);
          }}
        />
      )}
    </div>
  );
}

/* ─── IdleMain ───────────────────────────────────────────── */

function IdleMain({
  repo,
  history,
  onStart: _onStart,
  onLoadSnapshot,
}: {
  repo: RepoOption;
  history: CodeReviewSnapshotMeta[];
  onStart: () => void;
  onLoadSnapshot: (snap: CodeReviewSnapshotMeta) => void;
}) {
  const lastRun = history[0] ?? null;
  return (
    <div className={styles.idleMain}>
      <div className={styles.idleCard}>
        <div className={styles.idleCardTitle}>{repo.name}</div>
        <div className={styles.idleCardFull}>{repo.full_name}</div>
        {lastRun ? (
          <div className={styles.idleLastRun}>
            <span className={styles.idleLastRunLabel}>Last run</span>
            <span className={styles.idleLastRunTime}>
              {relativeTime(lastRun.run_at)}
            </span>
            <div className={styles.idleLastRunStats}>
              {lastRun.critical_count > 0 && (
                <span className={styles.metaPillCritical}>
                  {lastRun.critical_count} Critical
                </span>
              )}
              {lastRun.high_count > 0 && (
                <span className={styles.metaPillHigh}>
                  {lastRun.high_count} High
                </span>
              )}
              {lastRun.medium_count > 0 && (
                <span className={styles.metaPillMed}>
                  {lastRun.medium_count} Med
                </span>
              )}
              {lastRun.total_count === 0 && (
                <span className={styles.metaPillClean}>Clean</span>
              )}
            </div>
            <button
              className={styles.idleLoadLastBtn}
              onClick={() => onLoadSnapshot(lastRun)}
            >
              View last results
            </button>
          </div>
        ) : (
          <div className={styles.idleNoHistory}>No previous runs</div>
        )}
        <p className={styles.idleHint}>
          EOS will fetch source files, validate bugs with direct evidence,
          <br />
          and surface only real, actionable findings.
        </p>
      </div>
    </div>
  );
}

/* ─── ScanTerminal ───────────────────────────────────────── */

const LOG_LEVEL_CLASS: Record<LogLevel, string> = {
  CONN: "logConn",
  INDEX: "logIndex",
  PARSE: "logParse",
  SCAN: "logScan",
  XREF: "logXref",
  COMPILE: "logCompile",
  DONE: "logDone",
  WARN: "logWarn",
};

function ScanTerminal({
  repo,
  logLines,
  progress,
  stepLabel,
}: {
  repo: string;
  logLines: LogLine[];
  progress: number;
  stepLabel: string;
}) {
  const termRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [logLines]);

  return (
    <div className={styles.terminal}>
      <div className={styles.terminalHeader}>
        <div className={styles.terminalDots}>
          <span className={styles.termDotRed} />
          <span className={styles.termDotAmber} />
          <span className={styles.termDotGreen} />
        </div>
        <span className={styles.terminalTitle}>
          EOS · Analyzing <strong>{repo}</strong>
        </span>
        <div className={styles.terminalSpinner} />
      </div>

      <div className={styles.terminalBody} ref={termRef}>
        {logLines.map((line) => (
          <div
            key={line.id}
            className={`${styles.logLine} ${styles[LOG_LEVEL_CLASS[line.level]]}`}
          >
            <span className={styles.logTs}>{line.ts}</span>
            <span className={styles.logLevel}>{line.level}</span>
            <span className={styles.logMsg}>{line.message}</span>
          </div>
        ))}
        {logLines.length > 0 && (
          <div className={`${styles.logLine} ${styles.logCursor}`}>
            <span className={styles.logTs}>
              {logLines[logLines.length - 1]?.ts ?? ""}
            </span>
            <span className={styles.logLevel}>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            </span>
            <span className={styles.cursor}>█</span>
          </div>
        )}
      </div>

      <div className={styles.terminalFooter}>
        <div className={styles.termProgressBar}>
          <div
            className={styles.termProgressFill}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className={styles.termFooterMeta}>
          <span className={styles.termStepLabel}>
            {stepLabel || "Initialising..."}
          </span>
          <span className={styles.termPct}>{progress}%</span>
        </div>
      </div>
    </div>
  );
}

/* ─── FindingsMain ───────────────────────────────────────── */

function FindingsMain({
  records,
  stats,
  analyzeError,
  isHistorical,
  activeSnap,
  onView,
  onApprove,
  onRerun,
}: {
  records: CodeReviewFindingRecord[];
  stats: { critical: number; high: number; medium: number; total: number };
  analyzeError: string | null;
  isHistorical: boolean;
  activeSnap?: CodeReviewSnapshotMeta;
  onView: (id: string) => void;
  onApprove: (id: string) => void;
  onRerun: () => void;
}) {
  return (
    <div className={styles.findingsMain}>
      {/* Summary strip */}
      <div className={styles.summaryStrip}>
        <div className={styles.summaryLeft}>
          <RiShieldCheckLine size={14} color="var(--green)" />
          <span className={styles.summaryTitle}>
            {analyzeError
              ? "Analysis failed"
              : `${stats.total} finding${stats.total !== 1 ? "s" : ""} validated`}
          </span>
          {!analyzeError && (
            <div className={styles.summaryPills}>
              {stats.critical > 0 && (
                <span className={`${styles.metaPillCritical}`}>
                  {stats.critical} Critical
                </span>
              )}
              {stats.high > 0 && (
                <span className={`${styles.metaPillHigh}`}>
                  {stats.high} High
                </span>
              )}
              {stats.medium > 0 && (
                <span className={`${styles.metaPillMed}`}>
                  {stats.medium} Medium
                </span>
              )}
            </div>
          )}
        </div>
        <div className={styles.summaryRight}>
          {isHistorical && activeSnap && (
            <span className={styles.historyBadgeSm}>
              <RiHistoryLine size={10} />
              {new Date(activeSnap.run_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <button className={styles.runBtn} onClick={onRerun}>
            <RiPlayLine size={13} />
            {isHistorical ? "Run New" : "Re-run"}
          </button>
        </div>
      </div>

      {/* Bug grid */}
      <div className={styles.findingsScroll}>
        {analyzeError ? (
          <div className={styles.emptyFindings}>
            <RiBugLine size={28} color="var(--text-3)" />
            <p style={{ color: "var(--text-2)", margin: 0 }}>Analysis failed</p>
            <p style={{ color: "var(--text-3)", fontSize: 13, margin: 0 }}>
              {analyzeError}
            </p>
          </div>
        ) : records.length === 0 ? (
          <div className={styles.emptyFindings}>
            <RiShieldCheckLine size={28} color="var(--green)" />
            <p>No findings — the codebase looks clean!</p>
          </div>
        ) : (
          <BugGrid records={records} onView={onView} onApprove={onApprove} />
        )}
      </div>
    </div>
  );
}

/* ─── BugGrid ────────────────────────────────────────────── */

function BugGrid({
  records,
  onView,
  onApprove,
}: {
  records: CodeReviewFindingRecord[];
  onView: (id: string) => void;
  onApprove: (id: string) => void;
}) {
  const sorted = [...records].sort((a, b) => {
    const order: ReviewSeverity[] = ["critical", "high", "medium"];
    const delta = order.indexOf(a.severity) - order.indexOf(b.severity);
    return delta !== 0 ? delta : a.title.localeCompare(b.title);
  });

  return (
    <div className={styles.bugGrid}>
      {sorted.map((record) => (
        <BugCard
          key={record.id}
          record={record}
          onView={() => onView(record.id)}
          onApprove={() => onApprove(record.id)}
        />
      ))}
    </div>
  );
}

/* ─── BugCard ────────────────────────────────────────────── */

function BugCard({
  record,
  onView,
  onApprove,
}: {
  record: CodeReviewFindingRecord;
  onView: () => void;
  onApprove: () => void;
}) {
  return (
    <div className={`${styles.bugCard}`}>
      <div className={styles.bugCardBody}>
        <div className={styles.bugCardMeta}>
          <span
            className={`${styles.sevBadge} ${styles[`sev_${record.severity}`]}`}
          >
            {SEV_LABEL[record.severity]}
          </span>
          <span
            className={`${styles.statusBadge} ${styles[`status_${record.status}`]}`}
          >
            {STATUS_LABEL[record.status]}
          </span>
        </div>
        <div className={styles.bugCardTitle}>{record.title}</div>
        <div className={styles.bugCardArea}>{record.area}</div>
        <p className={styles.bugCardSummary}>{record.summary}</p>
        <div className={styles.bugCardFiles}>
          {record.files.slice(0, 2).map((f) => (
            <span key={`${f.path}-${f.line}`} className={styles.fileChip}>
              {f.path.split("/").slice(-1)[0]}
              {f.line ? `:${f.line}` : ""}
            </span>
          ))}
        </div>
      </div>
      <div className={styles.bugCardFoot}>
        <button className={styles.viewBtn} onClick={onView}>
          View Details
        </button>
        <button className={styles.approveBtn} onClick={onApprove}>
          Approve →
        </button>
      </div>
    </div>
  );
}

/* ─── BugDrawer ──────────────────────────────────────────── */

function BugDrawer({
  finding,
  onClose,
  onApprove,
  onPatch,
}: {
  finding: CodeReviewFindingRecord;
  onClose: () => void;
  onApprove: () => void;
  onPatch: (patch: Partial<CodeReviewFindingState>) => void;
}) {
  return (
    <>
      <div className={styles.drawerBackdrop} onClick={onClose} />
      <aside className={styles.drawer}>
        <div className={styles.drawerHead}>
          <div className={styles.drawerHeadLeft}>
            <div className={styles.drawerHeadBadges}>
              <span
                className={`${styles.sevBadge} ${styles[`sev_${finding.severity}`]}`}
              >
                {SEV_LABEL[finding.severity]}
              </span>
              <span
                className={`${styles.statusBadge} ${styles[`status_${finding.status}`]}`}
              >
                {STATUS_LABEL[finding.status]}
              </span>
              <span className={styles.drawerArea}>{finding.area}</span>
            </div>
            <h2 className={styles.drawerTitle}>{finding.title}</h2>
          </div>
          <button
            className={styles.drawerClose}
            onClick={onClose}
            aria-label="Close"
          >
            <RiCloseLine size={18} />
          </button>
        </div>

        <div className={styles.drawerBody}>
          <div className={styles.drawerSection}>
            <div className={styles.drawerSectionTitle}>Why This Is a Bug</div>
            <p className={styles.drawerSectionText}>{finding.whyValid}</p>
          </div>
          <div className={styles.drawerSection}>
            <div className={styles.drawerSectionTitle}>User Impact</div>
            <p className={styles.drawerSectionText}>{finding.impact}</p>
          </div>
          <div className={styles.drawerSection}>
            <div className={styles.drawerSectionTitle}>Evidence</div>
            <ul className={styles.drawerList}>
              {finding.evidence.map((item) => (
                <li key={item} className={styles.drawerListItem}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.drawerSection}>
            <div className={styles.drawerSectionTitle}>Reproduction Steps</div>
            <ol className={styles.drawerListOrdered}>
              {finding.reproduction.map((step, i) => (
                <li key={i} className={styles.drawerListItem}>
                  {step}
                </li>
              ))}
            </ol>
          </div>
          <div className={styles.drawerSection}>
            <div className={styles.drawerSectionTitle}>Affected Files</div>
            <div className={styles.drawerFiles}>
              {finding.files.map((f) => (
                <div
                  key={`${f.path}-${f.line}`}
                  className={styles.drawerFileRow}
                >
                  <span className={styles.drawerFilePath}>{f.path}</span>
                  {f.line && (
                    <span className={styles.drawerFileLine}>:{f.line}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className={styles.drawerSection}>
            <div className={styles.drawerSectionTitle}>Reviewer Notes</div>
            <textarea
              className={styles.drawerNotes}
              placeholder="Capture your review notes, acceptance comments, or ticket scoping here…"
              value={finding.reviewerNotes}
              onChange={(e) => onPatch({ reviewerNotes: e.target.value })}
            />
          </div>
        </div>

        <div className={styles.drawerFoot}>
          <button
            className={styles.rejectBtn}
            onClick={() => {
              onPatch({ status: "rejected" });
              onClose();
            }}
          >
            Reject
          </button>
          <button
            className={styles.reviewingBtn}
            onClick={() => onPatch({ status: "reviewing" })}
          >
            Mark Reviewing
          </button>
          <button className={styles.approveTicketBtn} onClick={onApprove}>
            Approve &amp; File Bug
          </button>
        </div>
      </aside>
    </>
  );
}
