/* ── Ticket ── */
export interface Worklog {
  author:  string
  email:   string
  date:    string
  hours:   number
  comment: string
}

export interface Ticket {
  key:                      string
  project_key:              string
  project_name:             string
  summary:                  string
  description?:             string
  assignee:                 string
  assignee_email:           string
  reporter?:                string
  status:                   string
  client:                   string
  pod:                      string
  hours_spent:              number
  original_estimate_hours:  number
  remaining_estimate_hours: number
  story_points?:            number
  labels?:                  string[]
  due_date?:                string
  created:                  string
  updated:                  string
  issue_type:               string
  priority:                 string
  url:                      string
  sprint_id?:               string | null
  epic?:                    string
  parent?:                  string
  worklogs:                 Worklog[]
}

/* ── API Responses ── */
export interface TicketsResponse {
  tickets: Ticket[]
  count:   number
  total:   number
  limit:   number
  offset:  number
}

export interface SummaryByUser {
  user:    string
  hours:   number
  tickets: number
  clients: string[]
}

export interface SummaryByClient {
  client:  string
  hours:   number
  tickets: number
  users:   string[]
}

export interface SummaryByPod {
  pod:     string
  hours:   number
  tickets: number
  clients: string[]
}

export interface SummaryByIssueType {
  issue_type: string
  hours:      number
  tickets:    number
  pct:        number
}

export interface SummaryResponse {
  by_user:        SummaryByUser[]
  by_client:      SummaryByClient[]
  by_pod:         SummaryByPod[]
  by_issue_type:  SummaryByIssueType[]
  total_tickets: number
  total_hours:   number
}

export interface FiltersResponse {
  users:    string[]
  clients:  string[]
  pods:     string[]
  projects: string[]
}

/* ── Filter State ── */
export interface FilterState {
  dateFrom:    string | null
  dateTo:      string | null
  user:        string | null
  client:      string | null
  pod:         string | null
  project:     string | null
  search:      string
  issueType:   string | null
}

/* ── Theme ── */
export type ThemeId   = 'default' | 'emerald' | 'violet' | 'rose'
export type ColorMode = 'dark' | 'light'

export interface Theme {
  id:    ThemeId
  name:  string
  color: string   // preview swatch hex
}

/* ── Export ── */
export type ReportType = 'monthly' | 'fy'

/* ── Ticket (extended for creation/management) ── */
export interface TicketCreate {
  title:        string
  description:  string
  reporter?:    string
  assignee?:    string
  pod?:         string
  client?:      string
  issue_type:   string
  priority:     string
  status?:      string
  story_points?: number
  sprint_id?:   string
  labels?:      string[]
  due_date?:    string
}

export interface TicketComment {
  id:           string
  ticket_key:   string
  author:       string
  author_email?: string
  content:      string
  body?:        string
  parent_id?:   string
  created_at:   string
  replies?:     TicketComment[]
}

export interface TicketAttachment {
  id:          string
  ticket_key:  string
  filename:    string
  url:         string
  filepath?:   string
  size:        number
  size_bytes?: number
  uploaded_by?: string
  uploaded_at: string
}

export interface TicketActivity {
  id:         number
  ticket_key: string
  actor:      string
  action:     string
  field?:     string
  old_value?: string
  new_value?: string
  created_at: string
}

export interface DuplicateTicket {
  key:        string
  summary:    string
  status:     string
  similarity: number
}

export interface NLAnalysisResult {
  title?:        string
  description?:  string
  pod?:          string
  client?:       string
  issue_type?:   string
  priority?:     string
  story_points?: number
  assignee?:     string
  labels?:       string[]
  duplicates?:   DuplicateTicket[]
  confidence?:   number
}

/* ── Wiki ── */
export interface WikiSpace {
  id:          string
  name:        string
  slug:        string
  description: string
  icon?:       string
  created_at:  string
}

export interface WikiPage {
  id:          string
  space_id:    string
  space_name?: string
  parent_id?:  string
  title:       string
  slug?:       string
  content_md?: string
  content_html?: string
  author_name?: string
  created_at:  string
  updated_at:  string
  children?:   WikiPage[]
}

