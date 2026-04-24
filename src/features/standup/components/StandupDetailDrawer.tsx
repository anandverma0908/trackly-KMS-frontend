import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { updateStandup } from "@/services/api";
import { initials, formatDate } from "@/utils/formatters";
import { useAuthStore } from "@/features/auth/useAuthStore";
import SideDrawer from "@/components/ui/SideDrawer";
import styles from "../StandupPage.module.css";
import type { Standup } from "@/types";
import {
  RiSparklingLine,
  RiAlertLine,
  RiEditLine,
  RiSaveLine,
  RiCloseLine,
} from "react-icons/ri";

const AVATAR_COLORS = [
  "linear-gradient(135deg,#4F7EFF,#818CF8)",
  "linear-gradient(135deg,#34D399,#10B981)",
  "linear-gradient(135deg,#FBBF24,#F59E0B)",
  "linear-gradient(135deg,#F87171,#FCA5A5)",
  "linear-gradient(135deg,#A78BFA,#C4B5FD)",
  "linear-gradient(135deg,#22D3EE,#67E8F9)",
  "linear-gradient(135deg,#64748B,#94A3B8)",
];

function getAvatarColor(name: string | undefined | null) {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function StandupDetailDrawer({
  standup,
  open,
  onClose,
}: {
  standup: Standup | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ yesterday: "", today: "", blockers: "" });

  const canEdit = standup?.engineer === user?.name || user?.role === "admin" || user?.role === "engineering_manager";

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Standup> }) =>
      updateStandup(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-standup"] });
      qc.invalidateQueries({ queryKey: ["team-standups"] });
      setEditing(false);
      toast.success("Standup updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!standup) return null;
  const s = standup;

  function startEdit() {
    setDraft({
      yesterday: s.yesterday,
      today: s.today,
      blockers: s.blockers ?? "",
    });
    setEditing(true);
  }

  function saveEdit() {
    updateMut.mutate({ id: s.id, payload: draft });
  }

  const hasBlocker = !!(s.blockers?.trim());

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      size="md"
      title={s.engineer}
      subtitle={`${s.pod || "No POD"} · ${formatDate(s.date, "EEEE, MMMM d, yyyy")}`}
      badge={
        hasBlocker ? (
          <span className={styles.drawerBadgeBlocker}>
            <RiAlertLine size={10} /> Blocker
          </span>
        ) : (
          <span className={styles.drawerBadgeOk}>Submitted</span>
        )
      }
      avatar={
        <div className={styles.drawerAvatar} style={{ background: getAvatarColor(s.engineer) }}>
          {initials(s.engineer)}
        </div>
      }
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {canEdit && !editing && (
            <button className={styles.btnSecondary} onClick={startEdit}>
              <RiEditLine size={13} /> Edit
            </button>
          )}
          {editing && (
            <div style={{ display: "flex", gap: 8 }}>
              <button className={styles.btnSecondary} onClick={() => setEditing(false)}>
                <RiCloseLine size={13} /> Cancel
              </button>
              <button className={styles.btnPrimary} onClick={saveEdit} disabled={updateMut.isPending}>
                <RiSaveLine size={13} /> {updateMut.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          )}
          {!canEdit && <span />}
          <button className={styles.btnSecondary} onClick={onClose}>Close</button>
        </div>
      }
    >
      <div className={styles.drawerBody}>
        {editing ? (
          <div className={styles.drawerEditForm}>
            {(["yesterday", "today", "blockers"] as const).map((field) => (
              <div key={field} className={styles.drawerEditField}>
                <label className={styles.drawerEditLabel}>
                  {field === "blockers" ? (
                    <><RiAlertLine size={10} /> Blockers</>
                  ) : (
                    field.charAt(0).toUpperCase() + field.slice(1)
                  )}
                </label>
                <textarea
                  className={`input ${styles.drawerEditTextarea}`}
                  rows={field === "blockers" ? 2 : 4}
                  value={draft[field]}
                  onChange={(e) => setDraft((f) => ({ ...f, [field]: e.target.value }))}
                  placeholder={`What did you ${field === "yesterday" ? "do" : field === "today" ? "do today" : "run into"}?`}
                />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className={styles.drawerSection}>
              <div className={styles.drawerSectionLabel}>Yesterday</div>
              <p className={styles.drawerSectionText}>{s.yesterday || "—"}</p>
            </div>
            <div className={styles.drawerSection}>
              <div className={styles.drawerSectionLabel}>Today</div>
              <p className={styles.drawerSectionText}>{s.today || "—"}</p>
            </div>
            {hasBlocker && (
              <div className={`${styles.drawerSection} ${styles.drawerBlockerSection}`}>
                <div className={styles.drawerSectionLabel}>
                  <RiAlertLine size={10} /> Blockers
                </div>
                <p className={styles.drawerSectionText}>{s.blockers}</p>
              </div>
            )}
            {!hasBlocker && (
              <div className={styles.drawerNoBlocker}>
                <RiSparklingLine size={14} color="var(--green)" />
                <span>No blockers reported</span>
              </div>
            )}
          </>
        )}
      </div>
    </SideDrawer>
  );
}
