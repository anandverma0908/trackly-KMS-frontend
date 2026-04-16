import { useState } from "react";
import toast from "react-hot-toast";
import LatticeGrid, { Column } from "@/components/ui/LatticeGrid";
import styles from "./NotificationPrefsPage.module.css";

interface PrefRow {
  id:     string;
  label:  string;
  desc:   string;
  inApp:  boolean;
  email:  boolean;
}

const DEFAULT_PREFS: PrefRow[] = [
  { id: "sprint_started",     label: "Sprint Started",          desc: "When a sprint transitions to Active",          inApp: true,  email: false },
  { id: "sprint_completed",   label: "Sprint Completed",         desc: "When a sprint is marked Complete",             inApp: true,  email: false },
  { id: "standup_ready",      label: "Standup Ready",            desc: "When EOS generates your daily standup",       inApp: true,  email: false },
  { id: "ticket_assigned",    label: "Ticket Assigned to You",   desc: "When a ticket is assigned to you",             inApp: true,  email: true  },
  { id: "ticket_commented",   label: "Comment on Your Ticket",   desc: "When someone comments on your ticket",         inApp: true,  email: true  },
  { id: "burn_rate_warning",  label: "Burn Rate Warning",        desc: "Client hours at 70% / 85% / 100% / 110%",     inApp: true,  email: true  },
  { id: "mention",            label: "@Mention",                 desc: "When you are @mentioned in a comment",        inApp: true,  email: true  },
  { id: "wiki_updated",       label: "Wiki Page Updated",        desc: "Changes to pages you're watching",            inApp: true,  email: false },
  { id: "knowledge_gap",      label: "Knowledge Gap Detected",   desc: "EOS finds an undocumented topic cluster",     inApp: true,  email: false },
  { id: "release_notes",      label: "Release Notes Generated",  desc: "When release notes are ready for a sprint",   inApp: true,  email: false },
];

export default function NotificationPrefsPage() {
  const [prefs, setPrefs]             = useState<PrefRow[]>(DEFAULT_PREFS);
  const [saving, setSaving]           = useState(false);
  const [globalEmail, setGlobalEmail] = useState(true);
  const [globalInApp, setGlobalInApp] = useState(true);

  function toggle(id: string, channel: "inApp" | "email") {
    setPrefs((prev) => prev.map((p) => p.id === id ? { ...p, [channel]: !p[channel] } : p));
  }

  function toggleAll(channel: "inApp" | "email", value: boolean) {
    setPrefs((prev) => prev.map((p) => ({ ...p, [channel]: value })));
    if (channel === "inApp")  setGlobalInApp(value);
    if (channel === "email")  setGlobalEmail(value);
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
          <div style={{ fontSize: "0.88rem", fontWeight: 500, color: "var(--text)" }}>{row.label}</div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-3)", marginTop: 2 }}>{row.desc}</div>
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
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Notification Preferences</h1>
          <p className={styles.subtitle}>Choose how and when you receive notifications from Trackly.</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Preferences"}
        </button>
      </div>

      {/* Global toggles */}
      <div className={styles.globalBar}>
        <div className={styles.globalItem}>
          <div className={styles.globalLabel}>In-App Notifications</div>
          <div className={styles.globalDesc}>Bell icon in the top-right</div>
          <Toggle checked={globalInApp} onChange={(v) => toggleAll("inApp", v)} />
        </div>
        <div className={styles.globalItem}>
          <div className={styles.globalLabel}>Email Notifications</div>
          <div className={styles.globalDesc}>Sent to your account email</div>
          <Toggle checked={globalEmail} onChange={(v) => toggleAll("email", v)} />
        </div>
      </div>

      {/* Per-type grid */}
      <div style={{ marginBottom: 20 }}>
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

      <p className={styles.note}>
        Email delivery requires SMTP to be configured in system settings.
        In-app notifications are always delivered when the app is open.
      </p>
    </div>
  );
}

function Toggle({ checked, onChange, disabled }: {
  checked:   boolean;
  onChange:  (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      className={`${styles.toggle} ${checked ? styles.toggleOn : ""} ${disabled ? styles.toggleDisabled : ""}`}
    >
      <span className={styles.toggleThumb} />
    </button>
  );
}
