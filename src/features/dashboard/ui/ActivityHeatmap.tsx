import { useRef, useEffect } from 'react'
import * as d3 from 'd3'
import styles from './ActivityHeatmap.module.scss'

interface HeatmapDay {
  date:  string
  hours: number
}

interface ActivityHeatmapProps {
  data?: HeatmapDay[]
  month?: string
}

// Generate dummy data for current month if none provided
function generateDummyData(): HeatmapDay[] {
  const days = []
  const now  = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const total = new Date(year, month + 1, 0).getDate()

  for (let d = 1; d <= total; d++) {
    const isWeekend = [0, 6].includes(new Date(year, month, d).getDay())
    days.push({
      date:  `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      hours: isWeekend ? 0 : Math.floor(Math.random() * 500),
    })
  }
  return days
}

export default function ActivityHeatmap({ data, month = 'March 2026' }: ActivityHeatmapProps) {
  const svgRef  = useRef<SVGSVGElement>(null)
  const days    = data ?? generateDummyData()
  const maxHours = d3.max(days, d => d.hours) ?? 1

  const colorScale = d3.scaleSequential()
    .domain([0, maxHours])
    .interpolator(d3.interpolate('#1E3A6E', '#4F7EFF'))

  useEffect(() => {
    if (!svgRef.current) return
    const svg    = d3.select(svgRef.current)
    const size   = 14
    const gap    = 3
    const cols   = days.length

    svg.selectAll('*').remove()

    svg.attr('width',  cols * (size + gap))
       .attr('height', size)

    svg.selectAll('rect')
      .data(days)
      .join('rect')
      .attr('x',       (_, i) => i * (size + gap))
      .attr('y',       0)
      .attr('width',   size)
      .attr('height',  size)
      .attr('rx',      3)
      .attr('fill',    d => d.hours === 0 ? 'var(--surface-2)' : colorScale(d.hours))
      .style('cursor', 'pointer')
      .on('mouseover', function(_event, _d) {
        d3.select(this).attr('opacity', 0.8).attr('transform', 'scale(1.3)')
        // tooltip handled via title
      })
      .on('mouseout', function() {
        d3.select(this).attr('opacity', 1).attr('transform', 'scale(1)')
      })
      .append('title')
      .text(d => `${d.date}: ${d.hours}h logged`)

  }, [days, colorScale])

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <div className="card-title">Team Activity Heatmap</div>
          <div className="card-subtitle">Daily hours logged — {month}</div>
        </div>
        <div className={styles.legend}>
          <span>Less</span>
          {['var(--surface-2)', '#1E3A6E', '#2356B0', '#3472E3', '#4F7EFF'].map((c, i) => (
            <div key={i} className={styles.legendBox} style={{ background: c }} />
          ))}
          <span>More</span>
        </div>
      </div>

      {/* Day number labels */}
      <div className={styles.nums}>
        {days.map((d, i) => {
          const day = parseInt(d.date.split('-')[2])
          return (
            <div key={i} className={styles.num}>
              {day % 5 === 1 || day === days.length ? day : ''}
            </div>
          )
        })}
      </div>

      {/* Heatmap grid */}
      <div className={styles.svgWrap}>
        <svg ref={svgRef} />
      </div>
    </div>
  )
}
