import { useQuery } from "@tanstack/react-query";
import { fetchBurnRates } from "@/services/api";
import Skeleton from "@/components/ui/Skeleton";
import styles from "./BurnRateWidget.module.scss";
// import { MdOutlineShowChart } from "react-icons/md";

const STATUS_CONFIG = {
  on_track:   { color: "var(--green)",  label: "On Track"   },
  warning:    { color: "var(--amber)",  label: "Warning"    },
  critical:   { color: "var(--red)",    label: "Critical"   },
  over_budget:{ color: "var(--red)",    label: "Over Budget" },
};

export default function BurnRateWidget() {
  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ["burn-rates"],
    queryFn: fetchBurnRates,
  });

  const sorted = [...budgets].sort((a, b) => b.burn_pct - a.burn_pct).slice(0, 8);
  const alerts = sorted.filter((b) => b.status === "critical" || b.status === "over_budget");

  if (isLoading) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <div className="card-title">Client Burn Rate</div>
        </div>
        <div className={styles.list}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={styles.skeletonRow}>
              <Skeleton width="45%" height={10} />
              <Skeleton width="100%" height={7} radius="100px" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className="card-title">Client Burn Rate</div>
        {alerts.length > 0 && (
          <span className={styles.alertBadge}>
            {alerts.length} alert{alerts.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className={styles.empty}>No budget data configured</div>
      ) : (
        <div className={styles.list}>
          {sorted.map((b) => {
            const cfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.on_track;
            const pct = Math.min(100, b.burn_pct);
            return (
              <div key={b.client} className={styles.row}>
                <div className={styles.rowTop}>
                  <span className={styles.client}>{b.client}</span>
                  <span className={styles.pct} style={{ color: cfg.color }}>
                    {pct.toFixed(0)}%
                  </span>
                  <span
                    className={styles.statusChip}
                    style={{ color: cfg.color, borderColor: cfg.color + "40", background: cfg.color + "15" }}
                  >
                    {cfg.label}
                  </span>
                </div>
                <div className={styles.track}>
                  <div
                    className={styles.bar}
                    style={{
                      width: `${pct}%`,
                      background: cfg.color,
                      opacity: pct > 90 ? 1 : 0.7,
                    }}
                  />
                </div>
                <div className={styles.rowSub}>
                  <span>{b.hours_used.toFixed(0)}h used</span>
                  <span>{b.budget_hours}h budget</span>
                </div>
                {b.nova_summary && (b.status === "critical" || b.status === "warning" || b.status === "over_budget") && (
                  <div className={styles.novaSummary}>
                    ✦ {b.nova_summary}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
