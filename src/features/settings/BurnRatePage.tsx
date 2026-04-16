import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { fetchBurnRates, setClientBudget, fetchBurnRateAlerts } from "@/services/api";
import type { ClientBudget } from "@/types";
import styles from "./BurnRatePage.module.css";

export default function BurnRatePage() {
  const qc = useQueryClient();
  const [editClient, setEditClient] = useState<string | null>(null);
  const [editHours, setEditHours]   = useState("");

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["burn-rates"],
    queryFn: fetchBurnRates,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["burn-rate-alerts"],
    queryFn: fetchBurnRateAlerts,
  });

  const setBudgetMut = useMutation({
    mutationFn: ({ client, hours }: { client: string; hours: number }) =>
      setClientBudget(client, hours),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["burn-rates"] });
      setEditClient(null);
      toast.success("Budget updated!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function statusColor(status: ClientBudget["status"]) {
    const map: Record<string, string> = {
      on_track:    "var(--green)",
      warning:     "var(--amber)",
      critical:    "var(--red)",
      over_budget: "var(--red)",
    };
    return map[status] ?? "var(--text-3)";
  }

  function statusLabel(status: ClientBudget["status"]) {
    const map: Record<string, string> = {
      on_track:    "On Track",
      warning:     "Warning",
      critical:    "Critical",
      over_budget: "Over Budget",
    };
    return map[status] ?? status;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Client Budget & Burn Rate</h1>
          <p className={styles.subtitle}>Monitor monthly hour budgets per client</p>
        </div>
        <div className={styles.novaBadge}>
          <span className={styles.novaGlow} />
          EOS Burn Monitoring
        </div>
      </div>

      {/* Client Budget Cards */}
      {isLoading ? (
        <p className={styles.empty}>Loading…</p>
      ) : clients.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📊</span>
          <p>No client budget data. Set budgets below.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {clients.map((c) => (
            <ClientCard
              key={c.client}
              client={c}
              isEditing={editClient === c.client}
              editHours={editHours}
              onEdit={() => { setEditClient(c.client); setEditHours(String(c.budget_hours)); }}
              onSave={() => setBudgetMut.mutate({ client: c.client, hours: Number(editHours) })}
              onCancel={() => setEditClient(null)}
              onHoursChange={setEditHours}
              statusColor={statusColor(c.status)}
              statusLabel={statusLabel(c.status)}
            />
          ))}
        </div>
      )}

      {/* Alert History */}
      {alerts.length > 0 && (
        <div className={styles.alertSection}>
          <div className={styles.alertTitle}>Alert History</div>
          {alerts.map((a) => (
            <div key={a.id} className={styles.alertItem}>
              <div className={styles.alertLeft}>
                <span className={styles.alertClient}>{a.client}</span>
                <span className={styles.alertThreshold}>{a.threshold_pct}% threshold triggered</span>
                <span className={styles.alertTime}>
                  {a.notified_at ? new Date(a.notified_at).toLocaleString() : "—"}
                </span>
              </div>
              {a.nova_summary && (
                <div className={styles.alertNova}>
                  <span className={styles.alertNovaBadge}>✦</span>
                  {a.nova_summary}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClientCard({
  client, isEditing, editHours,
  onEdit, onSave, onCancel, onHoursChange,
  statusColor, statusLabel,
}: {
  client:       ClientBudget;
  isEditing:    boolean;
  editHours:    string;
  onEdit:       () => void;
  onSave:       () => void;
  onCancel:     () => void;
  onHoursChange:(v: string) => void;
  statusColor:  string;
  statusLabel:  string;
}) {
  const pct = Math.min(client.burn_pct, 110);

  return (
    <div className={styles.clientCard}>
      <div className={styles.clientHeader}>
        <span className={styles.clientName}>{client.client}</span>
        <span className={styles.statusBadge} style={{ background: `${statusColor}22`, color: statusColor }}>
          {statusLabel}
        </span>
      </div>

      {/* Progress bar */}
      <div className={styles.progress}>
        <div
          className={styles.progressFill}
          style={{ width: `${Math.min(pct, 100)}%`, background: statusColor }}
        />
        {pct > 100 && (
          <div className={styles.progressOver} style={{ width: `${pct - 100}%` }} />
        )}
      </div>

      <div className={styles.clientStats}>
        <div className={styles.stat}>
          <span className={styles.statVal}>{client.hours_used.toFixed(1)}h</span>
          <span className={styles.statLabel}>Used</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statVal}>{client.budget_hours.toFixed(0)}h</span>
          <span className={styles.statLabel}>Budget</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statVal} style={{ color: statusColor }}>
            {client.burn_pct.toFixed(0)}%
          </span>
          <span className={styles.statLabel}>Burned</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statVal}>
            {Math.max(0, client.budget_hours - client.hours_used).toFixed(0)}h
          </span>
          <span className={styles.statLabel}>Left</span>
        </div>
      </div>

      {/* NOVA Summary */}
      {client.nova_summary && (
        <div className={styles.novaSummary}>
          <span className={styles.novaSummaryBadge}>✦</span>
          {client.nova_summary}
        </div>
      )}

      {/* Budget Edit */}
      {isEditing ? (
        <div className={styles.editBudget}>
          <input
            type="number"
            className="input input-sm"
            value={editHours}
            onChange={(e) => onHoursChange(e.target.value)}
            placeholder="Monthly hours"
            min="0"
          />
          <button className="btn btn-primary btn-sm" onClick={onSave}>Save</button>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
        </div>
      ) : (
        <button className={styles.editBtn} onClick={onEdit}>Set Budget</button>
      )}
    </div>
  );
}
