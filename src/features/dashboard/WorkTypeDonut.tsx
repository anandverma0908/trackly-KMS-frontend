import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { SummaryByClient } from '@/types'
import { formatNumber } from '@/utils/formatters'
import Skeleton from '@/components/ui/Skeleton'
import styles from './WorkTypeDonut.module.css'

interface IssueTypeStat {
  issue_type: string
  hours:      number
  tickets:    number
  pct:        number
}

interface WorkTypeDonutProps {
  byClient:     SummaryByClient[]
  byIssueType?: IssueTypeStat[]
  isLoading:    boolean
}

const TYPE_COLORS: Record<string, string> = {
  Bug:         '#F87171',
  Story:       '#4F7EFF',
  Task:        '#34D399',
  Epic:        '#A78BFA',
  'Sub-task':  '#22D3EE',
  Subtask:     '#22D3EE',
  Feature:     '#4F7EFF',
  Meeting:     '#FBBF24',
  Improvement: '#2DD4BF',
}
function getTypeColor(type: string, idx: number) {
  if (TYPE_COLORS[type]) return TYPE_COLORS[type]
  const fallbacks = ['#4F7EFF','#34D399','#FBBF24','#F87171','#A78BFA','#22D3EE','#64748B']
  return fallbacks[idx % fallbacks.length]
}

function DonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div style={{
      background:   'var(--surface-2, #1a1d2e)',
      border:       '1px solid var(--border-2, rgba(255,255,255,0.1))',
      borderRadius: '10px',
      padding:      '10px 14px',
      boxShadow:    '0 8px 24px rgba(0,0,0,0.3)',
      minWidth:     '130px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: d.payload.color, display: 'inline-block', flexShrink: 0,
        }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text, #f0f0f0)' }}>
          {d.name}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: d.payload.color, fontFamily: 'var(--font-mono, monospace)' }}>
            {d.value}%
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-3, #666)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            share
          </span>
        </div>
        <div style={{ width: 1, height: 28, background: 'var(--border-2, rgba(255,255,255,0.08))' }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text, #f0f0f0)', fontFamily: 'var(--font-mono, monospace)' }}>
            {Math.round(d.payload.hours)}h
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-3, #666)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            hours
          </span>
        </div>
      </div>
    </div>
  )
}

export default function WorkTypeDonut({ byClient, byIssueType = [], isLoading }: WorkTypeDonutProps) {
  if (isLoading) {
    return (
      <div className={styles.card}>
        <Skeleton height={180} radius="var(--r-sm)" />
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3,4,5].map(i => <Skeleton key={i} height={28} />)}
        </div>
      </div>
    )
  }

  const top5     = [...byClient].sort((a, b) => b.hours - a.hours).slice(0, 5)
  const maxHours = top5[0]?.hours ?? 1

  const chartData = byIssueType.slice(0, 6).map((t, i) => ({
    name:  t.issue_type,
    value: t.pct,
    hours: t.hours,
    color: getTypeColor(t.issue_type, i),
  }))

  const totalHours = byIssueType.reduce((s, t) => s + t.hours, 0)

  return (
    <div className={styles.card}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className="card-title">Work Type Split</div>
          <div className="card-subtitle">By issue type · {formatNumber(Math.round(totalHours))}h total</div>
        </div>
      </div>

      {/* Donut */}
      <div className={styles.donutWrap}>
        <div className={styles.donutContainer}>
          <ResponsiveContainer width={110} height={110}>
            <PieChart>
              <Pie
                data={chartData.length > 0 ? chartData : [{ name: 'No data', value: 1, color: 'var(--border-2,#2a2d3e)', hours: 0 }]}
                cx="50%"
                cy="50%"
                innerRadius={34}
                outerRadius={52}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {(chartData.length > 0 ? chartData : [{ color: 'var(--border-2,#2a2d3e)' }]).map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<DonutTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* <div className={styles.donutCenter}>
            <div className={styles.donutPct}>{topType ? `${topType.value}%` : '—'}</div>
            <div className={styles.donutLabel}>{topType?.name ?? 'No data'}</div>
          </div> */}
        </div>

        {/* Legend */}
        <div className={styles.legend}>
          {chartData.map((t) => (
            <div key={t.name} className={styles.legendRow}>
              <div className={styles.legendDot} style={{ background: t.color }} />
              <div className={styles.legendName}>{t.name}</div>
              <div className={styles.legendVal}>{t.value}%</div>
            </div>
          ))}
          {chartData.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>No data</div>
          )}
        </div>
      </div>

      <div className={styles.divider} />

      {/* Top Clients */}
      <div className={styles.clientsHeader}>Top Clients</div>
      <div className={styles.clients}>
        {top5.map((c, i) => (
          <div key={c.client} className={styles.clientRow}>
            <div className={styles.clientRank}>{String(i + 1).padStart(2, '0')}</div>
            <div className={styles.clientName}>{c.client}</div>
            <div className={styles.clientBar}>
              <div
                className={styles.clientBarFill}
                style={{ width: `${(c.hours / maxHours) * 100}%` }}
              />
            </div>
            <div className={styles.clientVal}>{formatNumber(Math.round(c.hours))}h</div>
          </div>
        ))}
        {top5.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>No client data</div>
        )}
      </div>
    </div>
  )
}