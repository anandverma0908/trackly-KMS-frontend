import { useState } from "react";
import toast from "react-hot-toast";
import { useAuthStore, getAuthHeader } from "@/features/auth/model/useAuthStore";
import { useThemeStore } from "@/store";
import { THEMES } from "@/config/themes";
import { ROLE_COLORS } from "@/features/auth/model/types";
import LatticeGrid, { Column } from "@/components/ui/LatticeGrid";
import UsersTab from "./ui/UsersTab";
import BudgetTab from "./ui/BudgetTab";
import notificationStyles from "./NotificationPrefsPage.module.scss";
import passwordStyles from "./ChangePasswordPage.module.scss";
import styles from "./SettingsPage.module.scss";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

type TabKey =
  | "profile"
  | "appearance"
  | "notifications"
  | "password"
  | "users"
  | "budget";

interface TabDef {
  key: TabKey;
  label: string;
  icon: string;
  guard?: () => boolean;
}

export default function SettingsPage() {
  const can = useAuthStore((s) => s.can);

  const allTabs: TabDef[] = [
    { key: "profile", label: "Profile", icon: "👤" },
    { key: "appearance", label: "Appearance", icon: "🎨" },
    { key: "notifications", label: "Notifications", icon: "🔔" },
    { key: "password", label: "Change Password", icon: "🔒" },
    {
      key: "users",
      label: "Users",
      icon: "👥",
      guard: () => can("manage:users"),
    },
    {
      key: "budget",
      label: "Budget & Burn Rate",
      icon: "📊",
      guard: () => can("view:summary") || can("manage:settings"),
    },
  ];
  const tabs = allTabs.filter((t) => (t.guard ? t.guard() : true));

  const [activeTab, setActiveTab] = useState<TabKey>("profile");

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>
          Manage your account and app preferences
        </p>
      </div>

      <div className={styles.layout}>
        {/* Left: vertical tabs */}
        <div className={styles.tabList}>
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`${styles.tabBtn} ${activeTab === t.key ? styles.tabBtnActive : ""}`}
              onClick={() => setActiveTab(t.key)}
            >
              {/* <span className={styles.tabIcon}>{t.icon}</span> */}
              <span className={styles.tabLabel}>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Right: tab content */}
        <div className={styles.tabPanel}>
          {activeTab === "profile" && <ProfileTab />}
          {activeTab === "appearance" && <AppearanceTab />}
          {activeTab === "notifications" && <NotificationsTab />}
          {activeTab === "password" && <PasswordTab />}
          {activeTab === "users" && <UsersTab />}
          {activeTab === "budget" && <BudgetTab />}
        </div>
      </div>
    </div>
  );
}

