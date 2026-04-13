import { useState } from "react";
import toast from "react-hot-toast";
import styles from "./NotificationPrefsPage.module.css";

interface PrefRow {
  id:       string;
  label:    string;
  desc:     string;
  inApp:    boolean;
  email:    boolean;
}

const DEFAULT_PREFS: PrefRow[] = [
  { id: "sprint_started",     label: "Sprint Started",          desc: "When a sprint transitions to Active",          inApp: true,  email: false },
  { id: "sprint_completed",   label: "Sprint Completed",         desc: "When a sprint is marked Complete",             inApp: true,  email: false },
  { id: "standup_ready",      label: "Standup Ready",            desc: "When NOVA generates your daily standup",       inApp: true,  email: false },
  { id: "ticket_assigned",    label: "Ticket Assigned to You",   desc: "When a ticket is assigned to you",             inApp: true,  email: true  },
  { id: "ticket_commented",   label: "Comment on Your Ticket",   desc: "When someone comments on your ticket",         inApp: true,  email: true  },
  { id: "burn_rate_warning",  label: "Burn Rate Warning",        desc: "Client hours at 70% / 85% / 100% / 110%",     inApp: true,  email: true  },
  { id: "mention",            label: "@Mention",                 desc: "When you are @mentioned in a comment",        inApp: true,  email: true  },
  { id: "wiki_updated",       label: "Wiki Page Updated",        desc: "Changes to pages you're watching",            inApp: true,  email: false },
  { id: "knowledge_gap",      label: "Knowledge Gap Detected",   desc: "NOVA finds an undocumented topic cluster",     inApp: true,  email: false },
  { id: "release_notes",      label: "Release Notes Generated",  desc: "When release notes are ready for a sprint",   inApp: true,  email: false },
];

export default function NotificationPrefsPage() {
  const [prefs, setPrefs]     = useState<PrefRow[]>(DEFAULT_PREFS);
  const [saving, setSaving]   = useState(false);
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
    // Persist to backend — endpoint: POST /api/notifications/preferences
    try {
      await new Promise((r) => setTimeout(r, 500)); // optimistic — wire to real endpoint
      toast.success("Preferences saved!");
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  }

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
          <Toggle
            checked={globalInApp}
            onChange={(v) => toggleAll("inApp", v)}
          />
        </div>
        <div className={styles.globalItem}>
          <div className={styles.globalLabel}>Email Notifications</div>
          <div className={styles.globalDesc}>Sent to your account email</div>
          <Toggle
            checked={globalEmail}
            onChange={(v) => toggleAll("email", v)}
          />
        </div>
      </div>

      {/* Per-type table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thLabel}>Notification Type</th>
              <th className={styles.thChannel}>In-App</th>
              <th className={styles.thChannel}>Email</th>
            </tr>
          </thead>
          <tbody>
            {prefs.map((pref) => (
              <tr key={pref.id} className={styles.row}>
                <td className={styles.labelCell}>
                  <div className={styles.prefLabel}>{pref.label}</div>
                  <div className={styles.prefDesc}>{pref.desc}</div>
                </td>
                <td className={styles.channelCell}>
                  <Toggle
                    checked={pref.inApp && globalInApp}
                    onChange={() => toggle(pref.id, "inApp")}
                    disabled={!globalInApp}
                  />
                </td>
                <td className={styles.channelCell}>
                  <Toggle
                    checked={pref.email && globalEmail}
                    onChange={() => toggle(pref.id, "email")}
                    disabled={!globalEmail}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.note}>
        Email delivery requires SMTP to be configured in system settings.
        In-app notifications are always delivered when the app is open.
      </p>
    </div>
  );
}

function Toggle({ checked, onChange, disabled }: {
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
      className={`${styles.toggle} ${checked ? styles.toggleOn : ""} ${disabled ? styles.toggleDisabled : ""}`}
    >
      <span className={styles.toggleThumb} />
    </button>
  );
}
