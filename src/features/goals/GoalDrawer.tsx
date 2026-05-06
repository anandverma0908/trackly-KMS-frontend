import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RiAddLine,
  RiDeleteBinLine,
  RiSparklingLine,
} from "react-icons/ri";
import toast from "react-hot-toast";
import SideDrawer from "@/components/ui/SideDrawer";
import { useCreateGoal, useUpdateGoal } from "./useGoals";
import type { Goal, KeyResult, GoalStatus } from "@/types";
import styles from "./GoalDrawer.module.css";

const STATUSES: GoalStatus[] = ["on_track", "at_risk", "behind", "complete"];
const STATUS_LABELS: Record<GoalStatus, string> = {
  on_track: "On Track",
  at_risk: "At Risk",
  behind: "Behind",
  complete: "Complete",
};

interface GoalDrawerProps {
  open: boolean;
  onClose: () => void;
  editGoal?: Goal | null;
}

function emptyKR(): KeyResult {
  return {
    id: `kr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    title: "",
    current: 0,
    target: 1,
    unit: "",
    linked_tickets: [],
    status: "on_track",
  };
}

export default function GoalDrawer({ open, onClose, editGoal }: GoalDrawerProps) {
  const isEdit = Boolean(editGoal);
  const createMut = useCreateGoal();
  const updateMut = useUpdateGoal();

  const [quarter, setQuarter] = useState("Q2 2025");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState<GoalStatus>("on_track");
  const [krs, setKrs] = useState<KeyResult[]>([emptyKR()]);
  const [linkedSprints, setLinkedSprints] = useState("");

  // Seed form when editing
  useEffect(() => {
    if (editGoal) {
      setQuarter(editGoal.quarter);
      setTitle(editGoal.title);
      setDescription(editGoal.description);
      setOwner(editGoal.owner);
      setStatus(editGoal.status);
      setKrs(editGoal.key_results.length ? editGoal.key_results : [emptyKR()]);
      setLinkedSprints(editGoal.linked_sprints.join(", "));
    } else {
      setQuarter("Q2 2025");
      setTitle("");
      setDescription("");
      setOwner("");
      setStatus("on_track");
      setKrs([emptyKR()]);
      setLinkedSprints("");
    }
  }, [editGoal, open]);

  function updateKR(index: number, field: keyof KeyResult, value: any) {
    setKrs((prev) =>
      prev.map((kr, i) => (i === index ? { ...kr, [field]: value } : kr))
    );
  }

  function removeKR(index: number) {
    setKrs((prev) => prev.filter((_, i) => i !== index));
  }

  function addKR() {
    setKrs((prev) => [...prev, emptyKR()]);
  }

  async function handleSubmit() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    const payload = {
      quarter,
      title: title.trim(),
      description: description.trim(),
      owner: owner.trim() || "Unassigned",
      status,
      overall_progress: isEdit ? editGoal!.overall_progress : 0,
      key_results: krs.filter((kr) => kr.title.trim()).map((kr) => ({
        ...kr,
        current: Number(kr.current) || 0,
        target: Number(kr.target) || 1,
      })),
      linked_sprints: linkedSprints
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    try {
      if (isEdit && editGoal) {
        await updateMut.mutateAsync({ id: editGoal.id, payload });
      } else {
        await createMut.mutateAsync(payload as any);
      }
      onClose();
    } catch (_e) {
      // Error toast handled by mutation hook
    }
  }

  const footer = (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
      <button className={styles.btnSecondary} onClick={onClose}>
        Cancel
      </button>
      <button
        className={styles.btnPrimary}
        onClick={handleSubmit}
        disabled={createMut.isPending || updateMut.isPending}
      >
        {createMut.isPending || updateMut.isPending
          ? "Saving…"
          : isEdit
            ? "Save Changes"
            : "Create Goal"}
      </button>
    </div>
  );

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      size="sm"
      title={isEdit ? `Edit Goal` : "Create Goal"}
      subtitle={quarter}
      badge={
        <div className={styles.eosBadge}>
          <RiSparklingLine size={10} />
          EOS AI
        </div>
      }
      footer={footer}
    >
      <div className={styles.drawerBody}>
        {/* Basic info */}
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Quarter</label>
          <input
            className={styles.textInput}
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
            placeholder="e.g. Q2 2025"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Title *</label>
          <input
            className={styles.textInput}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What are we trying to achieve?"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Description</label>
          <textarea
            className={`${styles.textInput} ${styles.textArea}`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Why does this matter? How will we measure success?"
            rows={3}
          />
        </div>

        <div className={styles.formRow}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Owner</label>
            <input
              className={styles.textInput}
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="Name"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Status</label>
            <select
              className={styles.textInput}
              value={status}
              onChange={(e) => setStatus(e.target.value as GoalStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Key Results */}
        <div>
          <div className={styles.sectionTitle}>Key Results</div>
          <AnimatePresence>
            {krs.map((kr, idx) => (
              <motion.div
                key={kr.id}
                className={styles.krCard}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className={styles.krHeaderRow}>
                  <input
                    className={styles.textInput}
                    value={kr.title}
                    onChange={(e) => updateKR(idx, "title", e.target.value)}
                    placeholder="Key result title"
                  />
                  {krs.length > 1 && (
                    <button
                      className={styles.iconBtnDanger}
                      onClick={() => removeKR(idx)}
                      title="Remove"
                    >
                      <RiDeleteBinLine size={14} />
                    </button>
                  )}
                </div>
                <div className={styles.formRow3}>
                  <input
                    className={styles.textInput}
                    type="number"
                    value={kr.current}
                    onChange={(e) =>
                      updateKR(idx, "current", e.target.value)
                    }
                    placeholder="Current"
                  />
                  <input
                    className={styles.textInput}
                    type="number"
                    value={kr.target}
                    onChange={(e) =>
                      updateKR(idx, "target", e.target.value)
                    }
                    placeholder="Target"
                  />
                  <input
                    className={styles.textInput}
                    value={kr.unit}
                    onChange={(e) => updateKR(idx, "unit", e.target.value)}
                    placeholder="Unit (e.g. ms, %)"
                  />
                </div>
                <div className={styles.formRow}>
                  <select
                    className={styles.textInput}
                    value={kr.status}
                    onChange={(e) =>
                      updateKR(idx, "status", e.target.value)
                    }
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <input
                    className={styles.textInput}
                    value={kr.linked_tickets.join(", ")}
                    onChange={(e) =>
                      updateKR(
                        idx,
                        "linked_tickets",
                        e.target.value
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean)
                      )
                    }
                    placeholder="Linked tickets (comma-separated)"
                  />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <button className={styles.addKrBtn} onClick={addKR}>
            <RiAddLine size={14} /> Add Key Result
          </button>
        </div>

        {/* Linked sprints */}
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Linked Sprints</label>
          <input
            className={styles.textInput}
            value={linkedSprints}
            onChange={(e) => setLinkedSprints(e.target.value)}
            placeholder="e.g. Sprint 8, Sprint 9"
          />
        </div>
      </div>
    </SideDrawer>
  );
}
