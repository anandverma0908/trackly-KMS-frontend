import { DUMMY_SUMMARY, DUMMY_TICKETS, DUMMY_FILTERS, DUMMY_SPRINTS, DUMMY_ORG_MEMBERS, DUMMY_STANDUPS } from '@/utils/dummyData'
import { useAuthStore } from '@/features/auth/useAuthStore'
import type { FilterState, TicketCreate, Goal, GoalsResponse } from '@/types'
import type { Project } from '@/features/spaces/spacesData'

const delay = (ms = 450) => new Promise(r => setTimeout(r, ms))

let nextTicketId = 8000
let nextCommentId = 1

/* ── In-memory comment store for mock tickets ── */
const MOCK_COMMENTS: Map<string, any[]> = new Map()

/* ── helpers for dynamic mock project ── */
function _normalizeStatus(s: string | null | undefined): string {
  if (!s) return 'To Do'
  const l = s.toLowerCase()
  if (['done','closed','resolved'].includes(l)) return 'Done'
  if (l === 'blocked') return 'Blocked'
  if (l.includes('review') || l.includes('qa')) return 'In Review'
  if (l.includes('progress') || l.includes('development')) return 'In Progress'
  return 'To Do'
}
function _normalizePriority(p: string | null | undefined): string {
  if (!p) return 'Medium'
  const l = (p || '').toLowerCase()
  if (['critical','blocker'].includes(l)) return 'Critical'
  if (l === 'high') return 'High'
  if (['low','minor','trivial'].includes(l)) return 'Low'
  return 'Medium'
}
function _normalizeType(t: string | null | undefined): string {
  if (!t) return 'Task'
  const l = t.toLowerCase()
  if (l.includes('bug') || l.includes('defect')) return 'Bug'
  if (l.includes('story') || l.includes('feature')) return 'Story'
  if (l.includes('epic')) return 'Epic'
  if (l.includes('subtask') || l.includes('sub-task')) return 'Subtask'
  return 'Task'
}
function _initials(name: string | null | undefined): string {
  if (!name) return ''
  const parts = name.trim().split(' ')
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}
function _hashColor(name: string | null | undefined): string {
  const MEMBER_COLORS = [
    'linear-gradient(135deg,#f59e0b,#fbbf24)',
    'linear-gradient(135deg,#34D399,#10B981)',
    'linear-gradient(135deg,#FBBF24,#F59E0B)',
    'linear-gradient(135deg,#F87171,#FCA5A5)',
    'linear-gradient(135deg,#A78BFA,#C4B5FD)',
    'linear-gradient(135deg,#22D3EE,#67E8F9)',
    'linear-gradient(135deg,#64748B,#94A3B8)',
    'linear-gradient(135deg,#FB923C,#FDBA74)',
  ]
  let h = 0
  const n = name || ''
  for (const c of n) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return MEMBER_COLORS[Math.abs(h) % MEMBER_COLORS.length]
}

