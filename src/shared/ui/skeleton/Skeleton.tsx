import styles from './Skeleton.module.scss'

interface SkeletonProps {
  width?:  string | number
  height?: string | number
  radius?: string | number
  className?: string
}

export default function Skeleton({ width = '100%', height = 16, radius = 'var(--r-sm)', className }: SkeletonProps) {
  return (
    <div
      className={`${styles.skeleton} ${className ?? ''}`}
      style={{ width, height, borderRadius: radius }}
    />
  )
}

/* ── KPI skeleton strip ── */
export function KPISkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={styles.kpiSkeleton}>
          <Skeleton width={36} height={36} radius={9} />
          <Skeleton width="60%" height={10} />
          <Skeleton width="80%" height={28} />
          <Skeleton width="50%" height={10} />
        </div>
      ))}
    </div>
  )
}

/* ── Table skeleton ── */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 14px', alignItems: 'center' }}>
          <Skeleton width={70}  height={20} radius={6} />
          <Skeleton width={220} height={14} />
          <Skeleton width={80}  height={14} />
          <Skeleton width={60}  height={22} radius={6} />
          <Skeleton width={60}  height={14} />
          <Skeleton width={55}  height={22} radius={6} />
          <Skeleton width={55}  height={22} radius={6} />
          <Skeleton width={50}  height={14} />
          <Skeleton width={40}  height={14} />
        </div>
      ))}
    </div>
  )
}