export interface WikiVersion {
  id:          string
  page_id:     string
  version:     number
  title:       string
  content_md?: string
  content_html?: string
  author_name?: string
  created_at:  string
}

export interface RelatedDoc {
  id:         string
  type:       'ticket' | 'wiki'
  title:      string
  key?:       string
  similarity: number
  url?:       string
}

/* ── Org Members ── */
export interface OrgMember {
  id:           string
  name:         string
  email:        string
  role:         string
  pod:          string | null
  emp_no:       string | null
  reporting_to: string | null
  title:        string | null
}

/* ── Sprint ── */
export type SprintStatus = 'planning' | 'active' | 'scope_freeze' | 'eos_review' | 'completed'

export interface Sprint {
  id:              string
  name:            string
  goal?:           string
  start_date:      string
  end_date:        string
  status:          SprintStatus
  total_points:    number
  done_points:     number
  ticket_count?:   number
  completion_pct?: number
  velocity?:       number | null
  tickets?:        Ticket[]
  pod?:            string
}

export interface BurndownPoint {
  date:       string
  ideal:      number
  actual:     number
  scope?:     number
  trend?:     number
  drift?:     number
  anomaly?:   boolean
}

export interface VelocityPoint {
  sprint:      string
  committed:   number
  completed:   number
  predicted?:  number
  lower_bound?: number
  upper_bound?: number
}

/* ── Sprint Capacity ── */
export interface SprintMemberCapacity {
  user_id:       string
  name:          string
  avatar?:       string
  role:          string
  total_hours:   number
  allocated_hours: number
  available_hours: number
  pto_days:      number
  skill_match_pct: number
  tickets:       { key: string; summary: string; points: number; hours: number }[]
  overloaded:    boolean
}

export interface SprintCapacity {
  sprint_id:     string
  total_capacity_hours: number
  allocated_hours: number
  available_hours: number
  utilization_pct: number
  members:       SprintMemberCapacity[]
  nova_powered:  boolean
  recommendation?: string
}

export interface BurnUpPoint {
  date:          string
  planned:       number
  completed:     number
  capacity:      number
  scope_changes: number
}

/* ── Sprint Blockers ── */
export interface SprintBlocker {
  key:           string
  summary:       string
  status:        string
  assignee:      string
  blocked_since: string
  hours_blocked: number
  blocking_count: number
  escalation_level: 'none' | 'alert' | 'escalated' | 'critical'
  ai_reason:     string
  suggested_action: string
}

/* ── Sprint Dependencies ── */
export interface SprintDependencyNode {
  key:           string
  summary:       string
  status:        string
  assignee:      string
  points:        number
  x:             number
  y:             number
  critical_path: boolean
  risk_level:    'low' | 'medium' | 'high'
}

export interface SprintDependencyEdge {
  from:          string
  to:            string
  type:          'blocks' | 'relates_to' | 'duplicates'
}

/* ── Sprint What-If ── */
export interface WhatIfScenario {
  id:            string
  name:          string
  changes:       { type: 'reassign' | 'remove' | 'add' | 'extend' | 'split'; ticket_key?: string; description: string }[]
  predicted_completion_pct: number
  predicted_velocity: number
  risk_change:   number
  capacity_impact: number
  days_impact:   number
  recommendation: string
}

/* ── Sprint Timeline ── */
export interface TimelineEvent {
  key:           string
  summary:       string
  assignee:      string
  start:         string
  end:           string
  status:        string
  progress_pct:  number
  dependencies:  string[]
  critical_path: boolean
}

/* ── Sprint Forecast ── */
export interface SprintForecast {
  sprint_id:     string
  current_probability: number
  trend_probability: number
  predicted_completion_date: string | null
  predicted_points: number
  confidence_interval: { lower: number; upper: number }
  risk_factors:  { factor: string; impact: number; severity: 'high' | 'medium' | 'low' }[]
  nova_summary:  string
  historical_accuracy: number
}

/* ── Sprint Risk Heatmap ── */
export interface SprintRiskTicket {
  key:           string
  summary:       string
  assignee:      string
  risk_score:    number
  risk_factors:  { name: string; score: number }[]
  days_in_status: number
  deadline_risk: 'none' | 'near' | 'overdue'
}

