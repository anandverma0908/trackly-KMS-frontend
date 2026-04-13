import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useThemeStore } from "@/store";
import { useAuthStore } from "@/features/auth/useAuthStore";
import { ROLE_COLORS, ROLE_LABELS } from "@/features/auth/types";
import styles from "./Topbar.module.css";
import DateRangePicker from "../ui/DateRangePicker";
import NotificationBell from "@/components/nova/NotificationBell";
import TimerWidget from "@/components/nova/TimerWidget";
import SearchModal from "@/features/search/SearchModal";

interface TopbarProps {
  onMenuClick?: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const navigate = useNavigate();
  const { colorMode, toggleMode } = useThemeStore();
  const { user, logout } = useAuthStore();
  const [showSearch, setShowSearch] = useState(false);

  // Cmd+K to open search
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(true);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const roleColor = user ? ROLE_COLORS[user.role] : undefined;
  const initials =
    user?.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2) ?? "?";

  return (
    <header className={styles.topbar}>
      {/* Hamburger — mobile only */}
      <button className={styles.hamburger} onClick={onMenuClick} aria-label="Open menu">
        <span /><span /><span />
      </button>

      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoMark}>T</div>
        <div>
          <div className={styles.logoName}>Trackly</div>
          <div className={styles.logoTag}>Work. Tracked.</div>
        </div>
      </div>

      {/* <div className={styles.sep} /> */}

      {/* Nav — only shows routes the user can access */}
      {/* <nav className={styles.nav}>
        {navItems.map((item) => (
          <button
            key={item.path}
            className={`${styles.navBtn} ${location.pathname === item.path ? styles.navBtnActive : ""}`}
            onClick={() => navigate(item.path)}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav> */}

      {/* Right */}
      <div className={styles.right}>
        {/* Search trigger */}
        <button
          className={styles.searchBtn}
          onClick={() => setShowSearch(true)}
          title="Search (⌘K)"
        >
          🔍 <span className={styles.searchKbd}>⌘K</span>
        </button>

        <div className={styles.sep} />

        <TimerWidget />

        <div className={styles.sep} />

        <DateRangePicker />

        <div className={styles.sep} />

        {/* Mode toggle */}
        <button
          className={styles.iconBtn}
          onClick={toggleMode}
          title="Toggle light/dark"
        >
          {colorMode === "dark" ? "☀️" : "🌙"}
        </button>

        <NotificationBell />

        {/* User pill */}
        {user && (
          <div className={styles.userPill}>
            <div className={styles.avatar}>{initials}</div>
            <div className={styles.userInfo}>
              <div className={styles.userName}>{user.name.split(" ")[0]}</div>
              <div
                className={styles.userRole}
                style={{ color: roleColor?.text, background: roleColor?.bg }}
              >
                {ROLE_LABELS[user.role]}
              </div>
            </div>
            <button
              className={styles.logoutBtn}
              onClick={handleLogout}
              title="Sign out"
            >
              ⎋
            </button>
          </div>
        )}
      </div>

      {/* Search Modal */}
      {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
    </header>
  );
}
