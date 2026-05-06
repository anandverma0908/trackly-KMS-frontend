import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  fetchChatChannels,
  createChatChannel,
  deleteChatChannel,
  fetchChatMessages,
  sendChatMessage,
  fetchOrgMembers,
  novaAgent,
  createStandup,
  fetchChannelMembers,
  addChannelMember,
  removeChannelMember,
} from "@/services/api";
import { useAuthStore } from "@/features/auth/useAuthStore";
import { initials } from "@/utils/formatters";
import type { ChatMessage } from "@/types";
import styles from "./ChatPage.module.css";
import {
  RiHashtag,
  RiTeamLine,
  RiSendPlaneLine,
  RiAddLine,
  RiChat3Line,
  RiRobot2Line,
  RiShieldCheckLine,
  RiCalendarCheckLine,
  RiLightbulbLine,
  RiCloseCircleLine,
  RiArrowUpLine,
  RiUserAddLine,
  RiUserLine,
  RiDeleteBinLine,
  RiLockLine,
  RiGlobalLine,
  RiSettings3Line,
  RiCloseLine,
} from "react-icons/ri";

/* ─── helpers ─────────────────────────────────────────────────── */
const AVATAR_COLORS = [
  "linear-gradient(135deg,#f59e0b,#fbbf24)",
  "linear-gradient(135deg,#34D399,#10B981)",
  "linear-gradient(135deg,#FBBF24,#F59E0B)",
  "linear-gradient(135deg,#F87171,#FCA5A5)",
  "linear-gradient(135deg,#A78BFA,#C4B5FD)",
  "linear-gradient(135deg,#22D3EE,#67E8F9)",
  "linear-gradient(135deg,#64748B,#94A3B8)",
];