/* ── Mock Goals ── */
const DUMMY_GOALS: Goal[] = [
  {
    id: "g1",
    quarter: "Q2 2025",
    title: "Reduce API latency by 40%",
    description: "Make Trackly feel instant. All API endpoints should respond under 200ms at p99.",
    owner: "Priya S.",
    status: "at_risk",
    overall_progress: 52,
    nova_insight: "At current velocity, you will miss this goal by ~2 weeks. TRK-142 (auth token refresh) is on the critical path — resolving it unlocks 3 downstream tickets worth ~8 points.",
    linked_sprints: ["Sprint 8", "Sprint 9"],
    key_results: [
      { id: "kr1", title: "p99 latency < 200ms on /api/tickets", current: 280, target: 200, unit: "ms", linked_tickets: ["TRK-134", "TRK-141"], status: "at_risk" },
      { id: "kr2", title: "Database query time < 50ms avg", current: 48, target: 50, unit: "ms", linked_tickets: ["TRK-129"], status: "on_track" },
      { id: "kr3", title: "Nova query response < 3s p95", current: 2.1, target: 3, unit: "s", linked_tickets: ["TRK-156"], status: "on_track" },
    ],
  },
  {
    id: "g2",
    quarter: "Q2 2025",
    title: "Nova answers 80% of process questions accurately",
    description: "Nova should be the team's first stop for 'how do we do X' questions, not Slack.",
    owner: "Anand V.",
    status: "behind",
    overall_progress: 31,
    nova_insight: "Missing structured data is the blocker. Only 5 ADRs and 0 runbooks are currently indexed. Adding Decisions + Processes to the knowledge base would immediately improve accuracy.",
    linked_sprints: ["Sprint 9"],
    key_results: [
      { id: "kr4", title: "30+ ADRs in Decisions log", current: 5, target: 30, unit: "records", linked_tickets: ["TRK-161"], status: "behind" },
      { id: "kr5", title: "10+ runbooks in Processes", current: 2, target: 10, unit: "runbooks", linked_tickets: ["TRK-163"], status: "behind" },
      { id: "kr6", title: "Nova accuracy score ≥ 80% (internal eval)", current: 61, target: 80, unit: "%", linked_tickets: [], status: "behind" },
    ],
  },
  {
    id: "g3",
    quarter: "Q2 2025",
    title: "Ship duplicate detection + smart routing to 100% of users",
    description: "The two biggest AI features that make Trackly feel magical in demos. Must be in production.",
    owner: "Rahul M.",
    status: "on_track",
    overall_progress: 78,
    nova_insight: "On track. Backend duplicate detection is complete. Frontend UI for routing is the last piece (TRK-156). At current velocity, this ships in Sprint 9.",
    linked_sprints: ["Sprint 8", "Sprint 9"],
    key_results: [
      { id: "kr7", title: "Duplicate detection live banner in create drawer", current: 1, target: 1, unit: "shipped", linked_tickets: ["TRK-152"], status: "on_track" },
      { id: "kr8", title: "Smart routing UI with explanation", current: 0, target: 1, unit: "shipped", linked_tickets: ["TRK-156"], status: "at_risk" },
      { id: "kr9", title: "95% uptime for AI features", current: 99.1, target: 95, unit: "%", linked_tickets: [], status: "complete" },
    ],
  },
];

function _buildMockProject(pod: string): Project {
  const base: Partial<Project> = {
    id: pod.toLowerCase(),
    key: pod,
    name: pod,
    description: `${pod} project`,
    status: 'active',
    category: 'Engineering',
    color: '#f59e0b',
    lead: 'Team Lead',
    leadInitials: 'TL',
    leadColor: 'linear-gradient(135deg,#f59e0b,#fbbf24)',
    members: [],
    epics: [],
    startDate: '2025-01-01',
    priority: 'medium',
    tags: [],
    weeklyActivity: [2, 3, 4, 3, 5, 2, 1],
    roles: ['admin', 'engineering_manager', 'tech_lead', 'engineer'],
  }
  const podTickets = (DUMMY_TICKETS.tickets as any[]).filter((t) => t.pod === pod)
  const podSprints = (DUMMY_SPRINTS as any[]).filter((s) => s.pod === pod)

  const sprints = podSprints.map((sp) => {
    const spTickets = podTickets
      .filter((t) => t.sprint_id === sp.id)
      .map((t) => ({
        id: t.key || t.id,
        key: t.key || t.jira_key,
        title: t.summary,
        status: _normalizeStatus(t.status),
        priority: _normalizePriority(t.priority),
        type: _normalizeType(t.issue_type),
        assignee: t.assignee || '',
        assigneeInitials: _initials(t.assignee),
        assigneeColor: _hashColor(t.assignee || t.key),
        storyPoints: t.story_points || 0,
        dueDate: t.updated,
        createdAt: t.created,
        updatedAt: t.updated,
        description: t.description || `${t.summary} — detailed description.`,
        labels: t.labels || [],
        sprint: sp.id,
      }))
    return { ...sp, tasks: spTickets }
  })

  const backlogTasks = podTickets
    .filter((t) => !t.sprint_id)
    .map((t) => ({
      id: t.key || t.id,
      key: t.key || t.jira_key,
      title: t.summary,
      status: _normalizeStatus(t.status),
      priority: _normalizePriority(t.priority),
      type: _normalizeType(t.issue_type),
      assignee: t.assignee || '',
      assigneeInitials: _initials(t.assignee),
      assigneeColor: _hashColor(t.assignee || t.key),
      storyPoints: t.story_points || 0,
      dueDate: t.updated,
      createdAt: t.created,
      updatedAt: t.updated,
      description: t.description || `${t.summary} — detailed description.`,
      labels: t.labels || [],
    }))

  const completed = podTickets.filter((t) => ['Done','Closed'].includes(t.status)).length
  const total = podTickets.length

  return {
    ...base,
    sprints,
    backlogTasks,
    totalTickets: total,
    completedTickets: completed,
    inProgressTickets: podTickets.filter((t) => t.status === 'In Progress').length,
    blockedTickets: podTickets.filter((t) => t.status === 'Blocked').length,
    progress: total ? Math.round((completed / total) * 100) : 0,
  } as any
}

