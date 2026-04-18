import { useQuery } from "@tanstack/react-query";
import { fetchNovaStatus } from "@/services/api";
import styles from "./SystemHealth.module.scss";
import { MdOutlineMonitorHeart } from "react-icons/md";
import { TbRobot, TbDatabase } from "react-icons/tb";

type HealthStatus = "online" | "offline" | "degraded";

interface HealthItem {
  icon: React.ReactNode;
  label: string;
  status: HealthStatus;
  detail?: string;
}

const STATUS_CONFIG: Record<HealthStatus, { color: string; label: string }> = {
  online:   { color: "var(--green)",   label: "Online"   },
  offline:  { color: "var(--red)",     label: "Offline"  },
  degraded: { color: "var(--amber)",   label: "Degraded" },
};

export default function SystemHealth() {
  const { data: novaStatus } = useQuery({
    queryKey: ["nova-status"],
    queryFn: fetchNovaStatus,
    refetchInterval: 60_000, // refresh every minute
  });

  const novaOnline = novaStatus?.status === "online" || novaStatus?.healthy === true;

  const items: HealthItem[] = [
    {
      icon: <TbRobot />,
      label: "EOS AI",
      status: novaOnline ? "online" : "offline",
      detail: novaOnline ? "All systems operational" : "Service unavailable",
    },
    {
      icon: <TbDatabase />,
      label: "Database",
      status: "online",
      detail: "Connected",
    },
  ];

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.icon}><MdOutlineMonitorHeart /></span>
        <div className="card-title">System Health</div>
        <span
          className={styles.overallBadge}
          style={{
            color: items.every((i) => i.status === "online") ? "var(--green)" : "var(--amber)",
          }}
        >
          {items.every((i) => i.status === "online") ? "All Systems Operational" : "Issues Detected"}
        </span>
      </div>

      <div className={styles.items}>
        {items.map((item) => {
          const cfg = STATUS_CONFIG[item.status];
          return (
            <div key={item.label} className={styles.item}>
              <span className={styles.itemIcon}>{item.icon}</span>
              <div className={styles.itemInfo}>
                <span className={styles.itemLabel}>{item.label}</span>
                {item.detail && <span className={styles.itemDetail}>{item.detail}</span>}
              </div>
              <div className={styles.statusGroup}>
                <div className={styles.statusDot} style={{ background: cfg.color, boxShadow: `0 0 8px ${cfg.color}` }} />
                <span className={styles.statusLabel} style={{ color: cfg.color }}>{cfg.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
