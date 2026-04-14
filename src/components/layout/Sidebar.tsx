import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useFilterStore } from "@/store";
import { fetchFilters } from "@/services/api";
import { QUERY_KEYS } from "@/config/queryKeys";
import { getPodColor } from "@/config/themes";
import { useAuthStore } from "@/features/auth/useAuthStore";
import styles from "./Sidebar.module.css";
import Tooltip from "@mui/material/Tooltip";

/* MUI Icons */
import DashboardIcon from "@mui/icons-material/Dashboard";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import ViewKanbanIcon from "@mui/icons-material/ViewKanban";
import SpeedIcon from "@mui/icons-material/Speed";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import BarChartIcon from "@mui/icons-material/BarChart";
import GroupsIcon from "@mui/icons-material/Groups";
import TableChartIcon from "@mui/icons-material/TableChart";
import GridViewIcon from "@mui/icons-material/GridView";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import SettingsIcon from "@mui/icons-material/Settings";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import NotificationsIcon from "@mui/icons-material/Notifications";
import LockIcon from "@mui/icons-material/Lock";
import PeopleIcon from "@mui/icons-material/People";
import CloseIcon from "@mui/icons-material/Close";

/* ── Multi-select filter section ─────────────────────────────────────────── */
interface FilterSectionProps {
  title: string;
  items: string[];
  selected: string[];
  onToggle: (item: string) => void;
  onClear: () => void;
  getColor?: (item: string) => string;
  maxVisible?: number;
}

