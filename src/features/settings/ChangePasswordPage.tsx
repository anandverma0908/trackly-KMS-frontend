import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore, getAuthHeader } from "@/features/auth/model/useAuthStore";
import toast from "react-hot-toast";
import styles from "./ChangePasswordPage.module.scss";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function ChangePasswordPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
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

  return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate(-1)}>
        ← Back
      </button>
      <div className={styles.card}>
        {/* Avatar */}
        <div className={styles.avatar}>
          {user?.name
            ?.split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </div>

        <div className={styles.name}>{user?.name}</div>
        <div className={styles.meta}>
          {user?.email} ·{" "}
          <span className={styles.role}>{user?.role?.replace("_", " ")}</span>
        </div>

        {done && (
          <div className={styles.successBanner}>
            ✓ Password changed successfully
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Current Password</label>
            <input
              className={styles.input}
              type="password"
              placeholder="Your current password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>New Password</label>
            <input
              className={styles.input}
              type="password"
              placeholder="Min 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            {password.length > 0 && (
              <div className={styles.strengthWrap}>
                <div className={styles.strengthBars}>
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={styles.strengthBar}
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
                  className={styles.strengthLabel}
                  style={{ color: strengthColor[strength] }}
                >
                  {strengthLabel[strength]}
                </span>
              </div>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Confirm New Password</label>
            <input
              className={styles.input}
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
              <span className={styles.errorHint}>Passwords don't match</span>
            )}
          </div>

          <button
            type="submit"
            className={styles.btn}
            disabled={loading || !password || !confirm}
          >
            {loading ? "Updating…" : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
