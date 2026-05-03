import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "./useAuthStore";
import styles from "./LoginPage.module.css";
import { MdArrowForward } from "react-icons/md";
import { IoMdEye, IoMdEyeOff } from "react-icons/io";
import { FaLock } from "react-icons/fa";
import { GoNorthStar } from "react-icons/go";

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [_remember, _setRemember] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email");
      return;
    }
    if (!password.trim()) {
      setError("Please enter your password");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login({ email: email.trim().toLowerCase(), password });
      navigate("/my-work", { replace: true });
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
            <div className={styles.logo}>
              <div className={styles.logoMark}>T</div>
              <span className={styles.logoName}>Trackly</span>
            </div>

            {/* Hero */}
            <div className={styles.hero}>
              <h1 className={styles.heroTitle}>
                The Work OS for
                <br />
                modern
                <span className={styles.heroAccent}>teams.</span>
              </h1>
              <p className={styles.heroSub}>
                A unified workspace built to help modern teams stay aligned and move faster.
              </p>
            </div>

            {/* Pills */}
            <div className={styles.pills}>
              {["Focused", "Connected", "Efficient"].map((p) => (
                <span key={p} className={styles.pill}>
                  {p}
                </span>
              ))}
            </div>

            {/* Showcase cards */}
            <div className={styles.showcase}>
              {/* Large EOS preview card */}
              <div className={styles.novaCard}>
                <div className={styles.novaVisual}>
                  <div className={styles.novaHalo} />
                  <div className={styles.novaMesh} />
                  <div className={styles.novaPulse} />
                  <div className={styles.novaGlyph}>
                    <GoNorthStar />
                  </div>
                  <div className={styles.novaFrame} />
                  <div className={styles.novaNodes} />
                  <div className={styles.novaParticle} />
                  <div className={styles.novaParticle2} />
                </div>
                <div className={styles.novaContent}>
                  <div className={styles.novaLabel}>TRACKLY WORKSPACE</div>
                  <h3 className={styles.novaTitle}>
                    Built for teams that move fast and stay aligned.
                  </h3>
                  <div className={styles.novaChat}>
                    <div className={styles.novaUser}>"Where does the team stand today?"</div>
                    <div className={styles.novaReply}>
                      Get a clear view of progress, priorities, and the work that needs attention.
                    </div>
                  </div>
                </div>
              </div>

              {/* Stacked feature cards */}
              <div className={styles.featuresStack}>
                <div className={styles.featureCard}>
                  <div className={styles.featureIcon} />
                  <div className={styles.featureTitle}>Clear Visibility</div>
                  <div className={styles.featureDesc}>
                    See what matters most and keep work on track.
                  </div>
                </div>
                <div className={styles.featureCard}>
                  <div className={styles.featureIcon} />
                  <div className={styles.featureTitle}>Better Flow</div>
                  <div className={styles.featureDesc}>
                    Bring planning, execution, and collaboration together.
                  </div>
                </div>
                <div className={styles.featureCard}>
                  <div className={styles.featureIcon} />
                  <div className={styles.featureTitle}>Shared Context</div>
                  <div className={styles.featureDesc}>
                    Keep teams aligned with one source of truth.
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.insightRail}>
              <div className={styles.insightCard}>
                <span className={styles.insightLabel}>Always On</span>
                <strong className={styles.insightValue}>Live visibility</strong>
              </div>
              <div className={styles.insightCard}>
                <span className={styles.insightLabel}>AI Layer</span>
                <strong className={styles.insightValue}>Smarter decisions</strong>
              </div>
              <div className={styles.insightCard}>
                <span className={styles.insightLabel}>Enterprise Ready</span>
                <strong className={styles.insightValue}>Secure by design</strong>
              </div>
            </div>
          </div>

          <div className={styles.footer}>© 2026 Trackly · Protected by enterprise-grade security</div>
        </div>

        {/* ── Right — glass form ── */}
        <div className={styles.right}>
          <div className={styles.glassCard}>
            {/* Card header */}
            {/* <div className={styles.cardHeader}>
              <div className={styles.badgeRow}>
                <div className={styles.orangeBadge}>T</div>
                <div className={styles.badgeText}>
                  <div className={styles.badgeTitle}>Trackly</div>
                  <div className={styles.badgeSub}>MODERN TEAMS</div>
                </div>
              </div>
              <div className={styles.secureLabel}>SECURE<br/>SIGN-IN</div>
            </div> */}

            <div className={styles.launchLabel}>SIGN IN TO Trackly</div>

            <div className={styles.formHead}>
              <h2 className={styles.formTitle}>Welcome back</h2>
              <p className={styles.formSub}>
                Sign in to continue to your workspace.
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
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>

              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label className={styles.label}>PASSWORD</label>
                </div>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIconLeft}>
                    <FaLock size={14} />
                  </span>
                  <input
                    className={`${styles.input} ${styles.inputPad} ${error ? styles.inputError : ""}`}
                    type={showPass ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShowPass((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPass ? (
                      <IoMdEyeOff size={16} />
                    ) : (
                      <IoMdEye size={16} />
                    )}
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
                {/* <label className={styles.remember}>
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
                </label> */}
                <div className={styles.orbitLock}>
                  <span className={styles.orbitDot} />
                  <span>SECURE ACCESS</span>
                </div>
              </div>

              <button
                type="submit"
                className={styles.submitBtn}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className={styles.spinner} />
                    Signing in…
                  </>
                ) : (
                  <>
                    <span>Sign in</span>
                    <MdArrowForward size={18} />
                  </>
                )}
              </button>
            </form>

            <p className={styles.hint}>
              Having trouble?{" "}
              <button type="button" className={styles.adminLink}>
                Contact your administrator.
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
