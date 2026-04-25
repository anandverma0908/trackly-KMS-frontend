import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import SideDrawer from "@/components/ui/SideDrawer";
import { fetchReleases, createRelease, updateRelease, deleteRelease } from "@/services/api";
import type { Release } from "@/services/api";
import styles from "./ReleasesTab.module.css";
import { RiAddLine, RiDeleteBinLine, RiCheckboxCircleLine, RiCalendarLine } from "react-icons/ri";

export default function ReleasesTab({ pod }: { pod: string }) {
  const qc = useQueryClient();
  const { data: releases = [] } = useQuery({
    queryKey: ["releases", pod],
    queryFn: () => fetchReleases(pod),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState("");
  const [drawerRelease, setDrawerRelease] = useState<Release | null>(null);

  const createMut = useMutation({
    mutationFn: () => createRelease(pod, { name, description: desc || undefined, release_date: date || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["releases", pod] });
      toast.success("Release created");
      setShowCreate(false);
      setName("");
      setDesc("");
      setDate("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const releaseMut = useMutation({
    mutationFn: (id: string) => updateRelease(pod, id, { status: "released" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["releases", pod] });
      toast.success("Marked as released");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteRelease(pod, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["releases", pod] });
      toast.success("Release deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className={styles.tab}>
      <div className={styles.header}>
        <h3 className={styles.title}>Releases</h3>
        <button className={styles.createBtn} onClick={() => setShowCreate(true)}>
          <RiAddLine size={14} /> Create Release
        </button>
      </div>

      {showCreate && (
        <div className={styles.form}>
          <input className={styles.input} placeholder="Version name (e.g. v1.2.0)" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={styles.input} placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <input className={styles.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <div className={styles.formActions}>
            <button className={styles.saveBtn} onClick={() => createMut.mutate()} disabled={!name.trim() || createMut.isPending}>Create</button>
            <button className={styles.cancelBtn} onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className={styles.grid}>
        {releases.map((r) => (
          <div key={r.id} className={styles.releaseCard} onClick={() => setDrawerRelease(r)}>
            <div className={styles.releaseTop}>
              <span className={styles.releaseName}>{r.name}</span>
              <span className={`${styles.statusBadge} ${r.status === "released" ? styles.statusReleased : styles.statusUnreleased}`}>
                {r.status}
              </span>
            </div>
            {r.description && <p className={styles.releaseDesc}>{r.description}</p>}
            <div className={styles.releaseMeta}>
              <span className={styles.releaseCount}>{r.ticket_count} tickets</span>
              {r.release_date && (
                <span className={styles.releaseDate}>
                  <RiCalendarLine size={10} /> {r.release_date}
                </span>
              )}
            </div>
            {r.status === "unreleased" && (
              <button
                className={styles.releaseBtn}
                onClick={(e) => { e.stopPropagation(); releaseMut.mutate(r.id); }}
              >
                <RiCheckboxCircleLine size={12} /> Mark as Released
              </button>
            )}
          </div>
        ))}
        {releases.length === 0 && <div className={styles.empty}>No releases yet.</div>}
      </div>

      {drawerRelease && (
        <SideDrawer
          open={Boolean(drawerRelease)}
          onClose={() => setDrawerRelease(null)}
          size="md"
          title={drawerRelease.name}
          badge={
            <span className={`${styles.statusBadge} ${drawerRelease.status === "released" ? styles.statusReleased : styles.statusUnreleased}`}>
              {drawerRelease.status}
            </span>
          }
        >
          <div className={styles.drawerBody}>
            {drawerRelease.description && <p className={styles.drawerDesc}>{drawerRelease.description}</p>}
            <div className={styles.drawerMeta}>
              <span>{drawerRelease.ticket_count} tickets tagged</span>
              {drawerRelease.release_date && <span>Released on {drawerRelease.release_date}</span>}
            </div>
            <button className={styles.drawerDangerBtn} onClick={() => { deleteMut.mutate(drawerRelease.id); setDrawerRelease(null); }}>
              <RiDeleteBinLine size={12} /> Delete Release
            </button>
          </div>
        </SideDrawer>
      )}
    </div>
  );
}
