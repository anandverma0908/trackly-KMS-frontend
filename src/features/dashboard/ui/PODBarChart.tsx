import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { getPodColor } from '@/config/themes'
import type { SummaryByPod } from '@/types'
import Skeleton from '@/components/ui/Skeleton'
import styles from './PODBarChart.module.scss'

interface PODBarChartProps {
  data:      SummaryByPod[]
  isLoading: boolean
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const color = getPodColor(d.pod)
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipHeader}>
        <span className={styles.tooltipDot} style={{ background: color }} />
        <span className={styles.tooltipPod}>{d.pod}</span>
      </div>
      <div className={styles.tooltipStats}>
        <div className={styles.tooltipStat}>
          <span className={styles.tooltipVal} style={{ color }}>{d.hours.toFixed(1)}h</span>
          <span className={styles.tooltipKey}> logged</span>
        </div>
        <div className={styles.tooltipDivider} />
        <div className={styles.tooltipStat}>
          <span className={styles.tooltipVal}>{d.tickets}</span>
          <span className={styles.tooltipKey}> tickets</span>
        </div>
        {d.clients?.length > 0 && (
          <>
            <div className={styles.tooltipDivider} />
            <div className={styles.tooltipStat}>
              <span className={styles.tooltipVal}>{d.clients.length}</span>
              <span className={styles.tooltipKey}> clients</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const PREVIEW_COUNT = 8

export default function PODBarChart({ data, isLoading }: PODBarChartProps) {
  const [showAll, setShowAll] = useState(false)

  if (isLoading) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <div>
            <div className="card-title">Hours by POD</div>
            <div className="card-subtitle">Loading…</div>
          </div>
        </div>
        <div className={styles.skeletonList}>
          {[88, 72, 60, 48, 36, 24].map((w, i) => (
            <div key={i} className={styles.skeletonRow}>
              <Skeleton width={52} height={11} />
              <Skeleton width={`${w}%`} height={7} radius="100px" />
              <Skeleton width={36} height={11} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const sorted  = [...data].sort((a, b) => b.hours - a.hours)
  const visible = showAll ? sorted : sorted.slice(0, PREVIEW_COUNT)
  const maxHrs  = sorted[0]?.hours ?? 1
  const hidden  = sorted.length - PREVIEW_COUNT

  return (
    <div className={styles.card}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className="card-title">Hours by POD</div>
          <div className="card-subtitle">{data.length} PODs · {sorted.reduce((s,d) => s + d.hours, 0).toFixed(0)}h total</div>
        </div>
        {hidden > 0 && (
          <button
            className={styles.viewAll}
            onClick={() => setShowAll(v => !v)}
          >
            {showAll ? '↑ Show less' : `View all ${sorted.length} →`}
          </button>
        )}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={Math.max(180, visible.length * 36)}>
        <BarChart
          data={visible}
          layout="vertical"
          margin={{ top: 0, right: 48, left: 4, bottom: 0 }}
          barCategoryGap="30%"
        >
          <XAxis type="number" hide domain={[0, maxHrs * 1.08]} />
          <YAxis
            type="category"
            dataKey="pod"
            width={58}
            tick={{ fill: 'var(--text-2)', fontSize: 12, fontFamily: 'var(--font-sans)', fontWeight: 600 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="hours" radius={[0, 5, 5, 0]} label={{
            position: 'right',
            formatter: (v: number) => `${v.toFixed(0)}h`,
            fill: 'var(--text-3)',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
          }}>
            {visible.map((entry) => (
              <Cell key={entry.pod} fill={getPodColor(entry.pod)} fillOpacity={0.88} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}