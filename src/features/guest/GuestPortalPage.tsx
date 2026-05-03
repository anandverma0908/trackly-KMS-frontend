import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  fetchGuestTokens,
  createGuestToken,
  revokeGuestToken,
  fetchSpacesList,
} from "@/services/api";
import type { GuestAccessToken } from "@/types";
import {
  RiAddLine,
  RiDeleteBinLine,
  RiLink,
  RiCheckLine,
  RiGlobalLine,
} from "react-icons/ri";
import SideDrawer from "@/components/ui/SideDrawer";
import styles from "./GuestPortalPage.module.css";

const SHARE_URL_BASE =
  `${window.location.origin}/guest-login`;

interface FormState {
  email: string;
  name: string;
  allowed_pods: string[];
  expires_at: string;
}

const emptyForm = (): FormState => ({
  email: "",
  name: "",
  allowed_pods: [],
  expires_at: "",
});

export default function GuestPortalPage() {
  const qc = useQueryClient();
  const [showDrawer, setShowDrawer] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: tokens = [], isLoading: tokensLoading } = useQuery({
    queryKey: ["guest-tokens"],
    queryFn: fetchGuestTokens,
  });

  const { data: spaces = [] } = useQuery({
    queryKey: ["spaces-list"],
    queryFn: fetchSpacesList,
  });

  const createMut = useMutation({
    mutationFn: () =>
      createGuestToken({
        email: form.email,
        name: form.name,
        allowed_pods: form.allowed_pods,
        expires_at: form.expires_at || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guest-tokens"] });
      toast.success("Guest link created");
      setShowDrawer(false);
      setForm(emptyForm());
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to create link"),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revokeGuestToken(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guest-tokens"] });
      toast.success("Guest link revoked");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to revoke"),
  });

  const activeTokens = tokens.filter((t) => t.is_active);

  function togglePod(pod: string) {
    setForm((prev) => {
      const has = prev.allowed_pods.includes(pod);
      return {
        ...prev,
        allowed_pods: has
          ? prev.allowed_pods.filter((p) => p !== pod)
          : [...prev.allowed_pods, pod],
      };
    });
  }

  function copyUrl(token: GuestAccessToken) {
    const url = `${SHARE_URL_BASE}?token=${encodeURIComponent(token.token)}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(token.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success("Shareable URL copied");
    });
  }

  const canSubmit =
    form.email.trim() && form.name.trim() && form.allowed_pods.length > 0;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>
            <RiGlobalLine size={20} style={{ verticalAlign: "-2px", marginRight: 8 }} />
            Guest Portal
          </h1>
          <p className={styles.subtitle}>
            Create shareable links so clients can view selected tickets read-only.
          </p>
        </div>
        <button className={styles.addBtn} onClick={() => setShowDrawer(true)}>
          <RiAddLine size={16} />
          Create Guest Link
        </button>
      </div>

      {/* Token list */}
      <div className="card" style={{ padding: 20 }}>
        <h3 className={styles.sectionTitle}>Active Guest Links</h3>
        {tokensLoading ? (
          <p className={styles.emptyText}>Loading…</p>
        ) : activeTokens.length === 0 ? (
          <div className={styles.emptyState}>
            <RiGlobalLine size={32} className={styles.emptyIcon} />
            <p className={styles.emptyText}>No active guest links yet.</p>
            <p className={styles.emptySubtext}>
              Create one to share read-only ticket access with clients.
            </p>
          </div>
        ) : (
          <div className={styles.tokenList}>
            {activeTokens.map((t) => (
              <div key={t.id} className={styles.tokenCard}>
                <div className={styles.tokenMeta}>
                  <div className={styles.tokenName}>{t.name}</div>
                  <div className={styles.tokenEmail}>{t.email}</div>
                  <div className={styles.tokenPods}>
                    {(t.allowed_pods ?? []).join(", ")}
                  </div>
                  {t.expires_at && (
                    <div className={styles.tokenExpiry}>
                      Expires {new Date(t.expires_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <div className={styles.tokenActions}>
                  <button
                    className={styles.iconBtn}
                    onClick={() => copyUrl(t)}
                    title="Copy shareable URL"
                  >
                    {copiedId === t.id ? (
                      <RiCheckLine size={16} color="var(--success)" />
                    ) : (
                      <RiLink size={16} />
                    )}
                  </button>
                  <button
                    className={`${styles.iconBtn} ${styles.danger}`}
                    onClick={() => revokeMut.mutate(t.id)}
                    title="Revoke"
                  >
                    <RiDeleteBinLine size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Drawer */}
      <SideDrawer
        open={showDrawer}
        onClose={() => setShowDrawer(false)}
        title="Create Guest Link"
      >
        <div className={styles.drawerBody}>
          <label className={styles.fieldLabel}>Client Name</label>
          <input
            className={styles.input}
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Acme Corp"
          />

          <label className={styles.fieldLabel}>Email</label>
          <input
            className={styles.input}
            type="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            placeholder="client@example.com"
          />

          <label className={styles.fieldLabel}>PODs to Share</label>
          <div className={styles.podGrid}>
            {spaces.map((s) => (
              <label key={s.pod} className={styles.podChip}>
                <input
                  type="checkbox"
                  checked={form.allowed_pods.includes(s.pod)}
                  onChange={() => togglePod(s.pod)}
                />
                <span>{s.pod}</span>
              </label>
            ))}
            {spaces.length === 0 && (
              <p className={styles.emptyText}>No PODs available.</p>
            )}
          </div>

          <label className={styles.fieldLabel}>Expiry Date (optional)</label>
          <input
            className={styles.input}
            type="date"
            value={form.expires_at}
            onChange={(e) => setForm((p) => ({ ...p, expires_at: e.target.value }))}
          />

          <button
            className={styles.submitBtn}
            disabled={!canSubmit || createMut.isPending}
            onClick={() => createMut.mutate()}
          >
            {createMut.isPending ? "Creating…" : "Create Link"}
          </button>
        </div>
      </SideDrawer>
    </div>
  );
}
