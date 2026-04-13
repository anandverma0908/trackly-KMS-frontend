import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useFilterStore } from "@/store";
import { fetchFilters } from "@/services/api";
import { QUERY_KEYS } from "@/config/queryKeys";
import { getPodColor } from "@/config/themes";
import { useAuthStore } from "@/features/auth/useAuthStore";
import styles from "./Sidebar.module.css";
import { FaUsers } from "react-icons/fa";
import { TbKeyFilled, TbSettingsFilled, TbLayoutDashboardFilled } from "react-icons/tb";
import { HiTicket } from "react-icons/hi2";
import { RiTeamFill } from "react-icons/ri";
import { FaSheetPlastic } from "react-icons/fa6";
import { BiSolidFileExport } from "react-icons/bi";
import { MdViewKanban, MdSpeed, MdAutoAwesome } from "react-icons/md";
import { BsBook, BsSunrise, BsBarChart, BsBell, BsGrid } from "react-icons/bs";

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
      {/* Section header */}
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
          {/* Search — visible when showAll OR items > 8 */}
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

          {/* Item list */}
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

          {/* Show more / less */}
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

          {/* Selected chips */}
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
                            color: color,
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
  open?:    boolean;
  onClose?: () => void;
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
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

  return (
    <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`}>
      {/* Mobile close button */}
      <button className={styles.mobileCloseBtn} onClick={onClose} aria-label="Close menu">✕</button>
      {/* Search */}
      <div className={styles.body}>
        {/* Navigation */}
        <NavItem
          label="Dashboard"
          icon={<TbLayoutDashboardFilled />}
          active={location.pathname === "/dashboard"}
          onClick={() => handleNavClick("/dashboard")}
        />
        {/* {can("view:tickets") && ( */}
          <NavItem
            label="Tickets"
            icon={<HiTicket />}
            active={location.pathname === "/tickets"}
            onClick={() => handleNavClick("/tickets")}
          />
        {/* )} */}
        {/* {can("view:tickets") && ( */}
          <NavItem
            label="Kanban"
            icon={<MdViewKanban />}
            active={location.pathname === "/kanban"}
            onClick={() => handleNavClick("/kanban")}
          />
        {/* )} */}
        {/* {can("view:tickets") && ( */}
          <NavItem
            label="Sprints"
            icon={<MdSpeed />}
            active={location.pathname === "/sprints"}
            onClick={() => handleNavClick("/sprints")}
          />
        {/* )} */}

        <div className={styles.divider} />

        <NavItem
          label="Wiki"
          icon={<BsBook />}
          active={location.pathname === "/wiki"}
          onClick={() => handleNavClick("/wiki")}
        />
        <NavItem
          label="Standup"
          icon={<BsSunrise />}
          active={location.pathname === "/standup"}
          onClick={() => handleNavClick("/standup")}
        />
        <NavItem
          label="Analytics"
          icon={<BsBarChart />}
          active={location.pathname === "/analytics"}
          onClick={() => handleNavClick("/analytics")}
        />

        <div className={styles.divider} />

        {/* {can("view:teams") && ( */}
          <NavItem
            label="Team"
            icon={<RiTeamFill />}
            active={location.pathname === "/team"}
            onClick={() => handleNavClick("/team")}
          />
        {/* )} */}
        {/* {can("entry:manual") && ( */}
          <NavItem
            label="Timesheets"
            icon={<FaSheetPlastic />}
            active={location.pathname === "/manual-entry"}
            onClick={() => handleNavClick("/manual-entry")}
          />
        {/* )} */}
        {/* {can("entry:manual") && ( */}
          <NavItem
            label="Weekly Grid"
            icon={<BsGrid />}
            active={location.pathname === "/timesheets/weekly"}
            onClick={() => handleNavClick("/timesheets/weekly")}
          />
        {/* )} */}
        {/* {can("export:all") && ( */}
          <NavItem
            label="Export"
            icon={<BiSolidFileExport />}
            active={location.pathname === "/export"}
            onClick={() => handleNavClick("/export")}
          />
        {/* )} */}

        <div className={styles.divider} />

        {/* PODs — multi select */}
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

        {/* Clients — multi select */}
        <FilterSection
          title="Clients"
          items={allClients}
          selected={clients}
          onToggle={toggleClient}
          onClear={clearClients}
          maxVisible={5}
        />

        <div className={styles.divider} />

        {/* {can("manage:settings") && ( */}
          <NavItem
            label="Settings"
            icon={<TbSettingsFilled />}
            active={location.pathname === "/settings"}
            onClick={() => handleNavClick("/settings")}
          />
        {/* )} */}
        {/* {can("manage:settings") && ( */}
          <NavItem
            label="Burn Rate"
            icon={<MdAutoAwesome />}
            active={location.pathname === "/settings/budget"}
            onClick={() => handleNavClick("/settings/budget")}
          />
        {/* )} */}
        <NavItem
          label="Notifications"
          icon={<BsBell />}
          active={location.pathname === "/settings/notifications"}
          onClick={() => handleNavClick("/settings/notifications")}
        />
        {/* {!can("manage:users") && ( */}
          <NavItem
            label="Change Password"
            icon={<TbKeyFilled />}
            active={location.pathname === "/settings/password"}
            onClick={() => handleNavClick("/settings/password")}
          />
        {/* )} */}
        {/* {can("manage:users") && ( */}
          <NavItem
            label="Users"
            icon={<FaUsers />}
            active={location.pathname === "/admin/users"}
            onClick={() => handleNavClick("/admin/users")}
          />
        {/* )} */}
      </div>
    </aside>
  );
}

function NavItem({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: any;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`${styles.item} ${active ? styles.itemActive : ""}`}
      onClick={onClick}
    >
      {/* <span className={styles.icon}>{icon}</span> */}
      {icon}
      <span className={styles.label}>{label}</span>
    </button>
  );
}