/* ── Sprint Wiki Gaps ── */
export interface SprintWikiGap {
  topic:         string
  ticket_count:  number
  example_tickets: string[]
  suggested_article_title: string
  priority:      'high' | 'medium' | 'low'
}

/* ── Sprint Chat ── */
export interface SprintChatMessage {
  id:            string
  role:          'user' | 'assistant'
  text:          string
  citations?:    { key: string; title: string; quote: string }[]
  created_at:    string
}

/* ── Standup ── */
export interface Standup {
  id:             string
  engineer:       string
  engineer_email: string
  date:           string
  yesterday:      string
  today:          string
  blockers:       string
  pod:            string
  shared:         boolean
  created_at:     string
}

/* ── Knowledge Gap ── */
export interface KnowledgeGap {
  id:              string
  topic:           string
  suggestion:      string | null
  ticket_count:    number
  wiki_coverage:   number
  example_tickets: string[]
  detected_at:     string | null
}

/* ── Search ── */
export interface SearchResult {
  id:         string | number
  type:       'ticket' | 'wiki'
  title:      string
  key?:       string
  snippet:    string
  score:      number
  url?:       string
  space?:     string
}

export interface NovaQueryResponse {
  answer:     string
  citations:  SearchResult[]
  query:      string
}

/* ── Notification ── */
export interface Notification {
  id:          number
  type:        string
  title:       string
  message:     string
  read:        boolean
  link?:       string
  created_at:  string
}

/* ── Client Budget / Burn Rate ── */
export interface ClientBudget {
  client:        string
  month:         number
  year:          number
  budget_hours:  number
  hours_used:    number
  burn_pct:      number
  status:        'on_track' | 'warning' | 'critical' | 'over_budget'
  nova_summary?: string
}

export interface BurnRateAlert {
  id:             string
  client:         string
  threshold_pct:  number
  hours_used:     number | null
  hours_budget:   number | null
  burn_pct:       number | null
  nova_summary:   string | null
  notified_at:    string | null
}

/* ── Analytics ── */
export interface WorkloadEntry {
  engineer:    string
  pod:         string
  total_hours: number
}

/* ── Goals / OKRs ── */
export type GoalStatus = "on_track" | "at_risk" | "behind" | "complete";

export interface KeyResult {
  id: string;
  title: string;
  current: number;
  target: number;
  unit: string;
  linked_tickets: string[];
  status: GoalStatus;
}

export interface Goal {
  id: string;
  quarter: string;
  title: string;
  description: string;
  owner: string;
  status: GoalStatus;
  overall_progress: number;
  key_results: KeyResult[];
  nova_insight?: string;
  linked_sprints: string[];
  created_at?: string;
  updated_at?: string;
}

export interface GoalsResponse {
  goals: Goal[];
  quarters: string[];
}

/* ── Decisions / ADRs ── */
export type DecisionStatus = "accepted" | "proposed" | "deprecated" | "superseded";

export interface Decision {
  id: string;
  number?: number;
  title: string;
  status: DecisionStatus;
  owner: string;
  date: string;
  context: string;
  decision: string;
  rationale: string;
  alternatives: string[];
  consequences: string;
  supersedes?: string;
  linkedTickets: string[];
  tags: string[];
  space_id?: string | null;
  org_level?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DecisionsResponse {
  decisions: Decision[];
  total: number;
}

/* ── Processes / SOPs ── */
export type ProcessCategory = "runbook" | "sop" | "compliance" | "template" | "workflow";
export type ProcessStatus = "active" | "draft" | "review" | "deprecated";

export interface ProcessStep {
  id: string;
  order: number;
  title: string;
  description: string;
  owner?: string;
  estimatedTime?: string;
  required: boolean;
}

export interface Process {
  id: string;
  title: string;
  category: ProcessCategory;
  status: ProcessStatus;
  owner: string;
  lastUpdated: string;
  description: string;
  steps: ProcessStep[];
  tags: string[];
  complianceRequired?: boolean;
  avgCompletionTime?: string;
  runCount?: number;
  space_id?: string | null;
  org_level?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProcessesResponse {
  processes: Process[];
  total: number;
}
