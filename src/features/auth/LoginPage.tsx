import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "./useAuthStore";
import styles from "./LoginPage.module.css";
import { MdEmail } from "react-icons/md";
import { IoMdEye, IoMdEyeOff } from "react-icons/io";
import { FaLock } from "react-icons/fa";

export default function LoginPage() {
  const navigate  = useNavigate();
  const login     = useAuthStore((s) => s.login);

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim())    { setError("Please enter your email");    return; }
    if (!password.trim()) { setError("Please enter your password"); return; }
    setError("");
    setLoading(true);
    try {
      await login({ email: email.trim().toLowerCase(), password });
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(err.message ?? "Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.root}>

      {/* ── Left — brand panel ────────────────────────────────────────────── */}
      <div className={styles.left}>
        <div className={styles.dotGrid} />
        <div className={styles.glowBlue} />
        <div className={styles.glowPurple} />

        <div className={styles.leftInner}>
          {/* Wordmark */}
          <div className={styles.wordmark}>
            <div className={styles.wordmarkIcon}>T</div>
            <span className={styles.wordmarkName}>Trackly</span>
          </div>

          {/* Hero copy */}
          <div className={styles.heroCopy}>
            <h1 className={styles.heroTitle}>
              The work OS<br />
              for engineering<br />
              <span className={styles.heroAccent}>teams.</span>
            </h1>
            <p className={styles.heroSub}>
              Plan, ship, and document everything in one place —
              with an AI that understands your codebase and your team.
            </p>
          </div>

          {/* Capability pills */}
          <div className={styles.pills}>
            {["Tickets & Sprints", "Wiki & Docs", "AI Assistant"].map((p) => (
              <span key={p} className={styles.pill}>{p}</span>
            ))}
          </div>

          {/* NOVA preview card */}
          <div className={styles.novaCard}>
            <div className={styles.novaCardHeader}>
              <div className={styles.novaIndicator} />
              <span className={styles.novaLabel}>NOVA AI</span>
              <span className={styles.novaModel}>Llama 3.1 · local</span>
            </div>
            <div className={styles.novaMsg}>
              <div className={styles.novaMsgUser}>
                "What's blocking the backend team this sprint?"
              </div>
              <div className={styles.novaMsgReply}>
                <span className={styles.novaMsgReplyDot}>✦</span>
                <span>
                  3 tickets have been in <em>In Review</em> for 4+ days with
                  no status update. Backend pod is tracking 18% below velocity
                  target — likely due to the auth refactor scope creep.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right — form panel ────────────────────────────────────────────── */}
      <div className={styles.right}>
        <div className={styles.formWrap}>

          <div className={styles.formHead}>
            <div className={styles.formTitle}>Welcome back</div>
            <div className={styles.formSub}>Sign in to your workspace</div>
          </div>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}><MdEmail /></span>
                <input
                  className={`${styles.input} ${error ? styles.inputError : ""}`}
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Password</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}><FaLock /></span>
                <input
                  className={`${styles.input} ${styles.inputPad} ${error ? styles.inputError : ""}`}
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPass((v) => !v)}
                  tabIndex={-1}
                >
                  {showPass ? <IoMdEyeOff size={16} /> : <IoMdEye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className={styles.errorMsg}>
                <span className={styles.errorIcon}>!</span>
                {error}
              </div>
            )}

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading
                ? <><span className={styles.spinner} />Signing in…</>
                : "Continue →"
              }
            </button>
          </form>

          <p className={styles.hint}>
            Don't have an account? Contact your workspace admin.
          </p>
        </div>

        <div className={styles.formFooter}>
          <span className={styles.footerMark}>T</span>
          <span className={styles.footerName}>Trackly</span>
        </div>
      </div>

    </div>
  );
}
