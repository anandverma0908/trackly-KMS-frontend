import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/useAuthStore";
import { useFilterStore } from "@/store";
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
  RiFileTextLine,
  RiListCheck2,
  RiHistoryLine,
  RiCalendarLine,
  RiChat3Line,
  RiSurveyLine,
  RiGlobalLine,
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
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useAuthStore();
  const [spacesOpen, setSpacesOpen] = useState(true);

  const role = user?.role ?? null;

  // Role booleans
  const isAdmin     = role === "admin";
  const isManager   = role === "admin" || role === "engineering_manager";
  const isLead      = role === "admin" || role === "engineering_manager" || role === "tech_lead";
  const isFinance   = role === "finance_viewer";
  const isWorker    = !isFinance; // everyone except finance sees most of the app

  const { data: pods = [] } = useQuery({
    queryKey: ["pod-summary"],
    queryFn: fetchPodSummary,
    staleTime: 1000 * 60 * 2,
  });

  // Determine if this user has direct reports (for "My Team" visibility)
  const { data: orgMembersRaw } = useQuery({
    queryKey: ["org-members"],
    queryFn: fetchOrgMembers,
    staleTime: 5 * 60 * 1000,
    enabled: !isManager && !!user,
  });
  const orgMembers = Array.isArray(orgMembersRaw) ? orgMembersRaw : [];
  const myProfile  = orgMembers.find((m: { email: string }) => m.email === user?.email);
  const myIds      = myProfile
    ? [myProfile.emp_no, myProfile.id, myProfile.email, myProfile.name].filter(Boolean)
    : [];
  const hasDirectReports = myIds.length > 0
    ? orgMembers.some((m: { reporting_to: string | null }) => m.reporting_to && myIds.includes(m.reporting_to))
    : false;
  const showTeamNav = isManager || hasDirectReports;

  function handleNavClick(path: string, state?: Record<string, unknown>) {
    navigate(path, state ? { state } : undefined);
    onClose?.();
  }

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  // nav() renders a NavItem only when the guard is true (omit guard = always shown)
  const nav = (
    icon: React.ReactNode,
    label: string,
    path: string,
    guard: boolean = true,
  ) => {
    if (!guard) return null;
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

  // Parse comma-separated pod string into an array (users can belong to multiple pods)
  const userPods = user?.pod
    ? user.pod.split(",").map((p) => p.trim()).filter(Boolean)
    : [];

  // Managers see all pods; others see only their own pod(s)
  const visiblePods = isManager
    ? pods
    : pods.filter((p) => userPods.length === 0 || userPods.includes(p.pod));

  return (
    <motion.aside
      className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`}
      initial={{ width: collapsed ? 55 : 180 }}
      animate={{ width: collapsed ? 55 : 180 }}
      transition={{ type: "spring", stiffness: 320, damping: 38, mass: 0.7 }}
    >
      {/* Mobile close */}
      <button className={styles.mobileCloseBtn} onClick={onClose} aria-label="Close menu">
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
          {nav(<RiUser3Line  size={18} />, "My Work",       "/my-work")}
          {nav(<RiSunLine    size={18} />, "Standup",       "/standup",      isWorker)}
          {nav(<RiCalendarLine size={18} />, "Calendar",    "/calendar",     isWorker)}
          {nav(<RiTimeLine   size={18} />, "Time Tracking", "/timesheets",   isWorker)}

          {/* ── WORK ── */}
          {isWorker && sectionLabel("Work")}
          {isWorker && (
            collapsed ? (
              <Tooltip title="Spaces" placement="right" arrow>
                <button
                  className={`${styles.item} ${isActive("/spaces") ? styles.itemActive : ""}`}
                  style={{ width: "auto" }}
                  onClick={() => handleNavClick("/spaces")}
                >
                  <span className={styles.itemIcon}><RiRocketLine size={18} /></span>
                </button>
              </Tooltip>
            ) : (
              <div className={styles.spacesGroup}>
                <div className={styles.spacesRow}>
                  <button
                    className={`${styles.spacesMain} ${isActive("/spaces") && !isInSpace ? styles.itemActive : ""}`}
                    onClick={() => handleNavClick("/spaces")}
                  >
                    <span className={styles.itemIcon}><RiRocketLine size={18} /></span>
                    <span className={styles.label}>Spaces</span>
                  </button>
                  {visiblePods.length > 0 && (
                    <button
                      className={styles.spacesChevron}
                      onClick={() => setSpacesOpen((v) => !v)}
                      title={spacesOpen ? "Collapse" : "Expand"}
                    >
                      <RiArrowRightSLine
                        size={15}
                        style={{
                          transform: spacesOpen ? "rotate(90deg)" : "rotate(0deg)",
                          transition: "transform 0.18s",
                          color: "var(--text-3)",
                        }}
                      />
                    </button>
                  )}
                </div>
                <AnimatePresence initial={false}>
                  {spacesOpen && visiblePods.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18 }}
                      style={{ overflow: "hidden" }}
                    >
                      <div className={styles.spacesList}>
                        {visiblePods.map((p) => {
                          const color  = getPodColor(p.pod);
                          const active = activePod === p.pod;
                          return (
                            <button
                              key={p.pod}
                              className={`${styles.spaceItem} ${active ? styles.spaceItemActive : ""}`}
                              style={active ? { color } : {}}
                              onClick={() => handleNavClick(`/spaces/${p.pod}`, { tab: "board" })}
                            >
                              <span className={styles.spaceDot} style={{ background: color }} />
                              <span className={styles.spaceLabel}>{p.pod}</span>
                              {p.has_active_sprint && <span className={styles.sprintDot} />}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          )}

          {/* ── SAVED FILTERS ── */}
          {isWorker && <SavedFiltersSection collapsed={collapsed} />}

          {/* ── KNOWLEDGE ── */}
          {isWorker && sectionLabel("Knowledge")}
          {nav(<RiBookOpenLine size={18} />, "Wiki",       "/wiki",       isWorker)}
          {nav(<RiFileTextLine size={18} />, "Decisions",  "/decisions",  isWorker)}
          {nav(<RiFocus3Line   size={18} />, "Goals",      "/goals",      isWorker)}
          {nav(<RiListCheck2   size={18} />, "Processes",  "/processes",  isWorker)}

          {/* ── INTELLIGENCE ── */}
          {(isLead || isFinance || isWorker) && sectionLabel("Intelligence")}
          {nav(<RiBrainLine    size={18} />, "EOS",          "/eos",          isWorker)}
          {nav(<RiBugLine      size={18} />, "Code Review",  "/code-review",  isLead)}
          {nav(<RiBarChartLine size={18} />, "Analytics",    "/analytics",    isManager || isFinance)}

          {/* ── PEOPLE ── */}
          {(showTeamNav || isWorker) && sectionLabel("People")}
          {nav(<RiTeamLine  size={18} />, "My Team",    "/team",  showTeamNav)}
          {nav(<RiChat3Line size={18} />, "Team Chat",  "/chat",  isWorker)}

          {/* ── TOOLS ── */}
          {isManager && sectionLabel("Tools")}
          {nav(<RiSurveyLine  size={18} />, "Forms",        "/forms",       isManager)}
          {nav(<RiGlobalLine  size={18} />, "Guest Portal", "/guest",       isManager)}
          {nav(<RiHistoryLine size={18} />, "Audit Log",    "/audit-log",   isAdmin)}

        </div>
        <div className={styles.navGroupBottom} />
      </div>
    </motion.aside>
  );
}

/* ── Saved Filters Section ───────────────────────────────────────────────── */
function SavedFiltersSection({ collapsed }: { collapsed: boolean }) {
  const navigate    = useNavigate();
  const { data: filters = [] } = useQuery({
    queryKey: ["saved-filters"],
    queryFn: fetchSavedFilters,
    staleTime: 1000 * 60 * 2,
  });
  const store = useFilterStore();

  if (filters.length === 0) return null;

  function handleFilterClick(f: { id: string; name: string; filters: any }) {
    const saved = f.filters ?? {};
    store.resetFilters();
    if (saved.dateFrom && saved.dateTo) store.setDateRange(saved.dateFrom, saved.dateTo);
    if (saved.user)      store.setFilter("user",      saved.user);
    if (saved.project)   store.setFilter("project",   saved.project);
    if (saved.issueType) store.setFilter("issueType", saved.issueType);
    if (saved.search)    store.setFilter("search",    saved.search);
    (saved.pods ?? []).forEach((p: string) => store.togglePod(p));
    (saved.clients ?? []).forEach((c: string) => store.toggleClient(c));
    navigate("/tickets");
  }

  return (
    <>
      {!collapsed && <div className={styles.section}>Filters</div>}
      {collapsed && <div className={styles.sectionDividerCollapsed} />}
      {filters.map((f: { id: string; name: string; filters: any }) => (
        <Tooltip key={f.id} title={collapsed ? f.name : ""} placement="right" arrow>
          <button
            className={styles.item}
            style={{ width: collapsed ? "auto" : "100%" }}
            onClick={() => handleFilterClick(f)}
          >
            <span className={styles.itemIcon}><RiFilter3Line size={16} /></span>
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
        initial={collapsed ? { opacity: 0, display: "none", width: 0 } : { opacity: 1, display: "block", width: 50 }}
        animate={collapsed ? { opacity: 0, transitionEnd: { display: "none", width: 0 } } : { display: "block", opacity: 1, width: 50 }}
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