function getAvatarColor(name: string | undefined | null) {
  if (!name) return AVATAR_COLORS[0];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function formatTime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function isSameGroup(a: ChatMessage, b: ChatMessage) {
  if (a.user_id !== b.user_id) return false;
  return (
    Math.abs(
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    ) <
    5 * 60_000
  );
}

/* ─── slash commands ───────────────────────────────────────────── */
const SLASH_COMMANDS = [
  {
    cmd: "standup",
    icon: <RiCalendarCheckLine size={14} />,
    desc: "Post your daily standup",
  },
  {
    cmd: "eos",
    icon: <RiRobot2Line size={14} />,
    desc: "Ask EOS — /eos <question>",
  },
  {
    cmd: "help",
    icon: <RiLightbulbLine size={14} />,
    desc: "Show available commands",
  },
];

/* ─── render mentions ──────────────────────────────────────────── */
function MentionBody({ text, members }: { text: string; members: string[] }) {
  const parts = useMemo(() => {
    if (!members.length) return [text];
    const escaped = members.map((m) =>
      m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    );
    const regex = new RegExp(`(@(?:${escaped.join("|")})\\b)`, "gi");
    return text.split(regex);
  }, [text, members]);

  return (
    <span className={styles.messageText}>
      {parts.map((part, i) => {
        if (members.some((m) => part.toLowerCase() === `@${m.toLowerCase()}`))
          return (
            <span key={i} className={styles.mention}>
              {part}
            </span>
          );
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

/* ─── create channel drawer ────────────────────────────────────── */
function CreateChannelDrawer({
  orgMembers,
  onClose,
  onCreated,
}: {
  orgMembers: { id: string; name?: string; role?: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState<"general" | "pod">("general");
  const [isPrivate, setIsPrivate] = useState(false);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const createMut = useMutation({
    mutationFn: (p: {
      name: string;
      type: "pod" | "general";
      is_private: boolean;
      member_ids: string[];
      pod?: string | null;
    }) => createChatChannel(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-channels"] });
      toast.success("Channel created");
      onCreated();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createMut.mutate({
      name: name.trim(),
      type,
      is_private: isPrivate,
      member_ids: memberIds,
      pod: type === "pod" ? name.trim() : null,
    });
  }

  const filteredMembers = orgMembers.filter(
    (m) =>
      !memberIds.includes(String(m.id)) &&
      (!search.trim() || m.name?.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <>
      <div className={styles.drawerBackdrop} onClick={onClose} />
      <div className={styles.drawer}>
        {/* Header */}
        <div className={styles.drawerHeader}>
          <h3 className={styles.drawerTitle}>New Channel</h3>
          <button
            className={styles.drawerCloseBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <RiCloseLine size={18} />
          </button>
        </div>

        <form className={styles.drawerBody} onSubmit={handleSubmit}>
          {/* Channel Name */}
          <div className={styles.drawerSection}>
            <label className={styles.drawerLabel}>Channel Name</label>
            <input
              className={styles.drawerInput}
              placeholder="e.g. design-feedback"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Type */}
          <div className={styles.drawerSection}>
            <label className={styles.drawerLabel}>Type</label>
            <select
              className={styles.drawerSelect}
              value={type}
              onChange={(e) => setType(e.target.value as "general" | "pod")}
            >
              <option value="general">General</option>
              <option value="pod">Pod</option>
            </select>
          </div>

          {/* Private toggle */}
          <div className={styles.drawerSection}>
            <label className={styles.drawerPrivateToggle}>
              <span className={styles.drawerPrivateLeft}>
                <RiLockLine size={14} />
                <span>
                  <span className={styles.drawerPrivateLabel}>
                    Private Channel
                  </span>
                  <span className={styles.drawerPrivateHint}>
                    Only invited members can join
                  </span>
                </span>
              </span>
              <div
                className={`${styles.pillToggle} ${isPrivate ? styles.pillToggleOn : ""}`}
                onClick={() => {
                  setIsPrivate((v) => !v);
                  if (isPrivate) setMemberIds([]);
                }}
                role="switch"
                aria-checked={isPrivate}
              >
                <div className={styles.pillThumb} />
              </div>
            </label>
          </div>

          {/* Add Members (only if private) */}
          {isPrivate && (
            <div className={styles.drawerSection}>
              <label className={styles.drawerLabel}>Add Members</label>
              <div className={styles.memberSearchWrap}>
                <RiUserAddLine size={12} className={styles.memberSearchIcon} />
                <input
                  className={styles.memberSearchInput}
                  placeholder="Search members…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {search.trim() && filteredMembers.length > 0 && (
                <div className={styles.memberSearchResults}>
                  {filteredMembers.slice(0, 5).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={styles.memberSearchItem}
                      onClick={() => {
                        setMemberIds((ids) => [...ids, String(m.id)]);
                        setSearch("");
                      }}
                    >
                      <span
                        className={styles.memberAvatar}
                        style={{ background: getAvatarColor(m.name) }}
                      >
                        {initials(m.name)}
                      </span>
                      <span className={styles.memberItemName}>{m.name}</span>
                      <RiUserAddLine
                        size={11}
                        style={{ color: "var(--accent)", flexShrink: 0 }}
                      />
                    </button>
                  ))}
                </div>
              )}
              {search.trim() && filteredMembers.length === 0 && (
                <div className={styles.memberSearchEmpty}>No more members</div>
              )}
              {memberIds.length > 0 && (
                <div
                  className={styles.createChannelSelectedMembers}
                  style={{ marginTop: 8 }}
                >
                  {memberIds.map((id) => {
                    const m = orgMembers.find((x) => String(x.id) === id);
                    return (
                      <span key={id} className={styles.createChannelMemberChip}>
                        {m?.name ?? id}
                        <button
                          type="button"
                          onClick={() =>
                            setMemberIds((ids) => ids.filter((x) => x !== id))
                          }
                        >
                          ✕
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className={styles.drawerFooter}>
            <button
              type="button"
              className={styles.drawerCancelBtn}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.drawerPrimaryBtn}
              disabled={!name.trim() || createMut.isPending}
            >
              {createMut.isPending ? "Creating…" : "Create Channel"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

/* ─── channel settings drawer ──────────────────────────────────── */
function ChannelSettingsDrawer({
  channelId,
  channelName,
  channelType,
  isPrivate,
  currentUserId,
  userRole,
  createdBy,
  orgMembers,
  onClose,
  onDeleted,
}: {
  channelId: string;
  channelName: string;
  channelType: string;
  isPrivate: boolean;
  currentUserId: string;
  userRole: string;
  createdBy?: string | null;
  orgMembers: { id: string; name?: string; role?: string }[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canManage =
    userRole === "admin" ||
    userRole === "engineering_manager" ||
    String(createdBy) === String(currentUserId);

  const { data: channelMembers = [], isLoading } = useQuery({
    queryKey: ["channel-members", channelId],
    queryFn: () => fetchChannelMembers(channelId),
  });

  const addMut = useMutation({
    mutationFn: ({ userId, name }: { userId: string; name: string }) =>
      addChannelMember(channelId, userId).then(() => ({ name })),
    onSuccess: ({ name }) => {
      qc.invalidateQueries({ queryKey: ["channel-members", channelId] });
      qc.invalidateQueries({ queryKey: ["chat-channels"] });
      sendChatMessage(channelId, `${name} was added to the channel.`).then(
        () => qc.invalidateQueries({ queryKey: ["chat-messages", channelId] }),
      );
      toast.success(`${name} added`);
      setSearch("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: ({ userId, name }: { userId: string; name: string }) =>
      removeChannelMember(channelId, userId).then(() => ({ name })),
    onSuccess: ({ name }) => {
      qc.invalidateQueries({ queryKey: ["channel-members", channelId] });
      qc.invalidateQueries({ queryKey: ["chat-channels"] });
      sendChatMessage(
        channelId,
        `${name} was removed from the channel.`,
      ).then(() =>
        qc.invalidateQueries({ queryKey: ["chat-messages", channelId] }),
      );
      toast.success(`${name} removed`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteChatChannel(channelId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-channels"] });
      toast.success("Channel deleted");
      onDeleted();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const memberIds = new Set(
    (channelMembers as { user_id: string }[]).map((m) => String(m.user_id)),
  );

  const isManager = userRole === "admin" || userRole === "engineering_manager";

  const filteredOrgMembers = orgMembers.filter((m) => {
    if (memberIds.has(String(m.id))) return false;
    if (!search.trim()) return true;
    return m.name?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <>
      <div className={styles.drawerBackdrop} onClick={onClose} />
      <div className={styles.drawer}>
        {/* Header */}
        <div className={styles.drawerHeader}>
          <h3 className={styles.drawerTitle}>
            <RiHashtag size={14} style={{ color: "var(--accent)" }} />
            {channelName}
          </h3>
          <button
            className={styles.drawerCloseBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <RiCloseLine size={18} />
          </button>
        </div>

        <div className={styles.drawerBody}>
          {/* Channel Info section */}
          <div className={styles.drawerSection}>
            <div className={styles.drawerSectionTitle}>Channel Info</div>
            <div className={styles.channelInfoRow}>
              <span className={styles.channelInfoLabel}>Name</span>
              <span className={styles.channelInfoValue}>#{channelName}</span>
            </div>
            <div className={styles.channelInfoRow}>
              <span className={styles.channelInfoLabel}>Type</span>
              <span className={styles.channelTypeBadge}>
                {channelType === "pod" ? "Pod" : "General"}
              </span>
            </div>
            <div className={styles.channelInfoRow}>
              <span className={styles.channelInfoLabel}>Visibility</span>
              {isPrivate ? (
                <span className={styles.channelPrivateBadge}>
                  <RiLockLine size={10} /> Private
                </span>
              ) : (
                <span className={styles.channelPublicBadge}>
                  <RiGlobalLine size={10} /> Public
                </span>
              )}
            </div>
          </div>

          <div className={styles.drawerDivider} />

          {/* Members section */}
          <div className={styles.drawerSection}>
            <div className={styles.drawerSectionTitle}>
              {isLoading
                ? "Members"
                : `Members · ${(channelMembers as unknown[]).length}`}
            </div>
            <div className={styles.memberListSection}>
              {(
                channelMembers as {
                  user_id: string;
                  name: string;
                  role?: string;
                  is_creator: boolean;
                }[]
              ).map((m) => {
                const isMe = String(m.user_id) === String(currentUserId);
                const canRemove = isManager || isMe;
                return (
                  <div key={m.user_id} className={styles.memberItem}>
                    <span
                      className={styles.memberAvatar}
                      style={{ background: getAvatarColor(m.name) }}
                    >
                      {initials(m.name)}
                    </span>
                    <div className={styles.memberItemInfo}>
                      <span className={styles.memberItemName}>
                        {m.name}
                        {m.is_creator && (
                          <span className={styles.creatorBadge}>Creator</span>
                        )}
                        {isMe && <span className={styles.youBadge}>You</span>}
                      </span>
                      {m.role && (
                        <span className={styles.memberItemRole}>
                          {m.role.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                    {canRemove && (
                      <button
                        className={styles.memberRemoveBtn}
                        onClick={() =>
                          removeMut.mutate({
                            userId: String(m.user_id),
                            name: m.name,
                          })
                        }
                        disabled={removeMut.isPending}
                        title="Remove"
                      >
                        <RiDeleteBinLine size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Members section (canManage only) */}
          {canManage && (
            <>
              <div className={styles.drawerDivider} />
              <div className={styles.drawerSection}>
                <div className={styles.drawerSectionTitle}>Add Members</div>
                <div className={styles.memberSearchWrap}>
                  <RiUserAddLine
                    size={12}
                    className={styles.memberSearchIcon}
                  />
                  <input
                    className={styles.memberSearchInput}
                    placeholder="Search to add…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                {filteredOrgMembers.length > 0 ? (
                  <div className={styles.memberSearchResults}>
                    {filteredOrgMembers.slice(0, 6).map((m) => (
                      <button
                        key={m.id}
                        className={styles.memberSearchItem}
                        onClick={() =>
                          addMut.mutate({
                            userId: String(m.id),
                            name: m.name ?? m.id,
                          })
                        }
                        disabled={addMut.isPending}
                      >
                        <span
                          className={styles.memberAvatar}
                          style={{ background: getAvatarColor(m.name) }}
                        >
                          {initials(m.name)}
                        </span>
                        <span className={styles.memberItemName}>{m.name}</span>
                        <RiUserAddLine
                          size={11}
                          style={{ color: "var(--accent)", flexShrink: 0 }}
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className={styles.memberSearchEmpty}>
                    All org members are already in this channel
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Sticky footer — delete (canManage only) */}
        {canManage && (
          <div className={styles.drawerDangerZone}>
            <div className={styles.drawerDangerTitle}>Danger Zone</div>
            {!confirmDelete ? (
              <button
                className={styles.drawerDeleteBtn}
                onClick={() => setConfirmDelete(true)}
              >
                <RiDeleteBinLine size={13} /> Delete Channel
              </button>
            ) : (
              <div className={styles.drawerDeleteConfirm}>
                <p className={styles.drawerDeleteConfirmText}>
                  Are you sure? This cannot be undone.
                </p>
                <div className={styles.drawerDeleteConfirmActions}>
                  <button
                    className={styles.drawerCancelBtn}
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className={styles.drawerDeleteConfirmBtn}
                    onClick={() => deleteMut.mutate()}
                    disabled={deleteMut.isPending}
                  >
                    {deleteMut.isPending ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ─── standup form ─────────────────────────────────────────────── */
interface StandupDraft {
  yesterday: string;
  today: string;
  blockers: string;
}

function StandupOverlay({
  onClose,
  onSubmit,
  loading,
}: {
  onClose: () => void;
  onSubmit: (d: StandupDraft) => void;
  loading: boolean;
}) {
  const [draft, setDraft] = useState<StandupDraft>({
    yesterday: "",
    today: "",
    blockers: "",
  });
  function set(k: keyof StandupDraft) {
    return (e: React.ChangeEvent<HTMLTextAreaElement>) =>
      setDraft((p) => ({ ...p, [k]: e.target.value }));
  }
  return (
    <div className={styles.standupOverlay}>
      <div className={styles.standupHeader}>
        <span>
          <RiCalendarCheckLine size={14} /> Post Daily Standup
        </span>
        <button className={styles.standupClose} onClick={onClose}>
          <RiCloseCircleLine size={16} />
        </button>
      </div>
      <div className={styles.standupFields}>
        <label className={styles.standupLabel}>
          ✅ What did you do yesterday?
        </label>
        <textarea
          className={styles.standupTextarea}
          rows={2}
          placeholder="Completed feature X, reviewed PR…"
          value={draft.yesterday}
          onChange={set("yesterday")}
          autoFocus
        />
        <label className={styles.standupLabel}>
          🎯 What will you do today?
        </label>
        <textarea
          className={styles.standupTextarea}
          rows={2}
          placeholder="Working on ticket TRKLY-xx…"
          value={draft.today}
          onChange={set("today")}
        />
        <label className={styles.standupLabel}>🚧 Any blockers?</label>
        <textarea
          className={styles.standupTextarea}
          rows={1}
          placeholder="None / Waiting on review…"
          value={draft.blockers}
          onChange={set("blockers")}
        />
      </div>
      <div className={styles.standupActions}>
        <button className={styles.standupCancelBtn} onClick={onClose}>
          Cancel
        </button>
        <button
          className={styles.standupSubmitBtn}
          disabled={loading || (!draft.yesterday.trim() && !draft.today.trim())}
          onClick={() => onSubmit(draft)}
        >
          {loading ? "Posting…" : "Post Standup"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function ChatPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();

  /* ── channel state ── */
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [managingChannelId, setManagingChannelId] = useState<string | null>(
    null,
  );
  const [showCreate, setShowCreate] = useState(false);

  /* ── compose state ── */
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef(true);

  /* ── mention dropdown ── */
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionAnchor, setMentionAnchor] = useState(0);
  const [activeMentionIdx, setActiveMentionIdx] = useState(0);

  /* ── slash commands ── */
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [activeSlashIdx, setActiveSlashIdx] = useState(0);

  /* ── standup overlay ── */
  const [showStandup, setShowStandup] = useState(false);
  const [standupLoading, setStandupLoading] = useState(false);

  /* ── EOS loading ── */
  const [eosLoading, setEosLoading] = useState(false);

  /* ── queries ── */
  const { data: channels = [] } = useQuery({
    queryKey: ["chat-channels"],
    queryFn: fetchChatChannels,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["org-members"],
    queryFn: fetchOrgMembers,
    staleTime: 5 * 60_000,
  });

  // Members of the active channel (for @mention filtering)
  const { data: channelMembersRaw = [] } = useQuery({
    queryKey: ["channel-members", activeChannelId],
    queryFn: () => fetchChannelMembers(activeChannelId!),
    enabled: !!activeChannelId,
  });

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  // For private channels only show channel members in @mentions; for public show all org members
  const memberNames = useMemo(() => {
    if (activeChannel?.is_private && channelMembersRaw.length > 0) {
      return (channelMembersRaw as { name: string }[])
        .map((m) => m.name)
        .filter(Boolean);
    }
    return members
      .map((m: { name?: string }) => m.name)
      .filter(Boolean) as string[];
  }, [activeChannel, channelMembersRaw, members]);

  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ["chat-messages", activeChannelId],
    queryFn: () => fetchChatMessages(activeChannelId!, 100, 0),
    enabled: activeChannelId !== null,
    refetchInterval: 4000,
  });
  const messages: ChatMessage[] = messagesData?.messages ?? [];

  /* ── mutations ── */
  const sendMut = useMutation({
    mutationFn: ({ channelId, body }: { channelId: string; body: string }) =>
      sendChatMessage(channelId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-messages", activeChannelId] });
      setInput("");
      shouldScrollRef.current = true;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* ── effects ── */
  useEffect(() => {
    if (channels.length > 0 && !activeChannelId)
      setActiveChannelId(channels[0].id);
  }, [channels, activeChannelId]);

  useEffect(() => {
    if (shouldScrollRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    shouldScrollRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }, []);

  /* ── mention filtering ── */
  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    return memberNames
      .filter((n) => n.toLowerCase().startsWith(mentionQuery.toLowerCase()))
      .slice(0, 6);
  }, [mentionQuery, memberNames]);

  /* ── slash filtering ── */
  const slashMatches = useMemo(() => {
    if (slashQuery === null) return [];
    return SLASH_COMMANDS.filter((c) =>
      c.cmd.startsWith(slashQuery.toLowerCase()),
    );
  }, [slashQuery]);

  /* ── input change: detect @ and / ── */
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setInput(val);

    const cursor = e.target.selectionStart ?? val.length;

    // Slash command detection (only at the very start)
    if (val.startsWith("/") && !val.includes("\n")) {
      const cmd = val.slice(1).split(" ")[0];
      if (!val.includes(" ")) {
        setSlashQuery(cmd);
        setActiveSlashIdx(0);
        setMentionQuery(null);
        return;
      }
    }
    setSlashQuery(null);

    // Mention detection
    const textBeforeCursor = val.slice(0, cursor);
    const lastAt = textBeforeCursor.lastIndexOf("@");
    if (lastAt !== -1) {
      const fragment = textBeforeCursor.slice(lastAt + 1);
      if (!fragment.includes(" ") && !fragment.includes("\n")) {
        setMentionQuery(fragment);
        setMentionAnchor(lastAt);
        setActiveMentionIdx(0);
        return;
      }
    }
    setMentionQuery(null);
  }

  /* ── insert mention ── */
  function insertMention(name: string) {
    const before = input.slice(0, mentionAnchor);
    const after = input.slice(mentionAnchor + 1 + (mentionQuery?.length ?? 0));
    const newVal = `${before}@${name} ${after}`;
    setInput(newVal);
    setMentionQuery(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  /* ── pick slash command ── */
  function pickSlashCommand(cmd: string) {
    if (cmd === "standup") {
      setInput("");
      setSlashQuery(null);
      setShowStandup(true);
    } else if (cmd === "eos") {
      setInput("/eos ");
      setSlashQuery(null);
      setTimeout(() => textareaRef.current?.focus(), 0);
    } else if (cmd === "help") {
      setInput("");
      setSlashQuery(null);
      toast("Commands: /standup — post standup  •  /eos <question> — ask EOS", {
        icon: "💡",
        duration: 5000,
      });
    }
  }

  /* ── submit standup ── */
  async function handleStandupSubmit(draft: StandupDraft) {
    if (!activeChannelId) return;
    setStandupLoading(true);
    try {
      await createStandup({
        yesterday: draft.yesterday,
        today: draft.today,
        blockers: draft.blockers || "None",
        date: new Date().toISOString().slice(0, 10),
      });
      qc.invalidateQueries({ queryKey: ["my-standup"] });
      qc.invalidateQueries({ queryKey: ["team-standups"] });
      const body = `📋 **Standup**\n✅ Yesterday: ${draft.yesterday}\n🎯 Today: ${draft.today}\n🚧 Blockers: ${draft.blockers || "None"}`;
      sendMut.mutate({ channelId: activeChannelId, body });
      setShowStandup(false);
      toast.success("Standup posted!");
    } catch {
      toast.error("Failed to post standup");
    } finally {
      setStandupLoading(false);
    }
  }

  /* ── send message (handles /eos) ── */
  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || !activeChannelId) return;

    // EOS command
    if (trimmed.toLowerCase().startsWith("/eos ")) {
      const question = trimmed.slice(5).trim();
      if (!question) {
        toast.error("Usage: /eos <your question>");
        return;
      }
      setInput("");
      setEosLoading(true);
      sendMut.mutate({
        channelId: activeChannelId,
        body: `🤖 Asking EOS: *${question}*`,
      });
      try {
        const result = await novaAgent(question);
        const answer =
          typeof result === "string" ? result : (result?.answer ?? "No answer");
        sendMut.mutate({
          channelId: activeChannelId,
          body: `**EOS:** ${answer}`,
        });
      } catch {
        sendMut.mutate({
          channelId: activeChannelId,
          body: "⚠️ EOS couldn't answer that right now.",
        });
      } finally {
        setEosLoading(false);
      }
      return;
    }

    sendMut.mutate({ channelId: activeChannelId, body: trimmed });
  }

  /* ── keyboard handling ── */
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery !== null && mentionMatches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveMentionIdx((i) => (i + 1) % mentionMatches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveMentionIdx(
          (i) => (i - 1 + mentionMatches.length) % mentionMatches.length,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mentionMatches[activeMentionIdx]);
        return;
      }
      if (e.key === "Escape") {
        setMentionQuery(null);
        return;
      }
    }

    if (slashQuery !== null && slashMatches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveSlashIdx((i) => (i + 1) % slashMatches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveSlashIdx(
          (i) => (i - 1 + slashMatches.length) % slashMatches.length,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pickSlashCommand(slashMatches[activeSlashIdx].cmd);
        return;
      }
      if (e.key === "Escape") {
        setSlashQuery(null);
        setInput("");
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  /* ── channel groups ── */
  const managingChannel = channels.find((c) => c.id === managingChannelId);
  const podChannels = channels.filter(
    (c: { type: string }) => c.type === "pod",
  );
  const generalChannels = channels.filter(
    (c: { type: string }) => c.type === "general",
  );

  /* ── message body renderer ── */
  function renderBody(body: string) {
    if (body.startsWith("🔵 ") || body.startsWith("🔴 ")) {
      return <span className={styles.systemMessage}>{body}</span>;
    }
    if (body.startsWith("**EOS:**")) {
      return (
        <div className={styles.eosMessage}>
          <RiRobot2Line size={13} className={styles.eosIcon} />
          <span className={styles.messageText}>
            {body.replace("**EOS:**", "").trim()}
          </span>
        </div>
      );
    }
    if (body.startsWith("📋 **Standup**")) {
      const lines = body.split("\n").slice(1);
      return (
        <div className={styles.standupCard}>
          <div className={styles.standupCardTitle}>
            <RiCalendarCheckLine size={12} /> Daily Standup
          </div>
          {lines.map((line, i) => (
            <div key={i} className={styles.standupCardLine}>
              {line}
            </div>
          ))}
        </div>
      );
    }
    const boldParsed = body.replace(
      /\*\*(.*?)\*\*/g,
      (_, t) => `__BOLD__${t}__ENDBOLD__`,
    );
    if (boldParsed.includes("__BOLD__")) {
      const parts = boldParsed.split(/(__BOLD__|__ENDBOLD__)/);
      let bold = false;
      return (
        <span className={styles.messageText}>
          {parts.map((p, i) => {
            if (p === "__BOLD__") {
              bold = true;
              return null;
            }
            if (p === "__ENDBOLD__") {
              bold = false;
              return null;
            }
            const isMention = memberNames.some(
              (m) => p.toLowerCase() === `@${m.toLowerCase()}`,
            );
            if (isMention)
              return (
                <span key={i} className={styles.mention}>
                  {p}
                </span>
              );
            return bold ? (
              <strong key={i}>{p}</strong>
            ) : (
              <span key={i}>{p}</span>
            );
          })}
        </span>
      );
    }
    return <MentionBody text={body} members={memberNames} />;
  }

  const isBusy = sendMut.isPending || eosLoading;

  const orgMembersList = members.map(
    (m: { id?: string; name?: string; role?: string }) => ({
      id: String(m.id ?? ""),
      name: m.name,
      role: m.role,
    }),
  );

  /* ══════════════════════════════════════════════════════════════ */
  return (
    <div className={styles.page}>
      {/* Page header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.pageTitleWrap}>
            <h1 className={styles.pageTitle}>Team Chat</h1>
          </div>
        </div>
        {/* <div className={styles.pageHeaderRight}>
          <span className={styles.headerBadge}>
            <RiHashtag size={11} /> {channels.length}
          </span>
          <span className={styles.headerBadge}>
            <RiTeamLine size={11} /> {members.length}
          </span>
        </div> */}
      </div>

      <div className={styles.body}>
        {/* ── Sidebar ── */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <span>Channels</span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowCreate(true)}
              style={{ padding: 4 }}
            >
              <RiAddLine size={14} />
            </button>
          </div>

          <div className={styles.channelList}>
            {generalChannels.map((c) => (
              <div
                key={c.id}
                className={`${styles.channelItemWrap} ${c.id === managingChannelId ? styles.channelItemManaging : ""}`}
              >
                <button
                  className={`${styles.channelItem} ${c.id === activeChannelId ? styles.channelItemActive : ""}`}
                  onClick={() => {
                    setActiveChannelId(c.id);
                    shouldScrollRef.current = true;
                  }}
                >
                  <span className={styles.channelIcon}>
                    {c.is_private ? (
                      <RiLockLine size={13} />
                    ) : (
                      <RiHashtag size={14} />
                    )}
                  </span>
                  <span className={styles.channelName}>{c.name}</span>
                  {!c.is_private && (
                    <RiGlobalLine
                      size={10}
                      style={{ color: "var(--text-3)", flexShrink: 0 }}
                    />
                  )}
                </button>
                <button
                  className={`${styles.channelGearBtn} ${c.id === managingChannelId ? styles.channelGearBtnActive : ""}`}
                  onClick={() =>
                    setManagingChannelId(
                      c.id === managingChannelId ? null : c.id,
                    )
                  }
                  title="Channel settings"
                >
                  <RiSettings3Line size={12} />
                </button>
              </div>
            ))}

            {podChannels.length > 0 && (
              <>
                <div className={styles.sidebarSection}>Pods</div>
                {podChannels.map((c) => (
                  <div
                    key={c.id}
                    className={`${styles.channelItemWrap} ${c.id === managingChannelId ? styles.channelItemManaging : ""}`}
                  >
                    <button
                      className={`${styles.channelItem} ${c.id === activeChannelId ? styles.channelItemActive : ""}`}
                      onClick={() => {
                        setActiveChannelId(c.id);
                        shouldScrollRef.current = true;
                      }}
                    >
                      <span className={styles.channelIcon}>
                        {c.is_private ? (
                          <RiLockLine size={13} />
                        ) : (
                          <RiTeamLine size={14} />
                        )}
                      </span>
                      <span className={styles.channelName}>{c.name}</span>
                    </button>
                    <button
                      className={`${styles.channelGearBtn} ${c.id === managingChannelId ? styles.channelGearBtnActive : ""}`}
                      onClick={() =>
                        setManagingChannelId(
                          c.id === managingChannelId ? null : c.id,
                        )
                      }
                      title="Channel settings"
                    >
                      <RiSettings3Line size={12} />
                    </button>
                  </div>
                ))}
              </>
            )}

            {channels.length === 0 && (
              <div
                style={{
                  padding: 12,
                  fontSize: 12,
                  color: "var(--text-2)",
                  textAlign: "center",
                }}
              >
                No channels yet
              </div>
            )}
          </div>

          {/* Hint */}
          <div className={styles.sidebarHint}>
            <RiShieldCheckLine size={11} />{" "}
            <span>
              Type <kbd>/</kbd> for commands
            </span>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className={styles.main}>
          {activeChannel ? (
            <>
              {/* Chat header */}
              <div className={styles.chatHeader}>
                <div className={styles.chatHeaderLeft}>
                  {activeChannel.type === "pod" ? (
                    <RiTeamLine size={15} color="var(--accent)" />
                  ) : (
                    <RiHashtag size={15} color="var(--accent)" />
                  )}
                  <h2>#{activeChannel.name}</h2>
                  <span className={styles.chatHeaderBadge}>
                    {activeChannel.type === "pod" ? "Pod" : "General"}
                  </span>
                  {activeChannel.is_private && (
                    <span className={styles.chatHeaderBadge}>
                      <RiLockLine size={9} /> Private
                    </span>
                  )}
                </div>
                <div className={styles.chatHeaderActions}>
                  <button
                    className={styles.standupTriggerBtn}
                    onClick={() => setShowStandup(true)}
                  >
                    <RiCalendarCheckLine size={13} /> Standup
                  </button>
                  <button
                    className={styles.eosTriggerBtn}
                    onClick={() => {
                      setInput("/eos ");
                      setTimeout(() => textareaRef.current?.focus(), 0);
                    }}
                  >
                    <RiRobot2Line size={13} /> Ask EOS
                  </button>
                  <button
                    className={`${styles.chatSettingsBtn} ${managingChannelId === activeChannel.id ? styles.chatSettingsBtnActive : ""}`}
                    onClick={() =>
                      setManagingChannelId(
                        managingChannelId === activeChannel.id
                          ? null
                          : activeChannel.id,
                      )
                    }
                  >
                    <RiSettings3Line size={13} />
                    {activeChannel.member_count ? (
                      <>
                        <RiUserLine size={11} /> {activeChannel.member_count}
                      </>
                    ) : (
                      "Settings"
                    )}
                  </button>
                </div>
              </div>

              {/* Message list */}
              <div
                className={styles.messageList}
                ref={listRef}
                onScroll={handleScroll}
              >
                {messagesLoading && messages.length === 0 && (
                  <div className={styles.emptyState}>Loading messages…</div>
                )}
                {messages.length === 0 && !messagesLoading && (
                  <div className={styles.emptyState}>
                    <RiChat3Line size={32} style={{ opacity: 0.3 }} />
                    <span>No messages yet — start the conversation!</span>
                    <span className={styles.emptyHint}>
                      Try <kbd>/standup</kbd> or <kbd>/eos</kbd>
                    </span>
                  </div>
                )}

                {messages.map((msg, idx) => {
                  const isSystemMsg =
                    msg.body.startsWith("🔵 ") || msg.body.startsWith("🔴 ");
                  if (isSystemMsg) {
                    return (
                      <div key={msg.id} className={styles.systemMessageRow}>
                        {renderBody(msg.body)}
                      </div>
                    );
                  }
                  const isMe = msg.user_id === user?.id;
                  const prev = idx > 0 ? messages[idx - 1] : null;
                  const grouped = !!prev && isSameGroup(prev, msg);

                  return (
                    <div
                      key={msg.id}
                      className={`${styles.message} ${isMe ? styles.messageMe : ""} ${grouped ? styles.messageGrouped : ""}`}
                    >
                      {grouped ? (
                        <div className={styles.groupedTime}>
                          {formatTime(msg.created_at)}
                        </div>
                      ) : (
                        <div
                          className={styles.avatar}
                          style={{
                            background: getAvatarColor(msg.author_name),
                          }}
                          title={msg.author_name}
                        >
                          {initials(msg.author_name)}
                        </div>
                      )}
                      <div
                        className={`${styles.messageBody} ${isMe ? styles.messageBodyMe : ""}`}
                      >
                        {!grouped && (
                          <div
                            className={`${styles.messageMeta} ${isMe ? styles.messageMetaMe : ""}`}
                          >
                            <span className={styles.messageTime}>
                              {formatTime(msg.created_at)}
                            </span>
                            <span
                              className={`${styles.messageAuthor} ${isMe ? styles.messageAuthorMe : ""}`}
                            >
                              {isMe ? "You" : msg.author_name}
                            </span>
                          </div>
                        )}
                        <div
                          className={
                            isMe ? styles.messageBubbleMe : styles.messageBubble
                          }
                        >
                          {renderBody(msg.body)}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {eosLoading && (
                  <div className={styles.eosTyping}>
                    <RiRobot2Line size={14} /> EOS is thinking…
                  </div>
                )}
              </div>

              {/* Standup overlay */}
              {showStandup && (
                <StandupOverlay
                  onClose={() => setShowStandup(false)}
                  onSubmit={handleStandupSubmit}
                  loading={standupLoading}
                />
              )}

              {/* Compose area */}
              <div className={styles.composeWrap}>
                {/* Mention dropdown */}
                {mentionQuery !== null && mentionMatches.length > 0 && (
                  <div className={styles.autocompleteMenu}>
                    <div className={styles.autocompleteLabel}>Members</div>
                    {mentionMatches.map((name, i) => (
                      <button
                        key={name}
                        className={`${styles.autocompleteItem} ${i === activeMentionIdx ? styles.autocompleteItemActive : ""}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          insertMention(name);
                        }}
                      >
                        <span
                          className={styles.autocompleteAvatar}
                          style={{ background: getAvatarColor(name) }}
                        >
                          {initials(name)}
                        </span>
                        <span>@{name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Slash command menu */}
                {slashQuery !== null && slashMatches.length > 0 && (
                  <div className={styles.autocompleteMenu}>
                    <div className={styles.autocompleteLabel}>Commands</div>
                    {slashMatches.map((sc, i) => (
                      <button
                        key={sc.cmd}
                        className={`${styles.autocompleteItem} ${i === activeSlashIdx ? styles.autocompleteItemActive : ""}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          pickSlashCommand(sc.cmd);
                        }}
                      >
                        <span className={styles.slashIcon}>{sc.icon}</span>
                        <span className={styles.slashCmd}>/{sc.cmd}</span>
                        <span className={styles.slashDesc}>{sc.desc}</span>
                      </button>
                    ))}
                  </div>
                )}

                <form className={styles.inputWrap} onSubmit={handleSend}>
                  <textarea
                    ref={textareaRef}
                    className={styles.input}
                    rows={1}
                    placeholder={`Message #${activeChannel.name}… (/ for commands, @ to mention)`}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                  />
                  <button
                    type="submit"
                    className={styles.sendBtn}
                    disabled={!input.trim() || isBusy}
                  >
                    {isBusy ? (
                      <RiArrowUpLine size={14} style={{ opacity: 0.5 }} />
                    ) : (
                      <RiSendPlaneLine size={16} />
                    )}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className={styles.emptyState}>
              <RiChat3Line size={40} style={{ opacity: 0.3 }} />
              <span>Select a channel to start chatting</span>
            </div>
          )}
        </main>
      </div>

      {/* ── Create Channel Drawer ── */}
      {showCreate && (
        <CreateChannelDrawer
          orgMembers={orgMembersList}
          onClose={() => setShowCreate(false)}
          onCreated={() => {}}
        />
      )}

      {/* ── Channel Settings Drawer ── */}
      {managingChannelId && managingChannel && user && (
        <ChannelSettingsDrawer
          channelId={managingChannelId}
          channelName={managingChannel.name}
          channelType={managingChannel.type}
          isPrivate={!!managingChannel.is_private}
          currentUserId={user.id}
          userRole={user.role ?? ""}
          createdBy={managingChannel.created_by}
          orgMembers={orgMembersList}
          onClose={() => setManagingChannelId(null)}
          onDeleted={() => {
            setManagingChannelId(null);
            if (activeChannelId === managingChannelId) setActiveChannelId(null);
          }}
        />
      )}
    </div>
  );
}
