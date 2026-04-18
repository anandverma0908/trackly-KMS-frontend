import { getIssueTypeBadge, getStatusBadge } from '@/config/themes'

interface BadgeProps {
  children: React.ReactNode
  variant?: string
  className?: string
}

export function Badge({ children, variant = 'badge-gray', className }: BadgeProps) {
  return <span className={`badge ${variant} ${className ?? ''}`}>{children}</span>
}

export function IssueTypeBadge({ type }: { type: string }) {
  return <Badge variant={getIssueTypeBadge(type)}>{type}</Badge>
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={getStatusBadge(status)}>{status}</Badge>
}

export function PODBadge({ pod }: { pod: string }) {
  const map: Record<string, string> = {
    DPAI:    'badge-blue',
    DevOps:  'badge-green',
    EDM:     'badge-amber',
    SNP:     'badge-purple',
    Infosec: 'badge-red',
    RiskAI:  'badge-cyan',
    DS:      'badge-gray',
    TMS:     'badge-gray',
  }
  return <Badge variant={map[pod] ?? 'badge-gray'}>{pod}</Badge>
}
