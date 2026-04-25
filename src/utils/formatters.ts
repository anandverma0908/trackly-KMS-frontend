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

/* ── Initials from name ── */
export function initials(name: string | undefined | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}


