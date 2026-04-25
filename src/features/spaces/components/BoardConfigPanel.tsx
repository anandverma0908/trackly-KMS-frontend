import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import SideDrawer from "@/components/ui/SideDrawer";
import { fetchBoardConfig, updateBoardConfig } from "@/services/api";
import type { BoardConfig } from "@/services/api";
import styles from "./BoardConfigPanel.module.css";
import { RiSettings3Line, RiDragMoveLine, RiDeleteBinLine, RiAddLine } from "react-icons/ri";

export default function BoardConfigPanel({ pod, open, onClose }: { pod: string; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: config } = useQuery({
    queryKey: ["board-config", pod],
    queryFn: () => fetchBoardConfig(pod),
  });

  const [columns, setColumns] = useState(config?.columns ?? []);
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

  function addColumn() {
    setColumns((prev) => [...prev, { id: `col-${Date.now()}`, name: "New Column", status_mapping: [] }]);
  }

  function updateColumn(idx: number, field: string, value: any) {
    setColumns((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  }

  function removeColumn(idx: number) {
    setColumns((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSave() {
    saveMut.mutate({ columns, swimlane_by: swimlane as any, wip_limits: wipLimits });
  }

  return (
    <SideDrawer open={open} onClose={onClose} size="sm" title="Board Settings" avatar={<RiSettings3Line size={18} />}>
      <div className={styles.panel}>
        <h4 className={styles.sectionTitle}>Columns</h4>
        <div className={styles.columnsList}>
          {columns.map((col, idx) => (
            <div key={col.id} className={styles.columnRow}>
              <RiDragMoveLine size={14} color="var(--text-3)" />
              <input
                className={styles.colInput}
                value={col.name}
                onChange={(e) => updateColumn(idx, "name", e.target.value)}
              />
              <input
                type="number"
                className={styles.wipInput}
                placeholder="WIP"
                value={wipLimits[col.id] || ""}
                onChange={(e) => setWipLimits((prev) => ({ ...prev, [col.id]: Number(e.target.value) || 0 }))}
              />
              <button className={styles.colDelete} onClick={() => removeColumn(idx)}>
                <RiDeleteBinLine size={12} />
              </button>
            </div>
          ))}
          <button className={styles.addColumnBtn} onClick={addColumn}>
            <RiAddLine size={12} /> Add Column
          </button>
        </div>

        <h4 className={styles.sectionTitle}>Swimlanes</h4>
        <select className={styles.select} value={swimlane} onChange={(e) => setSwimlane(e.target.value)}>
          <option value="none">None</option>
          <option value="assignee">By Assignee</option>
          <option value="epic">By Epic</option>
          <option value="priority">By Priority</option>
        </select>

        <div className={styles.actions}>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saveMut.isPending}>
            Save Config
          </button>
        </div>
      </div>
    </SideDrawer>
  );
}
