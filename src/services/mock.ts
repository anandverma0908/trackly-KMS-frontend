import { DUMMY_SUMMARY, DUMMY_TICKETS, DUMMY_FILTERS, DUMMY_SPRINTS } from '@/utils/dummyData'
import { MOCK_PROJECTS } from '@/features/spaces/spacesData'
import type { FilterState, TicketCreate } from '@/types'
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
  if (!name) return '??'
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
  }
  console.info('[EAP] Mock API enabled — using dummy data')
}
