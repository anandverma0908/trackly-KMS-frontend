import type { FilterState } from '@/types'

/* ── Very simple NL → filter parser (runs locally before calling AI API) ── */

const ISSUE_TYPES   = ['bug', 'feature', 'meeting', 'task', 'story']
const MONTHS_MAP: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
  jan: '01', feb: '02', mar: '03', apr: '04',
  jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

export interface ParsedQuery {
  filters: Partial<FilterState>
  remaining: string
}

export function parseNLQuery(
  query: string,
  availableFilters: { pods: string[]; clients: string[]; users: string[]; projects: string[] }
): ParsedQuery {
  const lower   = query.toLowerCase()
  const filters: Partial<FilterState> = {}

  /* ── Issue type ── */
  for (const type of ISSUE_TYPES) {
    if (lower.includes(type)) {
      filters.issueType = type.charAt(0).toUpperCase() + type.slice(1)
      break
    }
  }

  /* ── POD ── */
  for (const pod of availableFilters.pods) {
    if (lower.includes(pod.toLowerCase())) {
      filters.pod = pod
      break
    }
  }

  /* ── Client ── */
  for (const client of availableFilters.clients) {
    if (lower.includes(client.toLowerCase())) {
      filters.client = client
      break
    }
  }

  /* ── User ── */
  for (const user of availableFilters.users) {
    if (lower.includes(user.toLowerCase())) {
      filters.user = user
      break
    }
  }

  /* ── Month ── */
  const year = new Date().getFullYear()
  for (const [month, num] of Object.entries(MONTHS_MAP)) {
    if (lower.includes(month)) {
      const y = lower.includes('last year') ? year - 1 : year
      filters.dateFrom = `${y}-${num}-01`
      // last day of month
      const lastDay = new Date(y, parseInt(num), 0).getDate()
      filters.dateTo = `${y}-${num}-${lastDay}`
      break
    }
  }

  /* ── Relative time ── */
  if (!filters.dateFrom) {
    const now = new Date()
    if (lower.includes('last month')) {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const y = d.getFullYear()
      const last = new Date(y, d.getMonth() + 1, 0).getDate()
      filters.dateFrom = `${y}-${m}-01`
      filters.dateTo   = `${y}-${m}-${last}`
    } else if (lower.includes('this week')) {
      const d   = new Date(now)
      const day = d.getDay()
      const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      filters.dateFrom = mon.toISOString().slice(0, 10)
      filters.dateTo   = sun.toISOString().slice(0, 10)
    }
  }

  return { filters, remaining: query }
}
