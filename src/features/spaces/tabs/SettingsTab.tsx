import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  fetchOrgUsers,
  addSpaceMember,
  removeSpaceMember,
} from "@/services/api";
import type { Project, ProjectMember } from "@/features/spaces/spacesData";
import {
  RiUserAddLine,
  RiDeleteBinLine,
  RiSearchLine,
  RiTeamLine,
  RiAddLine,
  RiShieldUserLine,
  RiSettings4Line,
  RiListSettingsLine,
} from "react-icons/ri";
import AutomationRuleBuilder from "@/features/spaces/components/AutomationRuleBuilder";
import CustomFieldManager from "@/features/spaces/components/CustomFieldManager";
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

const ROLE_COLOR: Record<string, string> = {
  admin: "var(--red)",
  engineering_manager: "var(--accent)",
  tech_lead: "#a78bfa",
  team_member: "var(--green)",
  finance_viewer: "var(--amber)",
};

const AVATAR_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#ef4444",
  "#14b8a6",
];

function getAvatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function Avatar({
  name,
  color,
  size = 28,
}: {
  name: string;
  color?: string;
  size?: number;
}) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const bg = color ?? getAvatarColor(name);
  return (
    <div
      className={styles.avatar}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: bg,
      }}
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
      (u) =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
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
    <div className={styles.tab}>
      {/* ── Members ── */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardMeta}>
            <div>
              <div className={styles.cardTitle}>Members</div>
              <div className={styles.cardDesc}>
                Manage who has access to this space
              </div>
            </div>
          </div>
          <span className={styles.countBadge}>{project.members.length}</span>
        </div>

        <div className={styles.membersGrid}>
          {/* Left panel — current members */}
          <div className={styles.memberPanel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>
                <RiShieldUserLine size={12} />
                Current members
              </span>
              <span className={styles.panelCount}>
                {filteredCurrent.length}
              </span>
            </div>

            <div className={styles.searchWrap}>
              <RiSearchLine
                size={13}
                style={{ opacity: 0.45, flexShrink: 0 }}
              />
              <input
                className={styles.searchInput}
                placeholder="Search members…"
                value={searchCurrent}
                onChange={(e) => setSearchCurrent(e.target.value)}
              />
              {searchCurrent && (
                <button
                  className={styles.searchClear}
                  onClick={() => setSearchCurrent("")}
                >
                  ✕
                </button>
              )}
            </div>

            <div className={styles.memberList}>
              {filteredCurrent.length === 0 ? (
                <div className={styles.empty}>
                  {searchCurrent
                    ? "No members match your search"
                    : "No members yet"}
                </div>
              ) : (
                filteredCurrent.map((m: ProjectMember) => (
                  <div key={m.id} className={styles.memberRow}>
                    <Avatar name={m.name} color={m.color} />
                    <div className={styles.memberInfo}>
                      <div className={styles.memberName}>
                        {m.name}
                        <span
                          className={styles.rolePill}
                          style={{
                            color: ROLE_COLOR[m.role] ?? "var(--text-3)",
                            borderColor:
                              ROLE_COLOR[m.role] ?? "var(--border-2)",
                            background: `color-mix(in srgb, ${ROLE_COLOR[m.role] ?? "var(--text-3)"} 10%, transparent)`,
                          }}
                        >
                          {ROLE_LABEL[m.role] ?? m.role}
                        </span>
                      </div>
                    </div>
                    <button
                      className={styles.removeBtn}
                      onClick={() => removeMut.mutate(m.id)}
                      disabled={removeMut.isPending}
                      title="Remove from space"
                    >
                      <RiDeleteBinLine size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right panel — add from org */}
          <div className={styles.memberPanel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>
                <RiUserAddLine size={12} />
                Add from organisation
              </span>
              <span className={styles.panelCount}>
                {availableToAdd.length} available
              </span>
            </div>

            <div className={styles.searchWrap}>
              <RiSearchLine
                size={13}
                style={{ opacity: 0.45, flexShrink: 0 }}
              />
              <input
                className={styles.searchInput}
                placeholder="Search by name or email…"
                value={searchAdd}
                onChange={(e) => setSearchAdd(e.target.value)}
              />
              {searchAdd && (
                <button
                  className={styles.searchClear}
                  onClick={() => setSearchAdd("")}
                >
                  ✕
                </button>
              )}
            </div>

            <div className={styles.memberList}>
              {filteredAdd.length === 0 ? (
                <div className={styles.empty}>
                  {searchAdd
                    ? "No users match your search"
                    : availableToAdd.length === 0
                      ? "All org members are already in this space"
                      : "No results"}
                </div>
              ) : (
                filteredAdd.map((u) => (
                  <div key={u.id} className={styles.memberRow}>
                    <Avatar name={u.name} />
                    <div className={styles.memberInfo}>
                      <div className={styles.memberName}>
                        {u.name}
                        <span
                          className={styles.rolePill}
                          style={{
                            color: ROLE_COLOR[u.role] ?? "var(--text-3)",
                            borderColor:
                              ROLE_COLOR[u.role] ?? "var(--border-2)",
                            background: `color-mix(in srgb, ${ROLE_COLOR[u.role] ?? "var(--text-3)"} 10%, transparent)`,
                          }}
                        >
                          {ROLE_LABEL[u.role] ?? u.role}
                        </span>
                      </div>
                      <div className={styles.emailText}>{u.email}</div>
                    </div>
                    <button
                      className={styles.addBtn}
                      onClick={() => addMut.mutate(u.id)}
                      disabled={addMut.isPending}
                    >
                      <RiAddLine size={11} />
                      Add
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Automation ── */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardMeta}>
            <div>
              <div className={styles.cardTitle}>Automation</div>
              <div className={styles.cardDesc}>
                Trigger actions automatically when conditions are met
              </div>
            </div>
          </div>
        </div>
        <div className={styles.cardBody}>
          <AutomationRuleBuilder pod={pod} />
        </div>
      </div>

      {/* ── Custom Fields ── */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardMeta}>
            <div>
              <div className={styles.cardTitle}>Custom Fields</div>
              <div className={styles.cardDesc}>
                Add custom data fields to tickets in this space
              </div>
            </div>
          </div>
        </div>
        <div className={styles.cardBody}>
          <CustomFieldManager pod={pod} />
        </div>
      </div>
    </div>
  );
}
