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
  assignee:                 string
  assignee_email:           string
  status:                   string
  client:                   string
  pod:                      string
  hours_spent:              number
  original_estimate_hours:  number
  remaining_estimate_hours: number
  created:                  string
  updated:                  string
  issue_type:               string
  priority:                 string
  url:                      string
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

export interface ExportConfig {
  reportType:  ReportType
  monthLabel:  string
  fyLabel:     string
  dateFrom:    string
  dateTo:      string
  pod:         string | null
  client:      string | null
  project:     string | null
  engineer:    string | null
  sheets: {
    rawData:    boolean
    podSummary: boolean
    breakdown:  boolean
    pivot:      boolean
  }
}

/* ── Ticket (extended for creation/management) ── */
export interface TicketCreate {
  title:        string
  description:  string
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
  id:         number
  ticket_key: string
  author:     string
  author_email: string
  content:    string
  parent_id?: number
  created_at: string
  replies?:   TicketComment[]
}

export interface TicketAttachment {
  id:         number
  ticket_key: string
  filename:   string
  url:        string
  size:       number
  uploaded_by: string
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
  id:          number
  name:        string
  slug:        string
  description: string
  icon?:       string
  created_at:  string
}

export interface WikiPage {
  id:          number
  space_id:    number
  space_name?: string
  parent_id?:  number
  title:       string
  slug:        string
  content:     string
  author:      string
  created_at:  string
  updated_at:  string
  children?:   WikiPage[]
}

export interface WikiVersion {
  id:          number
  page_id:     number
  version:     number
  title:       string
  content:     string
  author:      string
  created_at:  string
}

export interface RelatedDoc {
  id:         number
  type:       'ticket' | 'wiki'
  title:      string
  key?:       string
  similarity: number
  url?:       string
}

/* ── Sprint ── */
export type SprintStatus = 'planning' | 'active' | 'completed'

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
}

export interface VelocityPoint {
  sprint:      string
  committed:   number
  completed:   number
}

/* ── Standup ── */
export interface Standup {
  id:          number
  engineer:    string
  engineer_email: string
  date:        string
  yesterday:   string
  today:       string
  blockers:    string
  pod:         string
  shared:      boolean
  created_at:  string
}

/* ── Knowledge Gap ── */
export interface KnowledgeGap {
  id:          number
  topic:       string
  description: string
  ticket_count: number
  wiki_count:  number
  detected_at: string
}

/* ── Search ── */
export interface SearchResult {
  id:         number
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

/* ── Timer ── */
export interface TimerState {
  running:    boolean
  startedAt:  number | null
  elapsed:    number
  ticketKey?: string
  ticketTitle?: string
}