export type ReviewSeverity = "critical" | "high" | "medium";
export type ReviewStatus = "new" | "reviewing" | "approved" | "rejected" | "ticketed";

interface FindingFileRef {
  path: string;
  line?: number;
}

interface CodeReviewFinding {
  id: string;
  title: string;
  area: string;
  severity: ReviewSeverity;
  summary: string;
  impact: string;
  whyValid: string;
  evidence: string[];
  reproduction: string[];
  files: FindingFileRef[];
  ticketDraft: {
    title: string;
    description: string;
    labels: string[];
    pod?: string;
  };
}

export interface CodeReviewFindingState {
  status: ReviewStatus;
  reviewerNotes: string;
  updatedAt: string;
}

export interface CodeReviewFindingRecord extends CodeReviewFinding, CodeReviewFindingState {}

const STORAGE_KEY = "trackly-code-review-findings";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function defaultFindingState(): CodeReviewFindingState {
  return {
    status: "new",
    reviewerNotes: "",
    updatedAt: new Date().toISOString(),
  };
}

function readFindingState(): Record<string, CodeReviewFindingState> {
  if (!canUseStorage()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeFindingState(state: Record<string, CodeReviewFindingState>) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * Merge raw findings from the backend with any saved reviewer state
 * (status, notes, updatedAt) stored in localStorage.
 */
export function mergeFindingsWithState(
  findings: CodeReviewFinding[],
): CodeReviewFindingRecord[] {
  const stored = readFindingState();
  return findings.map((finding) => ({
    ...finding,
    ...(stored[finding.id] ?? defaultFindingState()),
  }));
}

export function updateFindingState(
  findingId: string,
  patch: Partial<CodeReviewFindingState>,
  currentRecords: CodeReviewFindingRecord[],
): CodeReviewFindingRecord[] {
  const stored = readFindingState();
  const existing = stored[findingId] ?? defaultFindingState();
  stored[findingId] = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  writeFindingState(stored);

  return currentRecords.map((r) =>
    r.id === findingId ? { ...r, ...stored[findingId] } : r,
  );
}
