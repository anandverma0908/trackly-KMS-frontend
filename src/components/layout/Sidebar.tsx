import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuthStore } from "@/features/auth/useAuthStore";
import styles from "./Sidebar.module.css";
import Tooltip from "@mui/material/Tooltip";

import {
  RiDashboardLine,
  RiBookOpenLine,
  RiTeamLine,
  RiRocketLine,
  RiCloseLine,
} from "react-icons/ri";

/* ── Main Sidebar ────────────────────────────────────────────────────────── */
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
        active={location.pathname === path}
        collapsed={collapsed}
        onClick={() => handleNavClick(path)}
      />
    );
  };

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

      {/* <div className={styles.logo}>
        <div className={styles.logoMark}>T</div>
      </div> */}

      <div className={styles.logo} onClick={() => navigate("/dashboard")}>
        <div className={styles.logoMark}>T</div>
        {!collapsed && <span className={styles.logoName}>Trackly</span>}
      </div>

      <div className={styles.body}>
        <div className={styles.navGroup}>
          {/* ── Primary nav ── */}
          {nav(<RiDashboardLine size={20} />, "Dashboard", "/dashboard")}
          {nav(<RiRocketLine size={20} />, "Spaces", "/spaces")}

          {/* {nav(
            <ConfirmationNumberIcon fontSize="small" />,
            "Tickets",
            "/tickets",
            can("view:tickets"),
          )} */}

          {/* {nav(
            <SpeedIcon fontSize="small" />,
            "Sprints",
            "/sprints",
            can("view:tickets"),
          )} */}

          {/* <div className={styles.divider} /> */}

          {nav(<RiBookOpenLine size={20} />, "Wiki", "/wiki")}
          {/* {nav(<WbSunnyIcon fontSize="small" />, "Standup", "/standup")} */}
          {/* {nav(<BarChartIcon fontSize="small" />, "Analytics", "/analytics")} */}

          {/* <div className={styles.divider} /> */}

          {nav(<RiTeamLine size={20} />, "Team", "/team", can("view:teams"))}
          {/* {nav(
            <TableChartIcon fontSize="small" />,
            "Timesheets",
            "/manual-entry",
            // can("entry:manual"),
          )} */}
          {/* {nav(
            <GridViewIcon fontSize="small" />,
            "Weekly Grid",
            "/timesheets/weekly",
            can("entry:manual"),
          )} */}
          {/* {nav(
            <FileDownloadIcon fontSize="small" />,
            "Export",
            "/export",
            can("export:all"),
          )} */}

          {/* <div className={styles.divider} /> */}

          {/* Filters — hidden when collapsed */}
          {/* {!collapsed && (
            <>
              <FilterSection
                title="Projects"
                items={allPods}
                selected={pods}
                onToggle={togglePod}
                onClear={clearPods}
                getColor={getPodColor}
                maxVisible={5}
              />
              <div className={styles.divider} />
              <FilterSection
                title="Clients"
                items={allClients}
                selected={clients}
                onToggle={toggleClient}
                onClear={clearClients}
                maxVisible={5}
              />
              <div className={styles.divider} />
            </>
          )} */}

          {/* {nav(
            <SettingsIcon fontSize="small" />,
            "Settings",
            "/settings",
            can("manage:settings"),
          )} */}
          {/* {nav(
            <AutoAwesomeIcon fontSize="small" />,
            "Burn Rate",
            "/settings/budget",
            can("manage:settings"),
          )} */}
          {/* {nav(
            <NotificationsIcon fontSize="small" />,
            "Notifications",
            "/settings/notifications",
          )} */}
        </div>

        <div className={styles.navGroupBottom}>
          {/* Settings-related items moved to the Settings page */}
        </div>
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
      style={{
        width: collapsed ? "auto" : "100%",
      }}
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