/* Profile Tab */
function ProfileTab() {
  const user = useAuthStore((s) => s.user);
  const roleColor = user ? ROLE_COLORS[user.role] : undefined;
  const initials =
    user?.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "?";

  return (
    <div className="card" style={{ padding: 24 }}>
      <div className={styles.profileHeader}>
        <div className={styles.profileAvatar}>{initials}</div>
        <div>
          <div className={styles.profileName}>{user?.name}</div>
          <div className={styles.profileEmail}>{user?.email}</div>
          <span
            className={styles.profileRole}
            style={
              roleColor
                ? { color: roleColor.text, background: roleColor.bg }
                : {}
            }
          >
            {user?.role.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      <div className={styles.profileGrid}>
        <div className={styles.profileField}>
          <label className={styles.profileLabel}>Full Name</label>
          <input className="input" value={user?.name ?? ""} readOnly />
        </div>
        <div className={styles.profileField}>
          <label className={styles.profileLabel}>Email</label>
          <input className="input" value={user?.email ?? ""} readOnly />
        </div>
        <div className={styles.profileField}>
          <label className={styles.profileLabel}>Role</label>
          <input
            className="input"
            value={user?.role.replace(/_/g, " ") ?? ""}
            readOnly
          />
        </div>
        <div className={styles.profileField}>
          <label className={styles.profileLabel}>POD</label>
          <input className="input" value={user?.pod ?? "—"} readOnly />
        </div>
      </div>
    </div>
  );
}

/* Appearance Tab */
function AppearanceTab() {
  const { themeId, colorMode, setTheme, toggleMode } = useThemeStore();

  return (
    <div className="card" style={{ padding: 24 }}>
      <div className={styles.cardHeader} style={{ marginBottom: 20 }}>
        <span className={styles.cardIcon}>🎨</span>
        <div>
          <div className={styles.cardTitle}>Appearance</div>
          <div className={styles.cardSubtitle}>
            Accent color and light/dark mode
          </div>
        </div>
      </div>

      <div className={styles.appearanceSection}>
        <div className={styles.appearanceLabel}>Accent Color</div>
        <div className={styles.themeRow}>
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTheme(t.id);
                toast.success(`Theme: ${t.name}`);
              }}
              className={`${styles.themePill} ${themeId === t.id ? styles.themePillActive : ""}`}
              style={
                themeId === t.id
                  ? { borderColor: t.color, background: `${t.color}18` }
                  : {}
              }
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: t.color,
                  flexShrink: 0,
                  display: "block",
                }}
              />
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.appearanceSection}>
        <div className={styles.appearanceLabel}>Color Mode</div>
        <div className={styles.themeRow}>
          {(
            [
              ["dark", "🌙 Dark"],
              ["light", "☀️ Light"],
            ] as const
          ).map(([m, l]) => (
            <button
              key={m}
              onClick={() => {
                if (colorMode !== m) toggleMode();
              }}
              className={`${styles.themePill} ${colorMode === m ? styles.themePillActive : ""}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Notifications Tab */
function NotificationsTab() {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [globalEmail, setGlobalEmail] = useState(true);
  const [globalInApp, setGlobalInApp] = useState(true);

  function toggle(id: string, channel: "inApp" | "email") {
    setPrefs((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [channel]: !p[channel] } : p)),
    );
  }

  function toggleAll(channel: "inApp" | "email", value: boolean) {
    setPrefs((prev) => prev.map((p) => ({ ...p, [channel]: value })));
    if (channel === "inApp") setGlobalInApp(value);
    if (channel === "email") setGlobalEmail(value);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 500));
      toast.success("Preferences saved!");
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  }

  const COLUMNS: Column<PrefRow>[] = [
    {
      key: "label",
      label: "Notification Type",
      render: (row) => (
        <div>
          <div
            style={{
              fontSize: "0.88rem",
              fontWeight: 500,
              color: "var(--text)",
            }}
          >
            {row.label}
          </div>
          <div
            style={{
              fontSize: "0.78rem",
              color: "var(--text-3)",
              marginTop: 2,
            }}
          >
            {row.desc}
          </div>
        </div>
      ),
    },
    {
      key: "inApp",
      label: "In-App",
      width: 110,
      align: "center",
      render: (row) => (
        <Toggle
          checked={row.inApp && globalInApp}
          onChange={() => toggle(row.id, "inApp")}
          disabled={!globalInApp}
        />
      ),
    },
    {
      key: "email",
      label: "Email",
      width: 110,
      align: "center",
      render: (row) => (
        <Toggle
          checked={row.email && globalEmail}
          onChange={() => toggle(row.id, "email")}
          disabled={!globalEmail}
        />
      ),
    },
  ];

  return (
    <div className="card" style={{ padding: 24 }}>
      <div className={styles.tabHeader}>
        <div>
          <h2 className={styles.tabTitle}>Notification Preferences</h2>
          <p className={styles.tabSubtitle}>
            Choose how and when you receive notifications from Trackly.
          </p>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save Preferences"}
        </button>
      </div>

      <div
        className={notificationStyles.globalBar}
        style={{ margin: "16px 0" }}
      >
        <div className={notificationStyles.globalItem}>
          <div className={notificationStyles.globalLabel}>
            In-App Notifications
          </div>
          <div className={notificationStyles.globalDesc}>
            Bell icon in the top-right
          </div>
          <Toggle
            checked={globalInApp}
            onChange={(v) => toggleAll("inApp", v)}
          />
        </div>
        <div className={notificationStyles.globalItem}>
          <div className={notificationStyles.globalLabel}>
            Email Notifications
          </div>
          <div className={notificationStyles.globalDesc}>
            Sent to your account email
          </div>
          <Toggle
            checked={globalEmail}
            onChange={(v) => toggleAll("email", v)}
          />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <LatticeGrid<PrefRow>
          columns={COLUMNS}
          rows={prefs}
          rowKey="id"
          virtualize={false}
          rowHeight={60}
          emptyIcon="🔕"
          emptyTitle="No preferences"
          emptyDesc=""
        />
      </div>

      <p className={notificationStyles.note}>
        Email delivery requires SMTP to be configured in system settings. In-app
        notifications are always delivered when the app is open.
      </p>
    </div>
  );
}

/* Password Tab */
function PasswordTab() {
  const user = useAuthStore((s) => s.user);
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const strength =
    password.length === 0
      ? 0
      : password.length < 6
        ? 1
        : password.length < 10
          ? 2
          : /[A-Z]/.test(password) && /[0-9]/.test(password)
            ? 4
            : 3;

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"];
  const strengthColor = ["", "#F87171", "#FBBF24", "#34D399", "#4F7EFF"];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      toast.error("Minimum 6 characters");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? "Failed");
      }
      toast.success("Password updated!");
      setDone(true);
      setCurrent("");
      setPassword("");
      setConfirm("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  const initials =
    user?.name
      ?.split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "?";

  return (
    <div className="card" style={{ padding: 24, maxWidth: 480 }}>
      <div className={passwordStyles.avatar} style={{ marginBottom: 12 }}>
        {initials}
      </div>
      <div className={passwordStyles.name}>{user?.name}</div>
      <div className={passwordStyles.meta} style={{ marginBottom: 16 }}>
        {user?.email} ·{" "}
        <span className={passwordStyles.role}>
          {user?.role?.replace("_", " ")}
        </span>
      </div>

      {done && (
        <div
          className={passwordStyles.successBanner}
          style={{ marginBottom: 12 }}
        >
          ✓ Password changed successfully
        </div>
      )}

      <form className={passwordStyles.form} onSubmit={handleSubmit}>
        <div className={passwordStyles.field}>
          <label className={passwordStyles.label}>Current Password</label>
          <input
            className={passwordStyles.input}
            type="password"
            placeholder="Your current password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <div className={passwordStyles.field}>
          <label className={passwordStyles.label}>New Password</label>
          <input
            className={passwordStyles.input}
            type="password"
            placeholder="Min 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          {password.length > 0 && (
            <div className={passwordStyles.strengthWrap}>
              <div className={passwordStyles.strengthBars}>
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={passwordStyles.strengthBar}
                    style={{
                      background:
                        i <= strength
                          ? strengthColor[strength]
                          : "var(--border-2)",
                    }}
                  />
                ))}
              </div>
              <span
                className={passwordStyles.strengthLabel}
                style={{ color: strengthColor[strength] }}
              >
                {strengthLabel[strength]}
              </span>
            </div>
          )}
        </div>

        <div className={passwordStyles.field}>
          <label className={passwordStyles.label}>Confirm New Password</label>
          <input
            className={passwordStyles.input}
            type="password"
            placeholder="Re-enter new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            style={{
              borderColor:
                confirm && confirm !== password ? "#F87171" : undefined,
            }}
          />
          {confirm && confirm !== password && (
            <span className={passwordStyles.errorHint}>
              Passwords don't match
            </span>
          )}
        </div>

        <button
          type="submit"
          className={passwordStyles.btn}
          disabled={loading || !password || !confirm}
        >
          {loading ? "Updating…" : "Update Password"}
        </button>
      </form>
    </div>
  );
}

/* Notification helpers */
interface PrefRow {
  id: string;
  label: string;
  desc: string;
  inApp: boolean;
  email: boolean;
}

const DEFAULT_PREFS: PrefRow[] = [
  {
    id: "sprint_started",
    label: "Sprint Started",
    desc: "When a sprint transitions to Active",
    inApp: true,
    email: false,
  },
  {
    id: "sprint_completed",
    label: "Sprint Completed",
    desc: "When a sprint is marked Complete",
    inApp: true,
    email: false,
  },
  {
    id: "standup_ready",
    label: "Standup Ready",
    desc: "When EOS generates your daily standup",
    inApp: true,
    email: false,
  },
  {
    id: "ticket_assigned",
    label: "Ticket Assigned to You",
    desc: "When a ticket is assigned to you",
    inApp: true,
    email: true,
  },
  {
    id: "ticket_commented",
    label: "Comment on Your Ticket",
    desc: "When someone comments on your ticket",
    inApp: true,
    email: true,
  },
  {
    id: "burn_rate_warning",
    label: "Burn Rate Warning",
    desc: "Client hours at 70% / 85% / 100% / 110%",
    inApp: true,
    email: true,
  },
  {
    id: "mention",
    label: "@Mention",
    desc: "When you are @mentioned in a comment",
    inApp: true,
    email: true,
  },
  {
    id: "wiki_updated",
    label: "Wiki Page Updated",
    desc: "Changes to pages you're watching",
    inApp: true,
    email: false,
  },
  {
    id: "knowledge_gap",
    label: "Knowledge Gap Detected",
    desc: "EOS finds an undocumented topic cluster",
    inApp: true,
    email: false,
  },
  {
    id: "release_notes",
    label: "Release Notes Generated",
    desc: "When release notes are ready for a sprint",
    inApp: true,
    email: false,
  },
];

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      className={`${notificationStyles.toggle} ${checked ? notificationStyles.toggleOn : ""} ${disabled ? notificationStyles.toggleDisabled : ""}`}
    >
      <span className={notificationStyles.toggleThumb} />
    </button>
  );
}
