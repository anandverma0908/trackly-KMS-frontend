import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { fetchWorkload, fetchKnowledgeGaps, detectKnowledgeGaps, createWikiPage, fetchWikiSpaces } from "@/services/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { KnowledgeGap } from "@/types";
import styles from "./AnalyticsPage.module.css";

export default function AnalyticsPage() {
  const qc = useQueryClient();

  const { data: workload = [] } = useQuery({
    queryKey: ["analytics-workload"],
    queryFn: fetchWorkload,
  });

  const { data: gaps = [], isLoading: loadingGaps } = useQuery({
    queryKey: ["knowledge-gaps"],
    queryFn: fetchKnowledgeGaps,
  });

  const { data: spaces = [] } = useQuery({
    queryKey: ["wiki-spaces"],
    queryFn: fetchWikiSpaces,
  });

  const detectMut = useMutation({
    mutationFn: detectKnowledgeGaps,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge-gaps"] });
      toast.success("Knowledge gap detection started!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createStubMut = useMutation({
    mutationFn: ({ gap }: { gap: KnowledgeGap }) => {
      const spaceId = spaces[0]?.id;
      if (!spaceId) throw new Error("No wiki spaces found");
      return createWikiPage({
        space_id: spaceId,
        title:    `[Stub] ${gap.topic}`,
        content:  `# ${gap.topic}\n\n> This page was auto-created from a knowledge gap detection.\n\n## Description\n\n${gap.description}\n\n## TODO\n\n- [ ] Add relevant documentation\n- [ ] Link to related tickets\n`,
      });
    },
    onSuccess: () => {
      toast.success("Wiki stub created!");
      qc.invalidateQueries({ queryKey: ["wiki-pages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sortedWorkload = [...workload].sort((a, b) => b.total_hours - a.total_hours).slice(0, 20);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Analytics</h1>
        <p className={styles.subtitle}>Workload distribution and knowledge insights</p>
      </div>

      {/* Workload Chart */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>Workload Distribution</div>
          <span className={styles.cardSub}>Hours by engineer (top 20)</span>
        </div>
        {sortedWorkload.length === 0 ? (
          <p className={styles.empty}>No workload data available.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sortedWorkload} layout="vertical" margin={{ left: 100, right: 20, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-2)" }} />
              <YAxis
                type="category"
                dataKey="engineer"
                tick={{ fontSize: 11, fill: "var(--text-2)" }}
                width={100}
              />
              <Tooltip
                contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: 8 }}
                formatter={(v: number) => [`${v.toFixed(1)}h`, "Hours"]}
              />
              <Bar dataKey="total_hours" fill="var(--accent)" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Knowledge Gaps */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <div className={styles.cardTitle}>Knowledge Gaps</div>
            <span className={styles.cardSub}>Topics with tickets but no wiki docs</span>
          </div>
          <div className={styles.gapActions}>
            <div className={styles.novaBadge}>
              <span className={styles.novaGlow} />
              EOS-powered
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => detectMut.mutate()}
              disabled={detectMut.isPending}
            >
              {detectMut.isPending ? "Detecting…" : "Run Detection"}
            </button>
          </div>
        </div>

        {loadingGaps ? (
          <p className={styles.empty}>Loading gaps…</p>
        ) : gaps.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>✅</span>
            <p>No knowledge gaps detected. All topics have wiki coverage!</p>
          </div>
        ) : (
          <div className={styles.gapList}>
            {gaps.map((gap) => (
              <div key={gap.id} className={styles.gapItem}>
                <div className={styles.gapInfo}>
                  <div className={styles.gapTopic}>{gap.topic}</div>
                  <div className={styles.gapDesc}>{gap.description}</div>
                  <div className={styles.gapMeta}>
                    <span>{gap.ticket_count} tickets</span>
                    <span>·</span>
                    <span>{gap.wiki_count} wiki pages</span>
                    <span>·</span>
                    <span>{new Date(gap.detected_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <button
                  className={styles.createStubBtn}
                  onClick={() => createStubMut.mutate({ gap })}
                  disabled={createStubMut.isPending}
                >
                  + Create Wiki Stub
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
