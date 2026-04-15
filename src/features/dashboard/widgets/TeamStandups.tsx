import { useQuery } from "@tanstack/react-query";
import { fetchTeamStandups } from "@/services/api";
import { useAuthStore } from "@/features/auth/useAuthStore";
import Skeleton from "@/components/ui/Skeleton";
import styles from "./TeamStandups.module.css";
import { MdGroups } from "react-icons/md";

const TODAY = new Date().toISOString().split("T")[0];

export default function TeamStandups() {
  const scopedPod = useAuthStore((s) => s.getScopedPod());

  const { data: standups = [], isLoading } = useQuery({
    queryKey: ["team-standups", TODAY, scopedPod],
    queryFn: () => fetchTeamStandups(TODAY, scopedPod ?? undefined),
  });

  const submitted = standups.filter((s) => !!s.today);
  const missing   = standups.filter((s) => !s.today);

  if (isLoading) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.icon}><MdGroups /></span>
          <div className="card-title">Team Standups — Today</div>
        </div>
        <div className={styles.grid}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className={styles.skeletonCard}>
              <Skeleton width={32} height={32} radius="50%" />
              <Skeleton width="70%" height={10} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const all = [...submitted, ...missing];

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.icon}><MdGroups /></span>
        <div className="card-title">Team Standups — Today</div>
        <div className={styles.stats}>
          <span className={styles.statGreen}>{submitted.length} submitted</span>
          {missing.length > 0 && (
            <span className={styles.statRed}>{missing.length} missing</span>
          )}
        </div>
      </div>

      {all.length === 0 ? (
        <div className={styles.empty}>No team standup data for today</div>
      ) : (
        <div className={styles.grid}>
          {all.map((s) => {
            const hasDone    = !!s.today;
            const hasBlocker = !!s.blockers && s.blockers.toLowerCase() !== "none";
            const name       = s.engineer || "—";
            const initials   = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

            return (
              <div key={s.id} className={`${styles.standupCard} ${!hasDone ? styles.missing : ""}`}>
                <div className={styles.avatar} style={{ opacity: hasDone ? 1 : 0.4 }}>
                  {initials}
                </div>
                <div className={styles.name}>{name.split(" ")[0]}</div>
                {!hasDone && <div className={styles.missingLabel}>Not submitted</div>}
                {hasDone && hasBlocker && (
                  <div className={styles.blockerDot} title={`Blocker: ${s.blockers}`} />
                )}
                {hasDone && !hasBlocker && (
                  <div className={styles.doneDot} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
