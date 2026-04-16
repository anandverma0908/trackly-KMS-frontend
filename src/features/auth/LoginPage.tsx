import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "./useAuthStore";
import styles from "./LoginPage.module.css";
import { MdArrowForward } from "react-icons/md";
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
  const [remember, setRemember] = useState(false);

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
      {/* AI ambient background */}
      <div className={styles.gridBg} />
      <div className={styles.glowTop} />
      <div className={styles.glowBottom} />
      <div className={styles.nodes}>
        <span className={`${styles.node} ${styles.node1}`} />
        <span className={`${styles.node} ${styles.node2}`} />
        <span className={`${styles.node} ${styles.node3}`} />
        <span className={`${styles.node} ${styles.node4}`} />
        <span className={`${styles.node} ${styles.node5}`} />
        <span className={`${styles.node} ${styles.node6}`} />
      </div>

      <div className={styles.container}>
        {/* ── Left — AI brand panel ── */}
        <div className={styles.left}>
          <div className={styles.leftInner}>
            {/* Brand */}
            <div className={styles.brand}>
              <span className={styles.brandDot} />
              <span className={styles.brandName}>TRACKLY</span>
            </div>

            {/* Hero */}
            <div className={styles.hero}>
              <h1 className={styles.heroTitle}>
                Intelligence for<br />engineering<br /><span className={styles.heroAccent}>velocity.</span>
              </h1>
              <p className={styles.heroSub}>
                Trackly is your AI-powered command centre. Plan sprints, document
                decisions, and let EOS reason across your codebase, tickets, and
                team velocity — all in one place.
              </p>
            </div>

            {/* Pills */}
            <div className={styles.pills}>
              {["EOS AI", "Code-aware context", "Predictive insights"].map((p) => (
                <span key={p} className={styles.pill}>{p}</span>
              ))}
            </div>

            {/* Showcase cards */}
            <div className={styles.showcase}>
              {/* Large EOS preview card */}
              <div className={styles.novaCard}>
                <div className={styles.novaVisual}>
                  <div className={styles.novaCore} />
                  <div className={styles.novaFrame} />
                  <div className={styles.novaNodes} />
                  <div className={styles.novaParticle} />
                  <div className={styles.novaParticle2} />
                </div>
                <div className={styles.novaContent}>
                  <div className={styles.novaLabel}>EOS AI · LOCAL LLM</div>
                  <h3 className={styles.novaTitle}>
                    Ask anything. Get answers rooted in your actual work.
                  </h3>
                  <div className={styles.novaChat}>
                    <div className={styles.novaUser}>
                      "Why did backend velocity drop 18% this sprint?"
                    </div>
                    <div className={styles.novaReply}>
                      3 tickets have been in <em>In Review</em> for 4+ days. The
                      auth refactor introduced scope creep, and 2 engineers were
                      pulled into an unplanned hotfix.
                    </div>
                  </div>
                </div>
              </div>

              {/* Stacked feature cards */}
              <div className={styles.featuresStack}>
                <div className={styles.featureCard}>
                  <div className={styles.featureIcon} />
                  <div className={styles.featureTitle}>Neural Search</div>
                  <div className={styles.featureDesc}>Find tickets, docs, and code context with natural language.</div>
                </div>
                <div className={styles.featureCard}>
                  <div className={styles.featureIcon} />
                  <div className={styles.featureTitle}>Smart Sprints</div>
                  <div className={styles.featureDesc}>AI-suggested capacity, risk flags, and blockers before standup.</div>
                </div>
                <div className={styles.featureCard}>
                  <div className={styles.featureIcon} />
                  <div className={styles.featureTitle}>Auto Docs</div>
                  <div className={styles.featureDesc}>Generate runbooks, ADRs, and retros from your project data.</div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.footer}>
            POWERED BY EOS · BUILT FOR ENGINEERING TEAMS
          </div>
        </div>

        {/* ── Right — glass form ── */}
        <div className={styles.right}>
          <div className={styles.glassCard}>
            {/* Card header */}
            <div className={styles.cardHeader}>
              <div className={styles.badgeRow}>
                <div className={styles.orangeBadge}>T</div>
                <div className={styles.badgeText}>
                  <div className={styles.badgeTitle}>Trackly</div>
                  <div className={styles.badgeSub}>WORK OS</div>
                </div>
              </div>
              <div className={styles.secureLabel}>SECURE<br/>SIGN-IN</div>
            </div>

            <div className={styles.launchLabel}>LAUNCH SEQUENCE</div>

            <div className={styles.formHead}>
              <h2 className={styles.formTitle}>Welcome back</h2>
              <p className={styles.formSub}>
                Sign in to continue your orbit through tasks, sprints, and AI insights.
              </p>
            </div>

            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              <div className={styles.field}>
                <label className={styles.label}>EMAIL ADDRESS</label>
                <div className={styles.inputWrap}>
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
                <div className={styles.labelRow}>
                  <label className={styles.label}>PASSWORD</label>
                  <button type="button" className={styles.forgotLink} onClick={() => {}}>
                    FORGOT PASSWORD?
                  </button>
                </div>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIconLeft}><FaLock size={14} /></span>
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

              <div className={styles.optionsRow}>
                <label className={styles.remember}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  <span className={styles.checkDot} />
                  <span className={styles.rememberText}>
                    <span className={styles.rememberTitle}>Remember me</span>
                    <span className={styles.rememberSub}>Keep this device signed in for 30 days</span>
                  </span>
                </label>
                <div className={styles.orbitLock}>
                  <span className={styles.orbitDot} />
                  <span>ORBIT<br/>LOCKED</span>
                </div>
              </div>

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading
                  ? <><span className={styles.spinner} />Signing in…</>
                  : <><span>Sign in</span><MdArrowForward size={18} /></>
                }
              </button>
            </form>

            <p className={styles.hint}>
              Having trouble? <button type="button" className={styles.adminLink}>Contact your administrator.</button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
