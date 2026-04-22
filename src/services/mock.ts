import { DUMMY_SUMMARY, DUMMY_TICKETS, DUMMY_FILTERS, DUMMY_SPRINTS } from '@/utils/dummyData'
import { MOCK_PROJECTS } from '@/features/spaces/spacesData'
import type { FilterState, TicketCreate, Goal, GoalsResponse } from '@/types'
import type { Project } from '@/features/spaces/spacesData'

const delay = (ms = 450) => new Promise(r => setTimeout(r, ms))

let nextTicketId = 8000

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
    'linear-gradient(135deg,#4F7EFF,#818CF8)',
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
  const base = (MOCK_PROJECTS as any[]).find((p) => p.key === pod) || MOCK_PROJECTS[0]
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
        if (payload.title) t.summary = payload.title
        if (payload.issue_type) t.issue_type = payload.issue_type
        if (payload.priority) t.priority = payload.priority
        if (payload.assignee) {
          t.assignee = payload.assignee
          t.assignee_email = `${payload.assignee.toLowerCase().replace(/\s+/g, '.')}@3sc.com`
        }
        if (payload.client) t.client = payload.client
        if (payload.pod) t.pod = payload.pod
        if (payload.story_points !== undefined) (t as any).story_points = payload.story_points
        if (payload.labels !== undefined) (t as any).labels = payload.labels
        if ((payload as any).sprint_id !== undefined) (t as any).sprint_id = (payload as any).sprint_id
        t.updated = new Date().toISOString().split('T')[0]
      }
      return t
    },

    deleteTicket: async (key: string) => {
      await delay(300)
      const idx = DUMMY_TICKETS.tickets.findIndex((x) => x.key === key)
      if (idx !== -1) {
        DUMMY_TICKETS.tickets.splice(idx, 1)
        DUMMY_TICKETS.count -= 1
      }
      return { key }
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

    /* ── Goals ── */
    fetchGoals: async (quarter?: string) => {
      await delay(350)
      const goals = quarter ? DUMMY_GOALS.filter((g) => g.quarter === quarter) : [...DUMMY_GOALS]
      const quarters = Array.from(new Set(DUMMY_GOALS.map((g) => g.quarter)))
      return { goals, quarters } as GoalsResponse
    },

    fetchGoal: async (id: string) => {
      await delay(250)
      const g = DUMMY_GOALS.find((x) => x.id === id)
      if (!g) throw new Error('Goal not found')
      return g
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
  }
  console.info('[EAP] Mock API enabled — using dummy data')
}