export function enableMocks() {
  ;(window as any).__EAP_MOCK__ = {
    fetchSummary: async (_f: Partial<FilterState>) => { await delay(); return DUMMY_SUMMARY },
    fetchTickets: async (_f: Partial<FilterState>) => { await delay(); return DUMMY_TICKETS },
    fetchFilters: async ()                         => { await delay(200); return DUMMY_FILTERS },
    fetchSprints: async ()                         => { await delay(300); return DUMMY_SPRINTS },
    fetchSprint: async (id: string)                => { await delay(250); return DUMMY_SPRINTS.find((s) => s.id === id) ?? DUMMY_SPRINTS[0] },
    fetchProject: async (pod: string)              => { await delay(350); return _buildMockProject(pod) },

    fetchPodSummary: async () => {
      await delay(350)
      return (DUMMY_SUMMARY.by_pod as any[]).map((p) => {
        const total = p.tickets
        const done = Math.round(total * 0.55)
        const active = Math.round(total * 0.25)
        const blocked = Math.max(1, Math.round(total * 0.08))
        const todo = Math.max(0, total - done - active - blocked)
        return {
          pod: p.pod,
          statuses: {
            Done: done,
            'In Progress': active,
            Blocked: blocked,
            'To Do': todo,
          },
          total_hours: p.hours,
        }
      })
    },

    fetchTicket: async (key: string) => {
      await delay(300)
      const t = DUMMY_TICKETS.tickets.find((x: any) => x.key === key || x.jira_key === key)
      if (!t) throw new Error('Ticket not found')
      return t
    },

    createTicket: async (payload: TicketCreate) => {
      await delay(400)
      const id = nextTicketId++
      const key = `DPAI-${id}`
      const now = new Date().toISOString().split('T')[0]
      const ticket: any = {
        key,
        project_key: payload.pod || 'DPAI',
        project_name: payload.pod || 'DPAI',
        summary: payload.title,
        description: payload.description ?? '',
        reporter: payload.reporter ?? 'Unknown',
        assignee: payload.assignee ?? '',
        assignee_email: payload.assignee ? `${payload.assignee.toLowerCase().replace(/\s+/g, '.')}@3sc.com` : '',
        status: (payload as any).status ?? 'To Do',
        client: payload.client ?? 'Internal',
        pod: payload.pod ?? 'DPAI',
        hours_spent: 0,
        original_estimate_hours: 0,
        remaining_estimate_hours: 0,
        created: now,
        updated: now,
        issue_type: payload.issue_type,
        priority: payload.priority,
        story_points: payload.story_points ?? null,
        labels: payload.labels ?? [],
        due_date: payload.due_date ?? null,
        sprint_id: (payload as any).sprint_id ?? null,
        url: '#',
        worklogs: [],
      }
      DUMMY_TICKETS.tickets.unshift(ticket)
      DUMMY_TICKETS.count += 1
      return ticket
    },

    updateTicketStatus: async (key: string, status: string) => {
      await delay(300)
      const t = DUMMY_TICKETS.tickets.find((x) => x.key === key)
      if (t) {
        t.status = status
        t.updated = new Date().toISOString().split('T')[0]
      }
      return { key, status }
    },

    updateTicket: async (key: string, payload: Partial<TicketCreate>) => {
      await delay(300)
      const t = DUMMY_TICKETS.tickets.find((x) => x.key === key)
      if (t) {
        if (payload.title !== undefined) t.summary = payload.title
        if (payload.description !== undefined) (t as any).description = payload.description
        if ((payload as any).reporter !== undefined) (t as any).reporter = (payload as any).reporter
        if (payload.issue_type !== undefined) t.issue_type = payload.issue_type
        if (payload.priority !== undefined) t.priority = payload.priority
        if ((payload as any).status !== undefined) t.status = (payload as any).status
        if (payload.assignee !== undefined) {
          t.assignee = payload.assignee
          t.assignee_email = payload.assignee
            ? `${payload.assignee.toLowerCase().replace(/\s+/g, '.')}@3sc.com`
            : ''
        }
        if (payload.client !== undefined) t.client = payload.client
        if (payload.pod !== undefined) t.pod = payload.pod
        if (payload.story_points !== undefined) (t as any).story_points = payload.story_points
        if (payload.labels !== undefined) (t as any).labels = payload.labels
        if (payload.due_date !== undefined) (t as any).due_date = payload.due_date
        if ((payload as any).sprint_id !== undefined) (t as any).sprint_id = (payload as any).sprint_id
        t.updated = new Date().toISOString().split('T')[0]
      }
      return t
    },

    createSprint: async (payload: any) => {
      await delay(300)
      const id = `sprint-${Date.now()}`
      const sprint: any = {
        id,
        name: payload.name || `Sprint ${DUMMY_SPRINTS.length + 1}`,
        goal: payload.goal || '',
        start_date: payload.start_date || new Date().toISOString().split('T')[0],
        end_date: payload.end_date || new Date().toISOString().split('T')[0],
        status: 'planning' as const,
        total_points: 0,
        done_points: 0,
        ticket_count: 0,
        completion_pct: 0,
        velocity: null,
        pod: payload.project_id,
      }
      DUMMY_SPRINTS.push(sprint)
      return sprint
    },

    startSprint: async (id: string) => {
      await delay(300)
      const s = DUMMY_SPRINTS.find((x) => x.id === id)
      if (s) s.status = 'active'
      return s
    },

    completeSprint: async (id: string) => {
      await delay(300)
      const s = DUMMY_SPRINTS.find((x) => x.id === id)
      if (s) {
        s.status = 'completed'
        DUMMY_TICKETS.tickets.forEach((t: any) => {
          if (t.sprint_id === id && t.status !== 'Done') {
            t.sprint_id = null
            t.status = 'Backlog'
          }
        })
      }
      return s
    },

    addTicketToSprint: async (sprintId: string, ticketKey: string) => {
      await delay(300)
      const t = DUMMY_TICKETS.tickets.find((x: any) => x.key === ticketKey || x.jira_key === ticketKey)
      if (t) (t as any).sprint_id = sprintId
      return { sprintId, ticketKey }
    },

    removeTicketFromSprint: async (sprintId: string, ticketKey: string) => {
      await delay(300)
      const t = DUMMY_TICKETS.tickets.find((x: any) => x.key === ticketKey || x.jira_key === ticketKey)
      if (t && (t as any).sprint_id === sprintId) (t as any).sprint_id = null
      return { sprintId, ticketKey }
    },

    /* ── Comments (mock — real API uses ticket key lookup which fails for mock tickets) ── */
    fetchTicketComments: async (key: string) => {
      await delay(200)
      return MOCK_COMMENTS.get(key) ?? []
    },

    createComment: async (key: string, content: string, parentId?: string) => {
      await delay(250)
      const user = useAuthStore.getState().user
      const id = `cmt-${nextCommentId++}`
      const comment = {
        id,
        ticket_id: key,
        author_id: user?.id ?? 'mock-user',
        author_name: user?.name ?? 'You',
        author: user?.name ?? 'You',
        body: content,
        content,
        parent_id: parentId ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false,
      }
      const existing = MOCK_COMMENTS.get(key) ?? []
      MOCK_COMMENTS.set(key, [...existing, comment])
      return comment
    },

    editComment: async (key: string, commentId: string, content: string) => {
      await delay(200)
      const comments = MOCK_COMMENTS.get(key) ?? []
      const c = comments.find((x) => x.id === commentId)
      if (c) {
        c.body = content
        c.content = content
        c.updated_at = new Date().toISOString()
      }
      return c
    },

    deleteComment: async (key: string, commentId: string) => {
      await delay(200)
      const comments = MOCK_COMMENTS.get(key) ?? []
      MOCK_COMMENTS.set(key, comments.filter((x) => x.id !== commentId))
    },

    /* ── Goals ── */
    fetchGoals: async (quarter?: string) => {
      await delay(350)
      const goals = quarter ? DUMMY_GOALS.filter((g) => g.quarter === quarter) : [...DUMMY_GOALS]
      const quarters = Array.from(new Set(DUMMY_GOALS.map((g) => g.quarter)))
      return { goals, quarters } as GoalsResponse
    },

    createGoal: async (payload: any) => {
      await delay(400)
      const id = `g${Date.now()}`
      const goal: Goal = {
        id,
        quarter: payload.quarter || 'Q2 2025',
        title: payload.title || 'New Goal',
        description: payload.description || '',
        owner: payload.owner || 'Unassigned',
        status: payload.status || 'on_track',
        overall_progress: payload.overall_progress ?? 0,
        key_results: payload.key_results || [],
        linked_sprints: payload.linked_sprints || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      DUMMY_GOALS.push(goal)
      return goal
    },

    updateGoal: async (id: string, payload: any) => {
      await delay(350)
      const g = DUMMY_GOALS.find((x) => x.id === id)
      if (!g) throw new Error('Goal not found')
      if (payload.title !== undefined) g.title = payload.title
      if (payload.description !== undefined) g.description = payload.description
      if (payload.owner !== undefined) g.owner = payload.owner
      if (payload.status !== undefined) g.status = payload.status
      if (payload.overall_progress !== undefined) g.overall_progress = payload.overall_progress
      if (payload.key_results !== undefined) g.key_results = payload.key_results
      if (payload.linked_sprints !== undefined) g.linked_sprints = payload.linked_sprints
      if (payload.quarter !== undefined) g.quarter = payload.quarter
      g.updated_at = new Date().toISOString()
      return g
    },

    deleteGoal: async (id: string) => {
      await delay(300)
      const idx = DUMMY_GOALS.findIndex((x) => x.id === id)
      if (idx !== -1) DUMMY_GOALS.splice(idx, 1)
    },

    fetchGoalNovaInsight: async (_goalId: string) => {
      await delay(800)
      const insights = [
        "Velocity is 12% below the rolling average. Consider reducing scope or adding capacity in the next sprint.",
        "Three tickets on the critical path have not been updated in 4+ days. Risk of missing the milestone is medium-high.",
        "Team focus score is strong. No context-switching red flags. Maintain current allocation.",
        "Key result #2 is blocked by an external dependency. Escalate to stakeholder by EOD to stay on track.",
      ]
      return insights[Math.floor(Math.random() * insights.length)]
    },

    fetchOrgMembers: async () => {
      await delay(300)
      return DUMMY_ORG_MEMBERS
    },

    /* ── My Work (built from DUMMY_TICKETS so it works without real DB tickets) ── */
    fetchMyWork: async () => {
      await delay(600)
      const user = useAuthStore.getState().user
      const allT = DUMMY_TICKETS.tickets as any[]
      const DONE_SET = new Set(['Done', 'Closed', 'Resolved'])
      const myTickets = allT.filter((t) => t.assignee === user?.name || t.assignee === user?.email)
      const myOpen    = myTickets.filter((t) => !DONE_SET.has(t.status))
      // If the user has no open tickets, show the org-wide open tickets so the page is always populated
      const open = myOpen.length > 0
        ? myOpen
        : allT.filter((t) => !DONE_SET.has(t.status)).slice(0, 8)
      const wip = open.filter((t) => t.status === 'In Progress')
      const blocked = open.filter((t) => t.status === 'Blocked')

      const URGENCY_MAP: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
        Highest: 'critical', High: 'high', Medium: 'medium', Low: 'low', Lowest: 'low',
      }

      const priority_queue = open.slice(0, 6).map((t: any, i: number) => ({
        key:     t.key || t.jira_key,
        rank:    i + 1,
        score:   Math.max(10, 100 - i * 14),
        urgency: (t.status === 'Blocked' ? 'critical' : URGENCY_MAP[t.priority] ?? 'medium') as 'critical' | 'high' | 'medium' | 'low',
        reason:  t.status === 'Blocked'      ? 'Ticket is blocked and needs immediate attention'
               : t.status === 'In Progress'  ? 'Currently in progress — keep momentum'
               : `Priority: ${t.priority || 'Medium'}`,
        action:  t.status === 'Blocked'      ? 'Unblock and resume'
               : t.status === 'In Progress'  ? 'Continue work and update status'
               : 'Pick up and start working',
      }))

      const sprint_risk = open.length > 0 ? {
        committed:   myTickets.length || open.length,
        completed:   Math.max(0, myTickets.length - open.length),
        remaining:   open.length,
        probability: blocked.length > 0 ? 0.55 : 0.78,
        days_left:   5,
        wip_count:   wip.length,
        status:      (blocked.length > 0 ? 'at_risk' : 'on_track') as 'at_risk' | 'on_track' | 'off_track',
        coaching:    blocked.length > 0
          ? 'Resolve blocked tickets before pulling in new work'
          : wip.length > 3 ? 'Too much WIP — finish before starting more' : 'Good pace — stay focused',
        sprint_name: 'Current Sprint',
      } : null

      const totalLogged = open.reduce((s: number, t: any) => s + (t.hours_spent || 0), 0)
      const totalEst    = open.reduce((s: number, t: any) => s + (t.original_estimate_hours || 0), 0)

      const brief = open.length > 0
        ? `${open.length} open ticket${open.length !== 1 ? 's' : ''}` +
          (blocked.length > 0 ? `, ${blocked.length} blocked` : '') +
          (wip.length > 0 ? `. Focusing on: ${(wip[0].summary || '').slice(0, 50)}` : '.')
        : 'No open tickets — great time to pick up new work or review blockers.'

      const brief_chips: Array<{ label: string; type: 'critical' | 'warning' | 'info' | 'action' }> = [
        ...(blocked.length > 0  ? [{ label: `${blocked.length} Blocked`,     type: 'critical' as const }] : []),
        ...(wip.length > 0      ? [{ label: `${wip.length} In Progress`,     type: 'info' as const    }] : []),
        ...(open.length > 6     ? [{ label: 'Heavy load',                    type: 'warning' as const }] : []),
        ...(totalLogged > 0     ? [{ label: `${totalLogged.toFixed(1)}h logged`, type: 'info' as const }] : []),
      ]

      return {
        tickets: open,
        priority_queue,
        flow_analysis: {
          context_switches: Math.max(0, wip.length - 1),
          flow_state:       (wip.length > 2 ? 'scattered' : wip.length > 0 ? 'focused' : 'disrupted') as 'focused' | 'disrupted' | 'scattered',
          recommendation:   wip.length > 2
            ? 'Too many parallel tasks — pick one and finish it'
            : wip.length === 1 ? `Stay focused on ${wip[0]?.key || 'your current ticket'}` : 'No active WIP — pick up a ticket',
          focus_on: wip.slice(0, 2).map((t: any) => t.key || t.jira_key),
        },
        blocker_predictions: blocked.map((t: any) => ({
          key:               t.key || t.jira_key,
          reason:            'Ticket is currently blocked — escalate or unblock',
          hours_until_block: 0,
          confidence:        0.95,
        })),
        sprint_risk,
        time_energy: {
          total_logged:    totalLogged,
          total_estimated: totalEst,
          overrun_count:   open.filter((t: any) => (t.hours_spent || 0) > (t.original_estimate_hours || Infinity)).length,
          velocity_by_day: [2, 3, 2, 4, 3, 2, 3],
          peak_window:     '10:00 – 12:00',
          focus_score:     Math.min(95, 60 + (wip.length === 1 ? 20 : 0) + (blocked.length === 0 ? 15 : 0)),
        },
        brief,
        brief_chips,
        recent_activity: open.slice(0, 5).map((t: any) => ({
          key:     t.key || t.jira_key,
          summary: t.summary || '',
          change:  t.status,
          time:    t.updated || new Date().toISOString().split('T')[0],
          type:    'status' as const,
        })),
      }
    },

    /* ── Standups ── */
    fetchTodayStandup: async () => {
      await delay(300)
      const user = useAuthStore.getState().user
      const today = new Date().toISOString().slice(0, 10)
      const mine = DUMMY_STANDUPS.find(
        (s) => s.date === today && (s.engineer === user?.name || s.engineer_email === user?.email)
      )
      return mine ?? DUMMY_STANDUPS.find((s) => s.date === today) ?? DUMMY_STANDUPS[0] ?? null
    },

    fetchTeamStandups: async (date?: string, pod?: string) => {
      await delay(350)
      const targetDate = date || new Date().toISOString().slice(0, 10)
      let results = DUMMY_STANDUPS.filter((s) => s.date === targetDate)
      if (pod) results = results.filter((s) => s.pod === pod)
      return results
    },

    updateStandup: async (id: string, payload: any) => {
      await delay(300)
      const s = DUMMY_STANDUPS.find((x) => x.id === id)
      if (!s) throw new Error('Standup not found')
      if (payload.yesterday !== undefined) s.yesterday = payload.yesterday
      if (payload.today !== undefined) s.today = payload.today
      if (payload.blockers !== undefined) s.blockers = payload.blockers
      s.shared = true
      return s
    },

    createStandup: async (payload: any) => {
      await delay(400)
      const user = useAuthStore.getState().user
      const today = new Date().toISOString().slice(0, 10)
      const standup: import('@/types').Standup = {
        id: String(Date.now()),
        engineer: user?.name || 'Current User',
        engineer_email: user?.email || 'user@3scsolution.com',
        date: today,
        yesterday: payload.yesterday || '',
        today: payload.today || '',
        blockers: payload.blockers || '',
        pod: user?.pod || 'DPAI',
        shared: true,
        created_at: new Date().toISOString(),
      }
      DUMMY_STANDUPS.unshift(standup)
      return standup
    },

    generateStandup: async () => {
      await delay(1200)
      const user = useAuthStore.getState().user
      const today = new Date().toISOString().slice(0, 10)
      const existingIdx = DUMMY_STANDUPS.findIndex(
        (s) => s.date === today && (s.engineer === user?.name || s.engineer_email === user?.email)
      )
      const generated: import('@/types').Standup = {
        id: existingIdx >= 0 ? DUMMY_STANDUPS[existingIdx].id : String(Date.now()),
        engineer: user?.name || 'Current User',
        engineer_email: user?.email || 'user@3scsolution.com',
        date: today,
        yesterday: 'Worked on ticket TRK-142 — resolved the authentication token refresh bug. Reviewed 3 pull requests from team members. Attended the Colgate stakeholder alignment call.',
        today: 'Planning to complete the API documentation updates. Will start work on the caching layer for the BSV client integration. Pair programming with Rahul on the microservices CI/CD setup.',
        blockers: 'Waiting for the DevOps team to bring the staging environment back online after the AKS migration.',
        pod: user?.pod || 'DPAI',
        shared: true,
        created_at: new Date().toISOString(),
      }
      if (existingIdx >= 0) {
        DUMMY_STANDUPS[existingIdx] = generated
      } else {
        DUMMY_STANDUPS.unshift(generated)
      }
      return generated
    },
  }
  console.info('[EAP] Mock API enabled — using dummy data')
}
