import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchTeamStandups } from "@/services/api";
import { useAuthStore } from "@/features/auth/model/useAuthStore";
import Skeleton from "@/components/ui/Skeleton";
import SideDrawer from "@/components/ui/SideDrawer";
import styles from "./TeamStandups.module.scss";

const TODAY = new Date().toISOString().split("T")[0];

export default function TeamStandups() {
  const scopedPod = useAuthStore((s) => s.getScopedPod());
  const [selectedStandupId, setSelectedStandupId] = useState<string | number | null>(null);

  const { data: standups = [], isLoading } = useQuery({
    queryKey: ["team-standups", TODAY, scopedPod],
    queryFn: () => fetchTeamStandups(TODAY, scopedPod ?? undefined),
  });

  const submitted = standups.filter((s) => !!s.today);
  const missing   = standups.filter((s) => !s.today);
  const all = [...submitted, ...missing];
  const selectedStandup =
    all.find((item) => item.id === selectedStandupId) ?? null;

  if (isLoading) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
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

  return (
    <div className={styles.card}>
      <div className={styles.header}>
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
              <button
                key={s.id}
                type="button"
                className={`${styles.standupCard} ${!hasDone ? styles.missing : ""}`}
                onClick={() => setSelectedStandupId(s.id)}
              >
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
              </button>
            );
          })}
        </div>
      )}

      <SideDrawer
        open={!!selectedStandup}
        onClose={() => setSelectedStandupId(null)}
        size="md"
        title={selectedStandup?.engineer || "Team Standup"}
        subtitle={selectedStandup ? `${selectedStandup.pod || "No POD"} · ${selectedStandup.date}` : undefined}
        avatar={
          selectedStandup ? (
            <div className={styles.drawerAvatar}>
              {(selectedStandup.engineer || "—")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
          ) : undefined
        }
        badge={
          selectedStandup?.today ? (
            <span className={styles.drawerBadge}>Submitted</span>
          ) : (
            <span className={`${styles.drawerBadge} ${styles.drawerBadgeMuted}`}>Missing</span>
          )
        }
      >
        {selectedStandup && (
          <div className={styles.drawerContent}>
            <div className={styles.detailSection}>
              <div className={styles.detailLabel}>Yesterday</div>
              <div className={styles.detailText}>{selectedStandup.yesterday || "No update shared."}</div>
            </div>

            <div className={styles.detailSection}>
              <div className={styles.detailLabel}>Today</div>
              <div className={styles.detailText}>{selectedStandup.today || "Standup not submitted yet."}</div>
            </div>

            <div className={styles.detailSection}>
              <div className={styles.detailLabel}>Blockers</div>
              <div className={styles.detailText}>{selectedStandup.blockers || "None"}</div>
            </div>
          </div>
        )}
      </SideDrawer>
    </div>
  );
}
