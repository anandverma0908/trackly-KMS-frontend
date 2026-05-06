import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Tooltip from "@mui/material/Tooltip";
import SideDrawer from "@/components/ui/SideDrawer";
import { fetchBoardConfig, updateBoardConfig } from "@/services/api";
import type { BoardConfig } from "@/services/api";
import { validateBoardConfig } from "@/utils/validation";
import styles from "./BoardConfigPanel.module.css";
import {
  RiSettings3Line, RiDeleteBinLine, RiAddLine,
  RiCloseLine, RiInformationLine, RiArrowRightLine,
} from "react-icons/ri";

const ALL_STATUSES = [
  "To Do", "Open", "Reopened",
  "In Progress", "In Review",
  "Blocked",
  "Done", "Closed", "Resolved",
];

type Column = BoardConfig["columns"][number];

/* ── Status tag picker ─────────────────────────────────────────── */
function StatusTagInput({
  mapping,
  allUsed,
  onChange,
}: {
  mapping: string[];
  allUsed: Set<string>;
  onChange: (mapping: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const available = ALL_STATUSES.filter((s) => !allUsed.has(s) || mapping.includes(s));

  return (
    <div className={styles.statusTagWrap} ref={ref}>
      <div className={styles.statusTags}>
        {mapping.map((s) => (
          <span key={s} className={styles.statusTag}>
            {s}
            <button className={styles.statusTagRemove} onClick={() => onChange(mapping.filter((x) => x !== s))}>
              <RiCloseLine size={10} />
            </button>
          </span>
        ))}
        <button className={styles.statusTagAdd} onClick={() => setOpen((v) => !v)}>
          <RiAddLine size={11} /> Add
        </button>
      </div>
      {open && available.length > 0 && (
        <div className={styles.statusDropdown}>
          {available.map((s) => (
            <button
              key={s}
              className={styles.statusDropdownItem}
              disabled={mapping.includes(s)}
              onClick={() => { onChange([...mapping, s]); setOpen(false); }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Transition picker ─────────────────────────────────────────── */
function TransitionPicker({
  currentId,
  transitions,
  columns,
  onChange,
}: {
  currentId: string;
  transitions: string[];
  columns: Column[];
  onChange: (t: string[]) => void;
}) {
  const others = columns.filter((c) => c.id !== currentId);

  function toggle(id: string) {
    onChange(
      transitions.includes(id)
        ? transitions.filter((t) => t !== id)
        : [...transitions, id],
    );
  }

  return (
    <div className={styles.transitionWrap}>
      {others.length === 0 ? (
        <span className={styles.transitionEmpty}>Add more columns first</span>
      ) : (
        <div className={styles.transitionPills}>
          {others.map((c) => {
            const active = transitions.includes(c.id);
            return (
              <button
                key={c.id}
                className={`${styles.transitionPill} ${active ? styles.transitionPillActive : ""}`}
                onClick={() => toggle(c.id)}
              >
                {active && <RiArrowRightLine size={10} />}
                {c.name || "Untitled"}
              </button>
            );
          })}
        </div>
      )}
      {transitions.length === 0 && others.length > 0 && (
        <span className={styles.transitionHint}>No restrictions — all moves allowed</span>
      )}
    </div>
  );
}

/* ── Main panel ────────────────────────────────────────────────── */
export default function BoardConfigPanel({
  pod, open, onClose,
}: {
  pod: string; open: boolean; onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: config } = useQuery({
    queryKey: ["board-config", pod],
    queryFn: () => fetchBoardConfig(pod),
  });

  const [columns, setColumns] = useState<Column[]>(config?.columns ?? []);
  const [swimlane, setSwimlane] = useState<string>(config?.swimlane_by ?? "none");
  const [wipLimits, setWipLimits] = useState<Record<string, number>>(config?.wip_limits ?? {});

  useEffect(() => {
    if (config) {
      setColumns(config.columns);
      setSwimlane(config.swimlane_by);
      setWipLimits(config.wip_limits);
    }
  }, [config]);

  const saveMut = useMutation({
    mutationFn: (payload: BoardConfig) => updateBoardConfig(pod, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board-config", pod] });
      toast.success("Board config saved");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allUsed = new Set(columns.flatMap((c) => c.status_mapping));

  function addColumn() {
    const newId = `col-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setColumns((prev) => [...prev, { id: newId, name: "New Column", status_mapping: [], allowed_transitions: [] }]);
    setWipLimits((prev) => ({ ...prev, [newId]: 5 }));
  }

  function updateCol(idx: number, patch: Partial<Column>) {
    setColumns((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  function removeColumn(idx: number) {
    const colId = columns[idx]?.id;
    setColumns((prev) => prev.filter((_, i) => i !== idx));
    if (colId) setWipLimits((prev) => { const n = { ...prev }; delete n[colId]; return n; });
  }

  function handleSave() {
    const trimmed = columns.map((c) => ({ ...c, name: c.name.trim() }));
    const errors = validateBoardConfig(trimmed, wipLimits);
    if (errors.length > 0) { toast.error(errors.map((e) => e.message).join("; ")); return; }
    saveMut.mutate({
      columns: trimmed,
      swimlane_by: swimlane as BoardConfig["swimlane_by"],
      wip_limits: wipLimits,
    });
  }

  return (
    <SideDrawer open={open} onClose={onClose} size="xs" title="Board Settings" avatar={<RiSettings3Line size={18} />}>
      <div className={styles.panel}>

        {/* ── Columns ── */}
        <div className={styles.sectionHeader}>
          <h4 className={styles.sectionTitle}>Columns</h4>
          <span className={styles.sectionHint}>Configure each column's statuses, WIP cap, and allowed transitions</span>
        </div>

        <div className={styles.columnsList}>
          {columns.map((col, idx) => (
            <div key={col.id} className={styles.columnCard}>

              {/* Name + WIP + delete */}
              <div className={styles.columnCardHeader}>
                <input
                  className={styles.colInput}
                  value={col.name}
                  onChange={(e) => updateCol(idx, { name: e.target.value })}
                  placeholder="Column name"
                />
                <div className={styles.wipRow}>
                  <Tooltip title="Max tickets allowed here at once. Helps limit multitasking." arrow placement="top">
                    <span className={styles.wipLabel}>
                      WIP <RiInformationLine size={10} style={{ opacity: 0.5 }} />
                    </span>
                  </Tooltip>
                  <input
                    type="number"
                    className={styles.wipInput}
                    placeholder="—"
                    min={0}
                    max={999}
                    value={wipLimits[col.id] ?? ""}
                    onChange={(e) => {
                      const val = e.target.value === "" ? undefined : Math.max(0, Math.min(999, Number(e.target.value)));
                      setWipLimits((prev) => {
                        const next = { ...prev };
                        if (val === undefined) delete next[col.id];
                        else next[col.id] = val;
                        return next;
                      });
                    }}
                  />
                </div>
                <button className={styles.colDelete} onClick={() => removeColumn(idx)} title="Remove column">
                  <RiDeleteBinLine size={12} />
                </button>
              </div>

              {/* Status mapping */}
              <div className={styles.subSection}>
                <span className={styles.subLabel}>Mapped statuses</span>
                <StatusTagInput
                  mapping={col.status_mapping}
                  allUsed={allUsed}
                  onChange={(m) => updateCol(idx, { status_mapping: m })}
                />
              </div>

              {/* Transitions */}
              <div className={styles.subSection}>
                <span className={styles.subLabel}>
                  Can move to
                  <Tooltip title="Restrict which columns tickets can be dragged to from here. Leave all unchecked to allow any move." arrow placement="top">
                    <span style={{ marginLeft: 4, opacity: 0.45, cursor: "default" }}>
                      <RiInformationLine size={10} />
                    </span>
                  </Tooltip>
                </span>
                <TransitionPicker
                  currentId={col.id}
                  transitions={col.allowed_transitions ?? []}
                  columns={columns}
                  onChange={(t) => updateCol(idx, { allowed_transitions: t })}
                />
              </div>
            </div>
          ))}

          <button className={styles.addColumnBtn} onClick={addColumn}>
            <RiAddLine size={12} /> Add Column
          </button>
        </div>

        {/* ── Swimlanes ── */}
        <div>
          <h4 className={styles.sectionTitle}>Swimlanes</h4>
          <select className={styles.select} value={swimlane} onChange={(e) => setSwimlane(e.target.value)}>
            <option value="none">None</option>
            <option value="assignee">By Assignee</option>
            <option value="epic">By Epic</option>
            <option value="priority">By Priority</option>
          </select>
        </div>

        {/* ── Save ── */}
        <div className={styles.actions}>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saveMut.isPending}>
            {saveMut.isPending ? "Saving…" : "Save Config"}
          </button>
        </div>
      </div>
    </SideDrawer>
  );
}
