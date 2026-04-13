import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/features/auth/useAuthStore";
import styles from "./OnboardingModal.module.css";

const ONBOARDING_KEY = "trackly_onboarding_done";

export function isOnboardingDone(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === "true";
}

function markOnboardingDone() {
  localStorage.setItem(ONBOARDING_KEY, "true");
}

export default function OnboardingModal() {
  const [step, setStep]       = useState(0);
  const [visible, setVisible] = useState(!isOnboardingDone());
  const navigate              = useNavigate();
  const { user }              = useAuthStore();

  if (!visible) return null;

  function close() {
    markOnboardingDone();
    setVisible(false);
  }

  function next() {
    if (step < 2) {
      setStep(step + 1);
    } else {
      close();
    }
  }

  const steps = [
    {
      icon:  "🔐",
      title: `Welcome to Trackly, ${user?.name?.split(" ")[0] ?? "there"}!`,
      desc:  "Trackly is your team's AI-powered work OS — tickets, wiki, sprints, and standups all in one place, powered by NOVA AI.",
      cta:   "Let's go",
      secondary: null,
    },
    {
      icon:  "👥",
      title: "Meet your team",
      desc:  "Your engineering org is already set up with PODs, roles, and reporting lines. Visit the Team page to see your colleagues.",
      cta:   "View Team →",
      secondary: "Skip",
    },
    {
      icon:  "🎫",
      title: "Create your first ticket",
      desc:  "Try NOVA's AI ticket creation — describe an issue in plain English and NOVA will extract the title, priority, POD, client, and story points for you.",
      cta:   "Create a Ticket →",
      secondary: "Maybe later",
    },
  ];

  const current = steps[step];

  function handleCta() {
    if (step === 1) {
      navigate("/team");
      close();
    } else if (step === 2) {
      navigate("/tickets");
      close();
    } else {
      next();
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Progress dots */}
        <div className={styles.dots}>
          {steps.map((_, i) => (
            <span
              key={i}
              className={`${styles.dot} ${i === step ? styles.dotActive : ""} ${i < step ? styles.dotDone : ""}`}
            />
          ))}
        </div>

        {/* Close */}
        <button className={styles.closeBtn} onClick={close} title="Skip onboarding">✕</button>

        {/* Content */}
        <div className={styles.content}>
          <div className={styles.icon}>{current.icon}</div>
          <h2 className={styles.title}>{current.title}</h2>
          <p className={styles.desc}>{current.desc}</p>
        </div>

        {/* Step-specific extras */}
        {step === 0 && (
          <div className={styles.novaBadge}>
            <span className={styles.novaGlow} />
            <span className={styles.novaText}>✦ NOVA AI</span>
            <span className={styles.novaDesc}>Neural Orchestration &amp; Velocity Assistant — 100% local, zero external APIs</span>
          </div>
        )}

        {step === 1 && (
          <div className={styles.teamPreview}>
            {["Engineering", "DPAI", "Colgate", "Analytics", "Platform"].map((pod) => (
              <span key={pod} className={styles.podChip}>{pod}</span>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className={styles.novaExample}>
            <div className={styles.exampleLabel}>Try saying:</div>
            <div className={styles.exampleText}>
              "Fix login timeout in DPAI portal — affects Colgate, high priority, ~3 story points, assign to Riya"
            </div>
          </div>
        )}

        {/* Actions */}
        <div className={styles.actions}>
          {current.secondary && (
            <button className="btn btn-ghost" onClick={next}>
              {current.secondary}
            </button>
          )}
          <button className="btn btn-primary" onClick={handleCta}>
            {current.cta}
          </button>
        </div>

        {/* Step counter */}
        <div className={styles.stepCount}>Step {step + 1} of {steps.length}</div>
      </div>
    </div>
  );
}
