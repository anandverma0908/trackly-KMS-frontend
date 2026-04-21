import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuthStore } from "@/features/auth/useAuthStore";
import styles from "./Sidebar.module.css";
import Tooltip from "@mui/material/Tooltip";

import {
  RiBookOpenLine,
  RiTeamLine,
  RiRocketLine,
  RiCloseLine,
  RiUser3Line,
  RiBarChartLine,
  RiSunLine,
  RiBrainLine,
  RiFocus3Line,
  RiTimeLine,
  RiFileTextLine,
  RiShieldCheckLine,
} from "react-icons/ri";

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
}

export default function Sidebar({
  open = false,
  onClose,
  collapsed = true,
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { can } = useAuthStore();

  function handleNavClick(path: string) {
    navigate(path);
    onClose?.();
  }

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const nav = (
    icon: React.ReactNode,
    label: string,
    path: string,
    guard?: boolean,
  ) => {
    if (guard === false) return null;
    return (
      <NavItem
        key={path}
        label={label}
        icon={icon}
        active={isActive(path)}
        collapsed={collapsed}
        onClick={() => handleNavClick(path)}
      />
    );
  };

  const sectionLabel = (label: string) =>
    !collapsed ? (
      <div className={styles.section}>{label}</div>
    ) : (
      <div className={styles.sectionDividerCollapsed} />
    );

  return (
    <motion.aside
      className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`}
      initial={{ width: collapsed ? 55 : 220 }}
      animate={{ width: collapsed ? 55 : 220 }}
      transition={{ type: "spring", stiffness: 320, damping: 38, mass: 0.7 }}
    >
      {/* Mobile close */}
      <button
        className={styles.mobileCloseBtn}
        onClick={onClose}
        aria-label="Close menu"
      >
        <RiCloseLine size={20} />
      </button>

      <div className={styles.logo} onClick={() => navigate("/my-work")}>
        <div className={styles.logoMark}>T</div>
        {!collapsed && <span className={styles.logoName}>Trackly</span>}
      </div>

      <div className={styles.body}>
        <div className={styles.navGroup}>

          {/* ── ME ── */}
          {sectionLabel("Me")}
          {nav(<RiUser3Line size={18} />, "My Work", "/my-work")}

          {/* ── WORK ── */}
          {sectionLabel("Work")}
          {nav(<RiRocketLine size={18} />, "Spaces", "/spaces")}
          {nav(<RiFocus3Line size={18} />, "Goals", "/goals")}

          {/* ── KNOWLEDGE ── */}
          {sectionLabel("Knowledge")}
          {nav(<RiBookOpenLine size={18} />, "Wiki", "/wiki")}
          {nav(<RiFileTextLine size={18} />, "Decisions", "/decisions")}
          {nav(<RiShieldCheckLine size={18} />, "Processes", "/processes")}

          {/* ── INTELLIGENCE ── */}
          {sectionLabel("Intelligence")}
          {nav(<RiBrainLine size={18} />, "Nova", "/nova")}
          {nav(<RiBarChartLine size={18} />, "Analytics", "/analytics")}

          {/* ── TIME ── */}
          {sectionLabel("Time")}
          {nav(<RiTimeLine size={18} />, "Timesheets", "/timesheets/weekly")}

          {/* ── PEOPLE ── */}
          {sectionLabel("People")}
          {nav(<RiTeamLine size={18} />, "Team", "/team", can("view:teams"))}
          {nav(<RiSunLine size={18} />, "Standup", "/standup")}

        </div>

        <div className={styles.navGroupBottom} />
      </div>
    </motion.aside>
  );
}

/* ── NavItem ─────────────────────────────────────────────────────────────── */
function NavItem({
  label,
  icon,
  active,
  onClick,
  collapsed,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  collapsed: boolean;
}) {
  const btn = (
    <button
      className={`${styles.item} ${active ? styles.itemActive : ""}`}
      style={{ width: collapsed ? "auto" : "100%" }}
      onClick={onClick}
    >
      <span className={styles.itemIcon}>{icon}</span>
      <motion.span
        className={styles.label}
        initial={
          collapsed
            ? { opacity: 0, display: "none", width: 0 }
            : { opacity: 1, display: "block", width: 50 }
        }
        animate={
          collapsed
            ? { opacity: 0, transitionEnd: { display: "none", width: 0 } }
            : { display: "block", opacity: 1, width: 50 }
        }
        transition={{ duration: 0.15 }}
      >
        {label}
      </motion.span>
    </button>
  );

  return (
    <Tooltip title={collapsed ? label : ""} placement="right" arrow>
      {btn}
    </Tooltip>
  );
}
