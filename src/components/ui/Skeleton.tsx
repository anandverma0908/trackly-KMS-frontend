import styles from './Skeleton.module.css'

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


