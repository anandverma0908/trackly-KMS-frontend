import { createPortal } from "react-dom";
import styles from "./SideDrawer.module.css";

export type DrawerSize = "sm" | "md" | "lg";

interface StatItem {
  label: string;
  value: string;
  color?: string;
}

interface SideDrawerProps {
  open: boolean;
  onClose: () => void;
  size?: DrawerSize;

  // Header
  title: string;
  subtitle?: string;
  avatar?: React.ReactNode; // anything — initials div, icon, etc.
  badge?: React.ReactNode; // coloured pill next to title

  // Optional stats strip below header
  stats?: StatItem[];

  // Footer
  footer?: React.ReactNode;

  // Body content
  children: React.ReactNode;

  bodyClassName?: string;
}

const SIZE_MAP: Record<DrawerSize, string> = {
  sm: styles.drawerSm,
  md: styles.drawerMd,
  lg: styles.drawerLg,
};

export default function SideDrawer({
  open,
  onClose,
  size = "md",
  title,
  subtitle,
  avatar,
  badge,
  stats,
  footer,
  bodyClassName,
  children,
}: SideDrawerProps) {
  if (!open) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div className={styles.backdrop} onClick={onClose} />

      {/* Panel */}
      <div className={`${styles.drawer} ${SIZE_MAP[size]}`}>
        {/* Header */}
        <div className={styles.header}>
          {avatar && <div className={styles.avatarSlot}>{avatar}</div>}

          <div className={styles.headerLeft}>
            <div className={styles.title}>{title}</div>
            {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
            {badge && <div className={styles.headerMeta}>{badge}</div>}
          </div>

          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Stats strip */}
        {stats && stats.length > 0 && (
          <div className={styles.statsStrip}>
            {stats.map((s) => (
              <div key={s.label} className={styles.stat}>
                <div
                  className={styles.statVal}
                  style={s.color ? { color: s.color } : {}}
                >
                  {s.value}
                </div>
                <div className={styles.statLbl}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Body */}
        <div className={`${styles.body} ${bodyClassName || ""}`}>{children}</div>

        {/* Footer */}
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </>,
    document.body,
  );
}
