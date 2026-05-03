import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  fetchChatChannels,
  createChatChannel,
  fetchChatMessages,
  sendChatMessage,
  fetchOrgMembers,
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

function formatTime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function MentionBody({ text, members }: { text: string; members: string[] }) {
  const parts = useMemo(() => {
    const regex = new RegExp(
      `(@(?:${members.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}\\b))`,
      "gi"
    );
    return text.split(regex);
  }, [text, members]);

  return (
    <span className={styles.messageText}>
      {parts.map((part, i) => {
        const isMention = members.some(
          (m) => part.toLowerCase() === `@${m.toLowerCase()}`
        );
        if (isMention) {
          return (
            <span key={i} className={styles.mention}>
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

export default function ChatPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState<"general" | "pod">("general");
  const listRef = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef(true);

  const { data: channels = [] } = useQuery({
    queryKey: ["chat-channels"],
    queryFn: fetchChatChannels,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["org-members"],
    queryFn: fetchOrgMembers,
    staleTime: 5 * 60_000,
  });

  const memberNames = useMemo(
    () => members.map((m: { name?: string }) => m.name).filter(Boolean) as string[],
    [members]
  );

  const {
    data: messagesData,
    isLoading: messagesLoading,
  } = useQuery({
    queryKey: ["chat-messages", activeChannelId],
    queryFn: () => fetchChatMessages(activeChannelId!, 50, 0),
    enabled: activeChannelId !== null,
    refetchInterval: 5000,
  });

  const messages = messagesData?.messages ?? [];

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

  const createChannelMut = useMutation({
    mutationFn: (payload: { name: string; type: "pod" | "general"; pod?: string | null }) =>
      createChatChannel(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-channels"] });
      setShowCreate(false);
      setNewChannelName("");
      setNewChannelType("general");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Auto-select first channel on load
  useEffect(() => {
    if (channels.length > 0 && !activeChannelId) {
      setActiveChannelId(channels[0].id);
    }
  }, [channels, activeChannelId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (shouldScrollRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    shouldScrollRef.current = nearBottom;
  }, []);

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  const podChannels = channels.filter((c) => c.type === "pod");
  const generalChannels = channels.filter((c) => c.type === "general");

  function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim() || !activeChannelId) return;
    sendMut.mutate({ channelId: activeChannelId, body: input.trim() });
  }

  function handleCreateChannel(e: React.FormEvent) {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    createChannelMut.mutate({
      name: newChannelName.trim(),
      type: newChannelType,
      pod: newChannelType === "pod" ? newChannelName.trim() : null,
    });
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Team Chat</h1>
      </div>

      <div className={styles.body}>
        {/* ── Sidebar ── */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <span>Channels</span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowCreate((v) => !v)}
              title="New channel"
              style={{ padding: 4 }}
            >
              <RiAddLine size={14} />
            </button>
          </div>

          {showCreate && (
            <form className={styles.createChannelForm} onSubmit={handleCreateChannel}>
              <input
                className={styles.createChannelInput}
                placeholder="Channel name…"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                autoFocus
              />
              <div className={styles.createChannelRow}>
                <select
                  className={styles.createChannelInput}
                  value={newChannelType}
                  onChange={(e) => setNewChannelType(e.target.value as "general" | "pod")}
                  style={{ flex: 1 }}
                >
                  <option value="general">General</option>
                  <option value="pod">Pod</option>
                </select>
                <button type="submit" className={styles.createChannelBtn} disabled={!newChannelName.trim()}>
                  Create
                </button>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className={styles.channelList}>
            {generalChannels.length > 0 && (
              <>
                {generalChannels.map((c) => (
                  <button
                    key={c.id}
                    className={`${styles.channelItem} ${c.id === activeChannelId ? styles.channelItemActive : ""}`}
                    onClick={() => {
                      setActiveChannelId(c.id);
                      shouldScrollRef.current = true;
                    }}
                  >
                    <span className={styles.channelIcon}>
                      <RiHashtag size={14} />
                    </span>
                    <span className={styles.channelName}>{c.name}</span>
                    <span className={styles.channelBadge}>General</span>
                  </button>
                ))}
              </>
            )}

            {podChannels.length > 0 && (
              <>
                <div style={{ padding: "6px 10px", fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Pods
                </div>
                {podChannels.map((c) => (
                  <button
                    key={c.id}
                    className={`${styles.channelItem} ${c.id === activeChannelId ? styles.channelItemActive : ""}`}
                    onClick={() => {
                      setActiveChannelId(c.id);
                      shouldScrollRef.current = true;
                    }}
                  >
                    <span className={styles.channelIcon}>
                      <RiTeamLine size={14} />
                    </span>
                    <span className={styles.channelName}>{c.name}</span>
                    <span className={styles.channelBadge}>Pod</span>
                  </button>
                ))}
              </>
            )}

            {channels.length === 0 && (
              <div style={{ padding: 12, fontSize: 12, color: "var(--text-3)", textAlign: "center" }}>
                No channels yet
              </div>
            )}
          </div>
        </aside>

        {/* ── Main Chat ── */}
        <main className={styles.main}>
          {activeChannel ? (
            <>
              <div className={styles.chatHeader}>
                <RiHashtag size={16} color="var(--accent)" />
                <h2>#{activeChannel.name}</h2>
                <span>· {activeChannel.type === "pod" ? "Pod channel" : "General"}</span>
              </div>

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
                  </div>
                )}

                {messages.map((msg: ChatMessage) => {
                  const isMe = msg.user_id === user?.id;
                  return (
                    <div key={msg.id} className={styles.message}>
                      <div
                        className={styles.avatar}
                        style={{ background: getAvatarColor(msg.author_name) }}
                        title={msg.author_name}
                      >
                        {initials(msg.author_name)}
                      </div>
                      <div className={styles.messageBody}>
                        <div className={styles.messageMeta}>
                          <span className={styles.messageAuthor}>
                            {msg.author_name}
                            {isMe && " (you)"}
                          </span>
                          <span className={styles.messageTime}>
                            {formatTime(msg.created_at)}
                          </span>
                        </div>
                        <MentionBody text={msg.body} members={memberNames} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <form className={styles.inputWrap} onSubmit={handleSend}>
                <input
                  className={styles.input}
                  placeholder={`Message #${activeChannel.name}…`}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <button
                  type="submit"
                  className={styles.sendBtn}
                  disabled={!input.trim() || sendMut.isPending}
                >
                  <RiSendPlaneLine size={16} />
                </button>
              </form>
            </>
          ) : (
            <div className={styles.emptyState}>
              <RiChat3Line size={40} style={{ opacity: 0.3 }} />
              <span>Select a channel to start chatting</span>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