function FilterSection({
  title,
  items,
  selected,
  onToggle,
  onClear,
  getColor,
  maxVisible = 5,
}: FilterSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = items.filter((i) =>
    i.toLowerCase().includes(search.toLowerCase()),
  );
  const visible = showAll ? filtered : filtered.slice(0, maxVisible);
  const hasMore = filtered.length > maxVisible && !showAll;
  const count = selected.length;

  useEffect(() => {
    if (showAll) searchRef.current?.focus();
  }, [showAll]);

  return (
    <div className={styles.filterSection}>
      <div className={styles.sectionRow}>
        <button
          className={styles.sectionToggle}
          onClick={() => setExpanded((v) => !v)}
        >
          <span
            className={styles.sectionArrow}
            style={{ transform: expanded ? "rotate(90deg)" : "none" }}
          >
            ›
          </span>
          <span className={styles.sectionLabel}>{title}</span>
        </button>
        {count > 0 && (
          <div className={styles.sectionRight}>
            <span className={styles.filterBadge}>{count}</span>
            <button
              className={styles.clearBtn}
              onClick={onClear}
              title={`Clear ${title}`}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <div className={styles.filterBody}>
          {(showAll || items.length > 8) && (
            <div className={styles.filterSearchWrap}>
              <input
                ref={searchRef}
                className={styles.filterInput}
                placeholder={`Search ${title.toLowerCase()}…`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}

          <div className={styles.checkList}>
            {visible.map((item) => {
              const isActive = selected.includes(item);
              const color = getColor?.(item);
              return (
                <button
                  key={item}
                  className={`${styles.checkItem} ${isActive ? styles.checkItemActive : ""}`}
                  onClick={() => onToggle(item)}
                >
                  <span
                    className={styles.checkbox}
                    style={
                      isActive && color
                        ? { background: color, borderColor: color }
                        : isActive
                          ? {
                              background: "var(--accent)",
                              borderColor: "var(--accent)",
                            }
                          : {}
                    }
                  >
                    {isActive && <span className={styles.checkmark}>✓</span>}
                  </span>
                  {color && (
                    <span
                      className={styles.colorDot}
                      style={{ background: color }}
                    />
                  )}
                  <span className={styles.checkLabel}>{item}</span>
                </button>
              );
            })}
            {visible.length === 0 && (
              <div className={styles.noResults}>
                No {title.toLowerCase()} found
              </div>
            )}
          </div>

          {hasMore && (
            <button
              className={styles.showMoreBtn}
              onClick={() => setShowAll(true)}
            >
              + {filtered.length - maxVisible} more {title.toLowerCase()}
            </button>
          )}
          {showAll && filtered.length > maxVisible && (
            <button
              className={styles.showMoreBtn}
              onClick={() => {
                setShowAll(false);
                setSearch("");
              }}
            >
              ↑ Show less
            </button>
          )}

          {count > 0 && (
            <div className={styles.chipStrip}>
              {selected.map((item) => {
                const color = getColor?.(item);
                return (
                  <span
                    key={item}
                    className={styles.chip}
                    style={
                      color
                        ? {
                            borderColor: color,
                            color,
                            background: `${color}18`,
                          }
                        : {}
                    }
                  >
                    {item}
                    <button
                      className={styles.chipRemove}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggle(item);
                      }}
                    >
                      ✕
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
  const { pods, clients, togglePod, toggleClient, clearPods, clearClients } =
    useFilterStore();
  const { can } = useAuthStore();

  const { data: filters } = useQuery({
    queryKey: QUERY_KEYS.filters(),
    queryFn: fetchFilters,
    staleTime: 1000 * 60 * 10,
  });

  const allPods = filters?.pods ?? [];
  const allClients = filters?.clients ?? [];

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
      initial={{ width: collapsed ? 64 : 228 }}
      animate={{ width: collapsed ? 64 : 228 }}
      transition={{ type: "spring", stiffness: 320, damping: 38, mass: 0.7 }}
    >
      {/* Mobile close */}
      <button
        className={styles.mobileCloseBtn}
        onClick={onClose}
        aria-label="Close menu"
      >
        <CloseIcon fontSize="small" />
      </button>

      <div className={styles.body}>
        {/* ── Primary nav ── */}
        {nav(<DashboardIcon fontSize="small" />, "Dashboard", "/dashboard")}
        {nav(<RocketLaunchIcon fontSize="small" />, "Spaces", "/spaces")}

        {nav(
          <ConfirmationNumberIcon fontSize="small" />,
          "Tickets",
          "/tickets",
          can("view:tickets"),
        )}
        {/* {nav(
          <ViewKanbanIcon fontSize="small" />,
          "Kanban",
          "/kanban",
          can("view:tickets"),
        )} */}
        {nav(
          <SpeedIcon fontSize="small" />,
          "Sprints",
          "/sprints",
          can("view:tickets"),
        )}

        {/* <div className={styles.divider} /> */}

        {nav(<MenuBookIcon fontSize="small" />, "Wiki", "/wiki")}
        {nav(<WbSunnyIcon fontSize="small" />, "Standup", "/standup")}
        {nav(<BarChartIcon fontSize="small" />, "Analytics", "/analytics")}

        {/* <div className={styles.divider} /> */}

        {nav(
          <GroupsIcon fontSize="small" />,
          "Team",
          "/team",
          can("view:teams"),
        )}
        {nav(
          <TableChartIcon fontSize="small" />,
          "Timesheets",
          "/manual-entry",
          // can("entry:manual"),
        )}
        {nav(
          <GridViewIcon fontSize="small" />,
          "Weekly Grid",
          "/timesheets/weekly",
          can("entry:manual"),
        )}
        {nav(
          <FileDownloadIcon fontSize="small" />,
          "Export",
          "/export",
          can("export:all"),
        )}

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

        {nav(
          <SettingsIcon fontSize="small" />,
          "Settings",
          "/settings",
          can("manage:settings"),
        )}
        {nav(
          <AutoAwesomeIcon fontSize="small" />,
          "Burn Rate",
          "/settings/budget",
          can("manage:settings"),
        )}
        {nav(
          <NotificationsIcon fontSize="small" />,
          "Notifications",
          "/settings/notifications",
        )}
        {!can("manage:users") &&
          nav(
            <LockIcon fontSize="small" />,
            "Change Password",
            "/settings/password",
          )}
        {nav(
          <PeopleIcon fontSize="small" />,
          "Users",
          "/admin/users",
          can("manage:users"),
        )}
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
