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

export const CODE_REVIEW_SNAPSHOT = {
  id: "frontend-validated-snapshot-2026-04-24",
  createdAt: "2026-04-24",
  scope: "trackly-frontend",
};

const SEEDED_FINDINGS: CodeReviewFinding[] = [
  {
    id: "wiki-ticket-links-backlog-route",
    title: "Wiki ticket links route to a non-existent /backlog page",
    area: "Wiki",
    severity: "high",
    summary: "Ticket references inside the wiki navigate to `/backlog?search=...`, but the app does not define a `/backlog` route anywhere.",
    impact: "Users clicking linked tickets from wiki pages or related docs are redirected away from the intended ticket view, breaking navigation from documentation into execution.",
    whyValid: "The click handlers in `WikiPage.tsx` call `navigate(`/backlog?search=...`)`, while `App.tsx` has no `/backlog` route. The router falls through to the catch-all redirect instead.",
    evidence: [
      "Wiki editor click handling sends ticket references to `/backlog?search=...`.",
      "Related document ticket selections use the same broken destination.",
      "Route registration contains `/tickets`, `/wiki`, `/spaces`, etc., but no `/backlog` path.",
    ],
    reproduction: [
      "Open Wiki and select a page containing a linked ticket reference.",
      "Click the ticket reference or a related-doc ticket chip.",
      "Observe that the app cannot land on a backlog page because the route does not exist.",
    ],
    files: [
      { path: "src/features/wiki/WikiPage.tsx", line: 439 },
      { path: "src/features/wiki/WikiPage.tsx", line: 651 },
      { path: "src/app/App.tsx", line: 104 },
    ],
    ticketDraft: {
      title: "Wiki ticket references navigate to missing backlog route",
      description: "Ticket references inside Wiki currently navigate to `/backlog?search=...`, but the frontend does not register a `/backlog` route. Clicking those links drops users into the catch-all redirect instead of the intended ticket surface.\n\nAcceptance criteria:\n- Wiki ticket references open a valid ticket destination.\n- Related docs ticket shortcuts use the same valid route.\n- Navigation is verified from both inline editor links and related-doc widgets.",
      labels: ["bug", "wiki", "routing"],
      pod: "DPAI",
    },
  },
  {
    id: "dashboard-create-ticket-quick-action-ignored",
    title: "Dashboard 'Create Ticket' quick action does not open the create drawer",
    area: "Dashboard",
    severity: "high",
    summary: "The dashboard quick action navigates to `/tickets?new=1`, but `TicketsPage` only reads the `key` query param and never reacts to `new`.",
    impact: "Users click a primary dashboard shortcut expecting immediate ticket creation, but the app only opens the ticket list page with no drawer, adding friction to a core flow.",
    whyValid: "The quick action emits `?new=1`. `TicketsPage.tsx` reads `searchParams.get(\"key\")` only and initializes `showCreate` to `false`, so the drawer never opens from this route.",
    evidence: [
      "QuickActions uses `navigate(\"/tickets?new=1\")` for the Create Ticket action.",
      "TicketsPage uses search params only for `key`-driven edit mode.",
      "There is no effect or conditional that opens the create drawer when `new=1` is present.",
    ],
    reproduction: [
      "Open My Work or any surface showing the dashboard quick actions.",
      "Click 'Create Ticket'.",
      "Confirm that the app navigates to Tickets, but no create drawer opens automatically.",
    ],
    files: [
      { path: "src/features/dashboard/widgets/QuickActions.tsx", line: 26 },
      { path: "src/features/tickets/TicketsPage.tsx", line: 77 },
    ],
    ticketDraft: {
      title: "Dashboard quick action fails to launch ticket creation flow",
      description: "The dashboard 'Create Ticket' quick action currently navigates to `/tickets?new=1`, but `TicketsPage` ignores the `new` query param and leaves the create drawer closed.\n\nAcceptance criteria:\n- Navigating to `/tickets?new=1` opens the create ticket drawer automatically.\n- Closing the drawer clears the transient create intent cleanly.\n- Existing `?key=` edit behavior remains unchanged.",
      labels: ["bug", "dashboard", "tickets"],
      pod: "DPAI",
    },
  },
  {
    id: "dashboard-new-wiki-page-quick-action-ignored",
    title: "Dashboard 'New Wiki Page' quick action does not start wiki creation",
    area: "Dashboard",
    severity: "medium",
    summary: "The dashboard quick action navigates to `/wiki?new=1`, but `WikiPage` only reads the `page` query param and never opens templates or a blank draft for `new=1`.",
    impact: "A top-level productivity shortcut advertises new-page creation but drops the user onto the generic wiki landing state instead of starting the flow they requested.",
    whyValid: "QuickActions emits `?new=1`. `WikiPage.tsx` only consumes `page` from search params and contains no effect that opens templates or creates a blank page from `new=1`.",
    evidence: [
      "QuickActions navigates to `/wiki?new=1` for 'New Wiki Page'.",
      "WikiPage reads `searchParams.get(\"page\")` and ignores `new` entirely.",
      "No UI state is toggled from the query string to open the template modal or create flow.",
    ],
    reproduction: [
      "Open dashboard quick actions.",
      "Click 'New Wiki Page'.",
      "Observe that the wiki opens without starting a new-page flow.",
    ],
    files: [
      { path: "src/features/dashboard/widgets/QuickActions.tsx", line: 33 },
      { path: "src/features/wiki/WikiPage.tsx", line: 131 },
    ],
    ticketDraft: {
      title: "Dashboard quick action does not launch wiki page creation",
      description: "The dashboard 'New Wiki Page' shortcut navigates to `/wiki?new=1`, but `WikiPage` never interprets that intent. Users land on the general wiki screen instead of the new-page flow.\n\nAcceptance criteria:\n- Navigating to `/wiki?new=1` opens a clear page-creation entry point.\n- The experience should work whether the user has an active page selected or not.\n- Closing the creation flow should clear the transient query-driven intent.",
      labels: ["bug", "dashboard", "wiki"],
      pod: "DPAI",
    },
  },
];

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function defaultFindingState(): CodeReviewFindingState {
  return {
    status: "new",
    reviewerNotes: "",
    updatedAt: CODE_REVIEW_SNAPSHOT.createdAt,
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

export function getFindingRecords(): CodeReviewFindingRecord[] {
  const stored = readFindingState();
  return SEEDED_FINDINGS.map((finding) => ({
    ...finding,
    ...(stored[finding.id] ?? defaultFindingState()),
  }));
}

export function updateFindingState(
  findingId: string,
  patch: Partial<CodeReviewFindingState>,
): CodeReviewFindingRecord[] {
  const current = readFindingState();
  current[findingId] = {
    ...(current[findingId] ?? defaultFindingState()),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  writeFindingState(current);
  return getFindingRecords();
}
