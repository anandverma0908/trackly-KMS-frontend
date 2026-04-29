import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/useAuthStore";
import { useFilterStore } from "@/features/filters/useFilterStore";
import {
  fetchPodSummary,
  fetchOrgMembers,
  fetchSavedFilters,
} from "@/services/api";
import { getPodColor } from "@/config/themes";
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
  RiArrowRightSLine,
  RiBugLine,
  RiFilter3Line,
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
  const { user } = useAuthStore();
  const [spacesOpen, setSpacesOpen] = useState(true);

  const { data: pods = [] } = useQuery({
    queryKey: ["pod-summary"],
    queryFn: fetchPodSummary,
    staleTime: 1000 * 60 * 2,
  });

  const isManagerRole =
    user?.role === "admin" ||
    user?.role === "engineering_manager" ||
    user?.role === "tech_lead";

  // Only fetch org members for non-managers to check if they have direct reports
  const { data: orgMembersRaw } = useQuery({
    queryKey: ["org-members"],
    queryFn: fetchOrgMembers,
    staleTime: 5 * 60 * 1000,
    enabled: !isManagerRole && !!user,
  });

  const orgMembers = Array.isArray(orgMembersRaw) ? orgMembersRaw : [];
  const myProfile = orgMembers.find(
    (m: { email: string }) => m.email === user?.email,
  );

  // reporting_to could be emp_no, id, email, or name depending on backend
  const myIds = myProfile
    ? [myProfile.emp_no, myProfile.id, myProfile.email, myProfile.name].filter(
        Boolean,
      )
    : [];
  const hasDirectReports =
    myIds.length > 0
      ? orgMembers.some(
          (m: { reporting_to: string | null }) =>
            m.reporting_to && myIds.includes(m.reporting_to),
        )
      : false;
  const showTeamNav = isManagerRole || hasDirectReports;

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

  const isInSpace = location.pathname.startsWith("/spaces/");
  const activePod = isInSpace ? location.pathname.split("/")[2] : null;

  return (
    <motion.aside
      className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`}
      initial={{ width: collapsed ? 55 : 180 }}
      animate={{ width: collapsed ? 55 : 180 }}
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

          {/* Spaces — expandable */}
          {collapsed ? (
            <Tooltip title="Spaces" placement="right" arrow>
              <button
                className={`${styles.item} ${isActive("/spaces") ? styles.itemActive : ""}`}
                style={{ width: "auto" }}
                onClick={() => handleNavClick("/spaces")}
              >
                <span className={styles.itemIcon}>
                  <RiRocketLine size={18} />
                </span>
              </button>
            </Tooltip>
          ) : (
            <div className={styles.spacesGroup}>
              {/* Spaces header row */}
              <div className={styles.spacesRow}>
                <button
                  className={`${styles.spacesMain} ${isActive("/spaces") && !isInSpace ? styles.itemActive : ""}`}
                  onClick={() => handleNavClick("/spaces")}
                >
                  <span className={styles.itemIcon}>
                    <RiRocketLine size={18} />
                  </span>
                  <span className={styles.label}>Spaces</span>
                </button>
                {pods.length > 0 && (
                  <button
                    className={styles.spacesChevron}
                    onClick={() => setSpacesOpen((v) => !v)}
                    title={spacesOpen ? "Collapse" : "Expand"}
                  >
                    <RiArrowRightSLine
                      size={15}
                      style={{
                        transform: spacesOpen
                          ? "rotate(90deg)"
                          : "rotate(0deg)",
                        transition: "transform 0.18s",
                        color: "var(--text-3)",
                      }}
                    />
                  </button>
                )}
              </div>

              {/* Space sub-items */}
              <AnimatePresence initial={false}>
                {spacesOpen && pods.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    style={{ overflow: "hidden" }}
                  >
                    <div className={styles.spacesList}>
                      {pods.map((p) => {
                        const color = getPodColor(p.pod);
                        const active = activePod === p.pod;
                        return (
                          <button
                            key={p.pod}
                            className={`${styles.spaceItem} ${active ? styles.spaceItemActive : ""}`}
                            style={active ? { color } : {}}
                            onClick={() => handleNavClick(`/spaces/${p.pod}`)}
                          >
                            <span
                              className={styles.spaceDot}
                              style={{ background: color }}
                            />
                            <span className={styles.spaceLabel}>{p.pod}</span>
                            {p.has_active_sprint && (
                              <span className={styles.sprintDot} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ── SAVED FILTERS ── */}
          <SavedFiltersSection collapsed={collapsed} />

          {/* ── KNOWLEDGE ── */}
          {sectionLabel("Knowledge")}
          {nav(<RiBookOpenLine size={18} />, "Wiki", "/wiki")}
          {nav(<RiFocus3Line size={18} />, "Goals", "/goals")}

          {/* ── INTELLIGENCE ── */}
          {sectionLabel("Intelligence")}
          {nav(<RiBrainLine size={18} />, "EOS", "/eos")}
          {nav(<RiBugLine size={18} />, "Code Review", "/code-review")}
          {nav(<RiBarChartLine size={18} />, "Analytics", "/analytics")}

          {/* ── TIME ── */}
          {sectionLabel("Time")}
          {nav(<RiTimeLine size={18} />, "Timesheets", "/timesheets")}

          {/* ── PEOPLE ── */}
          {sectionLabel("People")}
          {nav(<RiTeamLine size={18} />, "My Team", "/team", showTeamNav)}
          {nav(<RiSunLine size={18} />, "Standup", "/standup")}
        </div>

        <div className={styles.navGroupBottom} />
      </div>
    </motion.aside>
  );
}

/* ── Saved Filters Section ───────────────────────────────────────────────── */
function SavedFiltersSection({ collapsed }: { collapsed: boolean }) {
  const { data: filters = [] } = useQuery({
    queryKey: ["saved-filters"],
    queryFn: fetchSavedFilters,
    staleTime: 1000 * 60 * 2,
  });

  const setActiveFilter = useFilterStore((s) => s.setActiveFilter);

  if (filters.length === 0) return null;

  return (
    <>
      {!collapsed && <div className={styles.section}>Saved Filters</div>}
      {collapsed && <div className={styles.sectionDividerCollapsed} />}
      {filters.map((f) => (
        <Tooltip
          key={f.id}
          title={collapsed ? f.name : ""}
          placement="right"
          arrow
        >
          <button
            className={styles.item}
            style={{ width: collapsed ? "auto" : "100%" }}
            onClick={() => setActiveFilter(f.filters)}
          >
            <span className={styles.itemIcon}>
              <RiFilter3Line size={16} />
            </span>
            {!collapsed && <span className={styles.label}>{f.name}</span>}
          </button>
        </Tooltip>
      ))}
    </>
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
