import toast from "react-hot-toast";
import { useThemeStore } from "@/store";
import { THEMES } from "@/config/themes";
import styles from "./SettingsPage.module.css";

export default function SettingsPage() {
  const { themeId, colorMode, setTheme, toggleMode } = useThemeStore();

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>Manage your app preferences</p>
      </div>

      <div className={styles.layout}>
        <div className={styles.main}>
          {/* ── Appearance ── */}
          <div className="card">
            <div className={styles.cardHeader}>
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
                    ["dark",  "🌙 Dark"],
                    ["light", "☀️ Light"],
                  ] as const
                ).map(([m, l]) => (
                  <button
                    key={m}
                    onClick={() => { if (colorMode !== m) toggleMode(); }}
                    className={`${styles.themePill} ${colorMode === m ? styles.themePillActive : ""}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div className="card" style={{ padding: 20, alignSelf: "start" }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>
            Appearance
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: "var(--text-2)",
              lineHeight: 1.6,
            }}
          >
            Customise your accent colour and switch between light and dark
            mode. These preferences are saved locally to your browser.
          </p>
        </div>
      </div>
    </div>
  );
}
