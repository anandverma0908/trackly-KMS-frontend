import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { fetchOrgUsers, addSpaceMember, removeSpaceMember } from "@/services/api";
import type { Project, ProjectMember } from "@/features/spaces/spacesData";
import {
  RiUserAddLine,
  RiDeleteBinLine,
  RiSearchLine,
  RiTeamLine,
  RiAddLine,
} from "react-icons/ri";
import styles from "./SettingsTab.module.css";

interface Props {
  project: Project;
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  engineering_manager: "Eng Manager",
  tech_lead: "Tech Lead",
  team_member: "Member",
  finance_viewer: "Finance",
};

function Avatar({ name, color, size = 40 }: { name: string; color?: string; size?: number }) {
  const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div
      className={styles.avatar}
      style={{ width: size, height: size, fontSize: size * 0.35, background: color ?? "var(--accent)" }}
    >
      {initials}
    </div>
  );
}

export default function SettingsTab({ project }: Props) {
  const qc = useQueryClient();
  const pod = project.key;
  const [searchCurrent, setSearchCurrent] = useState("");
  const [searchAdd, setSearchAdd] = useState("");

  const currentMemberIds = useMemo(
    () => new Set(project.members.map((m) => m.id)),
    [project.members],
  );

  const { data: orgUsers = [] } = useQuery({
    queryKey: ["org-members"],
    queryFn: fetchOrgUsers,
  });

  const availableToAdd = useMemo(
    () => orgUsers.filter((u) => !currentMemberIds.has(u.id)),
    [orgUsers, currentMemberIds],
  );

  const filteredCurrent = useMemo(() => {
    const q = searchCurrent.toLowerCase();
    return project.members.filter((m) => m.name.toLowerCase().includes(q));
  }, [project.members, searchCurrent]);

  const filteredAdd = useMemo(() => {
    const q = searchAdd.toLowerCase();
    return availableToAdd.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [availableToAdd, searchAdd]);

  const addMut = useMutation({
    mutationFn: (userId: string) => addSpaceMember(pod, userId, "member"),
    onSuccess: (_, userId) => {
      const u = orgUsers.find((x) => x.id === userId);
      toast.success(`${u?.name ?? "Member"} added to space`);
      qc.invalidateQueries({ queryKey: ["space-project", pod] });
    },
    onError: () => toast.error("Failed to add member"),
  });

  const removeMut = useMutation({
    mutationFn: (userId: string) => removeSpaceMember(pod, userId),
    onSuccess: (_, userId) => {
      const m = project.members.find((x) => x.id === userId);
      toast.success(`${m?.name ?? "Member"} removed`);
      qc.invalidateQueries({ queryKey: ["space-project", pod] });
    },
    onError: () => toast.error("Failed to remove member"),
  });

  return (
    <div className={styles.page}>
      <div className={styles.panels}>

        {/* ── Left: Current Members ── */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>
              <RiTeamLine size={16} />
              Space Members
            </div>
            <span className={styles.badge}>{project.members.length}</span>
          </div>

          <div className={styles.searchBox}>
            <RiSearchLine size={13} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Search members…"
              value={searchCurrent}
              onChange={(e) => setSearchCurrent(e.target.value)}
            />
          </div>

          <div className={styles.memberCards}>
            {filteredCurrent.length === 0 && (
              <div className={styles.empty}>
                {searchCurrent ? "No members match your search" : "No members yet"}
              </div>
            )}
            {filteredCurrent.map((m: ProjectMember) => (
              <div key={m.id} className={styles.memberCard}>
                <Avatar name={m.name} color={m.color} size={42} />
                <div className={styles.memberCardInfo}>
                  <div className={styles.memberCardName}>{m.name}</div>
                  <div className={styles.memberCardRole}>{m.role}</div>
                </div>
                <button
                  className={styles.removeBtn}
                  onClick={() => removeMut.mutate(m.id)}
                  disabled={removeMut.isPending}
                  title="Remove from space"
                >
                  <RiDeleteBinLine size={14} />
                  <span>Remove</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Divider ── */}
        <div className={styles.divider} />

        {/* ── Right: Add Members ── */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>
              <RiUserAddLine size={16} />
              Add from Organisation
            </div>
            <span className={styles.badge}>{availableToAdd.length}</span>
          </div>

          <div className={styles.searchBox}>
            <RiSearchLine size={13} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Search by name or email…"
              value={searchAdd}
              onChange={(e) => setSearchAdd(e.target.value)}
            />
          </div>

          <div className={styles.memberCards}>
            {filteredAdd.length === 0 && (
              <div className={styles.empty}>
                {searchAdd
                  ? "No users match your search"
                  : availableToAdd.length === 0
                  ? "All org members are already in this space"
                  : "No results"}
              </div>
            )}
            {filteredAdd.map((u) => (
              <div key={u.id} className={styles.memberCard}>
                <Avatar name={u.name} size={42} />
                <div className={styles.memberCardInfo}>
                  <div className={styles.memberCardName}>{u.name}</div>
                  <div className={styles.memberCardRole}>
                    {ROLE_LABEL[u.role] ?? u.role} · {u.email}
                  </div>
                </div>
                <button
                  className={styles.addBtn}
                  onClick={() => addMut.mutate(u.id)}
                  disabled={addMut.isPending}
                >
                  <RiAddLine size={14} />
                  <span>Add</span>
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
