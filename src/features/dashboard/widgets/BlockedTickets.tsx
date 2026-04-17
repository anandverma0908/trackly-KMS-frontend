import { useQuery } from "@tanstack/react-query";
import { fetchTickets } from "@/services/api";
import { useAuthStore } from "@/features/auth/useAuthStore";
import Skeleton from "@/components/ui/Skeleton";
import styles from "./BlockedTickets.module.css";
// import { MdBlock } from "react-icons/md";

export default function BlockedTickets() {
  const scopedPod = useAuthStore((s) => s.getScopedPod());

  const { data, isLoading } = useQuery({
    queryKey: ["blocked-tickets", scopedPod],
    queryFn: () => fetchTickets({
      dateFrom: null,
      dateTo: null,
      pod: scopedPod ?? undefined,
    }),
  });

  const blocked = (data?.tickets ?? []).filter((t) => t.status === "Blocked").slice(0, 8);

  if (isLoading) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <div className="card-title">Blocked Tickets</div>
        </div>
        <div className={styles.list}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.skeletonItem}>
              <Skeleton width="30%" height={9} />
              <Skeleton width="80%" height={12} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className="card-title">Blocked Tickets</div>
        {blocked.length > 0 && (
          <span className={styles.badge}>{blocked.length}</span>
        )}
      </div>

      {blocked.length === 0 ? (
        <div className={styles.empty}>
          <span>No blocked tickets</span>
        </div>
      ) : (
        <div className={styles.list}>
          {blocked.map((t) => (
            <div key={t.key} className={styles.item}>
              <div className={styles.itemTop}>
                <span className={styles.key}>{t.key}</span>
                <span className={styles.pod}>{t.pod}</span>
              </div>
              <div className={styles.summary}>{t.summary}</div>
              <div className={styles.meta}>
                {t.assignee ? <span className={styles.assignee}>👤 {t.assignee}</span> : null}
                <span className={styles.client}>{t.client}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
