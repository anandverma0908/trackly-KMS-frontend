import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { runWhatIfSimulation } from "@/services/api";
import type { WhatIfScenario } from "@/types";
import {
  RiBrainLine, RiSparklingLine, RiArrowRightLine,
  RiSubtractLine, RiUserLine, RiCalendarLine,
  RiSplitCellsHorizontal, RiDeleteBinLine, RiPlayLine,
} from "react-icons/ri";
import styles from "./SprintWhatIf.module.css";

interface Props {
  sprintId: string;
  sprintTickets: any[];
}

export default function SprintWhatIf({ sprintId, sprintTickets }: Props) {
  const [changes, setChanges] = useState<{ type: 'reassign' | 'remove' | 'add' | 'extend' | 'split'; ticket_key?: string; target_user?: string; extra_days?: number; description: string }[]>([]);
  const [scenarios, setScenarios] = useState<WhatIfScenario[] | null>(null);

  const simulateMut = useMutation({
    mutationFn: () => runWhatIfSimulation(sprintId, changes),
    onSuccess: (data) => setScenarios(data),
  });

  function addChange(type: 'reassign' | 'remove' | 'extend' | 'split') {
    const desc = type === 'reassign' ? 'Reassign ticket to another engineer'
      : type === 'remove' ? 'Remove ticket from sprint'
      : type === 'extend' ? 'Extend sprint by 2 days'
      : 'Split ticket into smaller stories';
    setChanges((prev) => [...prev, { type, description: desc }]);
  }

  function updateChange(index: number, updates: Partial<typeof changes[0]>) {
    setChanges((prev) => prev.map((c, i) => i === index ? { ...c, ...updates } : c));
  }

  function removeChange(index: number) {
    setChanges((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className={styles.whatIfPage}>
      <div className={styles.whatIfIntro}>
        <RiBrainLine size={20} className={styles.whatIfIcon} />
        <div>
          <h3 className={styles.whatIfTitle}>What-If Simulator</h3>
          <p className={styles.whatIfSubtitle}>Model changes to your sprint and see AI-predicted outcomes before committing.</p>
        </div>
      </div>

      <div className={styles.whatIfLayout}>
        {/* Changes Panel */}
        <div className={styles.changesPanel}>
          <div className={styles.changesHeader}>
            <span>Proposed Changes</span>
            <div className={styles.changeButtons}>
              <button className={styles.changeBtn} onClick={() => addChange('reassign')}><RiUserLine size={12} /> Reassign</button>
              <button className={styles.changeBtn} onClick={() => addChange('remove')}><RiDeleteBinLine size={12} /> Remove</button>
              <button className={styles.changeBtn} onClick={() => addChange('extend')}><RiCalendarLine size={12} /> Extend</button>
              <button className={styles.changeBtn} onClick={() => addChange('split')}><RiSplitCellsHorizontal size={12} /> Split</button>
            </div>
          </div>

          {changes.length === 0 ? (
            <div className={styles.noChanges}>
              <span>No changes proposed yet.</span>
              <span>Select a change type above to start simulating.</span>
            </div>
          ) : (
            <div className={styles.changesList}>
              {changes.map((c, i) => (
                <div key={i} className={styles.changeRow}>
                  <div className={styles.changeRowHeader}>
                    <span className={styles.changeType}>{c.type}</span>
                    <button className={styles.changeRemove} onClick={() => removeChange(i)}><RiSubtractLine size={14} /></button>
                  </div>
                  {(c.type === 'reassign' || c.type === 'remove' || c.type === 'split') && (
                    <select
                      className={styles.changeSelect}
                      value={c.ticket_key ?? ""}
                      onChange={(e) => updateChange(i, { ticket_key: e.target.value })}
                    >
                      <option value="">Select ticket…</option>
                      {sprintTickets.map((t) => (
                        <option key={t.key} value={t.key}>{t.key} — {t.summary.slice(0, 40)}</option>
                      ))}
                    </select>
                  )}
                  {c.type === 'reassign' && (
                    <input
                      className={styles.changeInput}
                      placeholder="Target engineer…"
                      value={c.target_user ?? ""}
                      onChange={(e) => updateChange(i, { target_user: e.target.value })}
                    />
                  )}
                  {c.type === 'extend' && (
                    <input
                      type="number"
                      className={styles.changeInput}
                      placeholder="Extra days"
                      value={c.extra_days ?? ""}
                      onChange={(e) => updateChange(i, { extra_days: parseInt(e.target.value) || 0 })}
                    />
                  )}
                  <input
                    className={styles.changeInput}
                    placeholder="Description (optional)"
                    value={c.description}
                    onChange={(e) => updateChange(i, { description: e.target.value })}
                  />
                </div>
              ))}
            </div>
          )}

          <button
            className={styles.simulateBtn}
            onClick={() => simulateMut.mutate()}
            disabled={changes.length === 0 || simulateMut.isPending}
          >
            <RiPlayLine size={14} />
            {simulateMut.isPending ? "Simulating…" : "Run Simulation"}
          </button>
        </div>

        {/* Results Panel */}
        <div className={styles.resultsPanel}>
          {!scenarios && !simulateMut.isPending && (
            <div className={styles.resultsEmpty}>
              <RiSparklingLine size={32} className={styles.resultsEmptyIcon} />
              <span>Run a simulation to see AI-predicted outcomes</span>
            </div>
          )}

          {simulateMut.isPending && (
            <div className={styles.resultsLoading}>
              <div className={styles.spinner} />
              <span>AI is modelling scenarios…</span>
            </div>
          )}

          {scenarios && scenarios.length === 0 && (
            <div className={styles.resultsEmpty}>
              <span>No scenarios returned. Try different changes.</span>
            </div>
          )}

          {scenarios && scenarios.map((s) => (
            <div key={s.id} className={styles.scenarioCard}>
              <div className={styles.scenarioHeader}>
                <RiSparklingLine size={14} className={styles.scenarioAiIcon} />
                <span className={styles.scenarioName}>{s.name}</span>
                <span className={`${styles.scenarioBadge} ${s.risk_change > 0 ? styles.scenarioBadgeBad : styles.scenarioBadgeGood}`}>
                  Risk {s.risk_change > 0 ? "+" : ""}{Math.round(s.risk_change)}%
                </span>
              </div>

              <div className={styles.scenarioChanges}>
                {s.changes.map((c, i) => (
                  <div key={i} className={styles.scenarioChangeItem}>
                    <RiArrowRightLine size={11} />
                    <span>{c.description}</span>
                  </div>
                ))}
              </div>

              <div className={styles.scenarioMetrics}>
                <div>
                  <strong>{Math.round(s.predicted_completion_pct)}%</strong>
                  <span>Completion</span>
                </div>
                <div>
                  <strong>{Math.round(s.predicted_velocity)}</strong>
                  <span>Velocity</span>
                </div>
                <div>
                  <strong>{s.days_impact > 0 ? "+" : ""}{s.days_impact}d</strong>
                  <span>Time Impact</span>
                </div>
                <div>
                  <strong>{s.capacity_impact > 0 ? "+" : ""}{Math.round(s.capacity_impact)}h</strong>
                  <span>Capacity</span>
                </div>
              </div>

              <div className={styles.scenarioRec}>
                <RiSparklingLine size={11} />
                <span>{s.recommendation}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
