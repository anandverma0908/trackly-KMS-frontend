import { format, parseISO } from 'date-fns'

/* ── Hours ── */
export function formatHours(hours: number): string {
  if (hours === 0) return '—'
  return `${hours.toFixed(1)}h`
}

/* ── Date ── */
export function formatDate(dateStr: string, fmt = 'MMM d'): string {
  if (!dateStr) return '—'
  try { return format(parseISO(dateStr), fmt) }
  catch { return dateStr }
}

/* ── Numbers with commas ── */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n)
}

/* ── Percent ── */
export function formatPercent(value: number, total: number): string {
  if (!total) return '0%'
  return `${Math.round((value / total) * 100)}%`
}

/* ── Truncate text ── */
export function truncate(str: string, max = 40): string {
  return str.length > max ? str.slice(0, max) + '…' : str
}

/* ── Initials from name ── */
export function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

/* ── Month label from date ── */
export function toMonthLabel(dateStr: string): string {
  try { return format(parseISO(dateStr), 'MMM yy').toUpperCase() }
  catch { return '' }
}
