import { useNavigate } from "react-router-dom";
import styles from "./QuickActions.module.css";
import { MdAddCircleOutline, MdTimer, MdMenuBook, MdAutoAwesome } from "react-icons/md";

interface Action {
  icon: React.ReactNode;
  label: string;
  color: string;
  glow: string;
  onClick: () => void;
}

interface QuickActionsProps {
  onAskNova?: () => void;
}

export default function QuickActions({ onAskNova }: QuickActionsProps) {
  const navigate = useNavigate();

  const actions: Action[] = [
    {
      icon:    <MdAddCircleOutline />,
      label:   "Create Ticket",
      color:   "var(--accent)",
      glow:    "var(--accent-glow)",
      onClick: () => navigate("/tickets?new=1"),
    },
    {
      icon:    <MdTimer />,
      label:   "Log Time",
      color:   "var(--green)",
      glow:    "var(--green-glow)",
      onClick: () => navigate("/manual-entry"),
    },
    {
      icon:    <MdMenuBook />,
      label:   "New Wiki Page",
      color:   "var(--purple)",
      glow:    "var(--purple-glow)",
      onClick: () => navigate("/wiki?new=1"),
    },
    {
      icon:    <MdAutoAwesome />,
      label:   "Ask EOS",
      color:   "var(--cyan)",
      glow:    "var(--cyan-glow)",
      onClick: onAskNova ?? (() => {
        // Focus the global search bar (Topbar) via keyboard event
        const evt = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
        document.dispatchEvent(evt);
      }),
    },
  ];

  return (
    <div className={styles.bar}>
      {actions.map((action) => (
        <button
          key={action.label}
          className={styles.action}
          style={{ "--ac": action.color, "--ag": action.glow } as React.CSSProperties}
          onClick={action.onClick}
        >
          <span className={styles.actionIcon}>{action.icon}</span>
          <span className={styles.actionLabel}>{action.label}</span>
        </button>
      ))}
    </div>
  );
}
