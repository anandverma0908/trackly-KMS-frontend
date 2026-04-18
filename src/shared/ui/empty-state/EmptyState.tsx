interface EmptyStateProps {
  icon?:   string
  title:   string
  desc?:   string
  action?: React.ReactNode
}

export default function EmptyState({ icon = '📭', title, desc, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-title">{title}</div>
      {desc   && <div className="empty-state-desc">{desc}</div>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  )
}
