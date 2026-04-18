import { useQuery } from "@tanstack/react-query";
import { fetchSprint, fetchSprints } from "@/services/api";
import { useAuthStore } from "@/features/auth/model/useAuthStore";
import Skeleton from "@/components/ui/Skeleton";
import styles from "./MySprintItems.module.scss";
// import { FiZap } from "react-icons/fi";
import { MdCheckCircle, MdRadioButtonUnchecked } from "react-icons/md";

const STATUS_DONE  = ["Done", "Closed", "Resolved"];
const STATUS_ORDER = ["In Progress", "In Review", "To Do", "Done"];

export default function MySprintItems() {
  const user = useAuthStore((s) => s.user);

  const { data: sprints, isLoading: sprintsLoading } = useQuery({
    queryKey: ["sprints"],
    queryFn: fetchSprints,
  });

  const activeSprint = sprints?.find((s) => s.status === "active");

  // Fetch active sprint details to get tickets
  const { data: sprintDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["sprint", activeSprint?.id],
    queryFn: () => fetchSprint(activeSprint!.id),
    enabled: !!activeSprint?.id,
  });

  const myTickets = (sprintDetail?.tickets ?? [])
    .filter((t) => t.assignee === user?.name || t.assignee_email === user?.email)
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));

  const done  = myTickets.filter((t) => STATUS_DONE.includes(t.status)).length;
  const total = myTickets.length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  const daysLeft = activeSprint
    ? Math.max(0, Math.ceil((new Date(activeSprint.end_date).getTime() - Date.now()) / 86_400_000))
    : null;

  const isLoading = sprintsLoading || detailLoading;

  if (isLoading) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>

          <div className="card-title">My Sprint Items</div>
        </div>
        <div className={styles.list}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={styles.skeletonItem}>
              <Skeleton width={16} height={16} radius="50%" />
              <Skeleton width="75%" height={12} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!activeSprint) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>

          <div className="card-title">My Sprint Items</div>
        </div>
        <div className={styles.empty}>No active sprint</div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        {/* <span className={styles.icon}><FiZap /></span> */}
        <div className="card-title">My Sprint Items</div>
        <div className={styles.meta}>
          {daysLeft !== null && (
            <span className={`${styles.chip} ${daysLeft <= 2 ? styles.chipRed : ""}`}>
              {daysLeft}d left
            </span>
          )}
          <span className={styles.chip}>{done}/{total} done</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className={styles.progressTrack}>
        <div
          className={styles.progressBar}
          style={{ width: `${pct}%`, background: pct === 100 ? "var(--green)" : "var(--accent)" }}
        />
      </div>

      {myTickets.length === 0 ? (
        <div className={styles.empty}>No tickets assigned to you in this sprint</div>
      ) : (
        <div className={styles.list}>
          {myTickets.map((t) => {
            const isDone = STATUS_DONE.includes(t.status);
            return (
              <div key={t.key} className={`${styles.item} ${isDone ? styles.done : ""}`}>
                <span className={styles.checkIcon} style={{ color: isDone ? "var(--green)" : "var(--text-3)" }}>
                  {isDone ? <MdCheckCircle /> : <MdRadioButtonUnchecked />}
                </span>
                <div className={styles.itemContent}>
                  <span className={styles.itemKey}>{t.key}</span>
                  <span className={styles.itemTitle}>{t.summary}</span>
                </div>
                <span
                  className={styles.statusPill}
                  style={{
                    color: t.status === "In Progress" ? "var(--accent)"
                         : t.status === "In Review"   ? "var(--amber)"
                         : isDone                     ? "var(--green)"
                         : "var(--text-3)",
                  }}
                >
                  {t.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
