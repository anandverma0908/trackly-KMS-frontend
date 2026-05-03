import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useThemeStore } from "@/store";
import { useAuthStore } from "@/features/auth/useAuthStore";
import { ROLE_COLORS } from "@/features/auth/types";
import { useNotificationStore } from "@/store";
import { semanticSearch, novaQuery } from "@/services/api";
import type { SearchResult } from "@/types";
import styles from "./Topbar.module.css";

/* MUI */
import IconButton from "@mui/material/IconButton";
import Avatar from "@mui/material/Avatar";
import Tooltip from "@mui/material/Tooltip";
import Badge from "@mui/material/Badge";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";

import {
  RiMenuFoldLine,
  RiMenuLine,
  RiSearchLine,
  RiNotification3Line,
  RiMoonLine,
  RiSunLine,
  RiLogoutBoxRLine,
  RiUserLine,
  RiTicketLine,
  RiArticleLine,
  RiSparklingLine,
  RiCloseLine,
} from "react-icons/ri";


interface TopbarProps {
  onMenuClick?: () => void;
  onSidebarToggle?: () => void;
  sidebarCollapsed?: boolean;
  notifOpen?: boolean;
  onNotifToggle?: () => void;

}

type SearchMode = "semantic" | "nova";

export default function Topbar({
  onMenuClick,
  onSidebarToggle,
  sidebarCollapsed = false,
  notifOpen = false,
  onNotifToggle,
}: TopbarProps) {
  const navigate = useNavigate();
  const { colorMode, toggleMode } = useThemeStore();
  const { user, logout } = useAuthStore();
  const { unreadCount } = useNotificationStore();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  /* ── Search state ── */
  const [searchFocused, setSearchFocused] = useState(false);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("semantic");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [novaAnswer, setNovaAnswer] = useState<string | null>(null);
  const [searchError, setSearchError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selIdx, setSelIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* Cmd+K → focus search */
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* Click outside → close dropdown */
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const doSearch = useCallback(async (q: string, m: SearchMode) => {
    if (!q.trim()) {
      setResults([]);
      setNovaAnswer(null);
      setSearchError(false);
      return;
    }
    setLoading(true);
    setSearchError(false);
    try {
      if (m === "nova") {
        const res = await novaQuery(q);
        setNovaAnswer(res.answer ?? null);
        setResults(res.citations ?? []);
      } else {
        const res = await semanticSearch(q);
        setResults(res);
        setNovaAnswer(null);
      }
      setSelIdx(0);
    } catch {
      setResults([]);
      setSearchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(v, mode), 400);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setSearchFocused(false);
      inputRef.current?.blur();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selIdx]) {
      handleResultClick(results[selIdx]);
    }
  }

  function handleResultClick(r: SearchResult) {
    if (r.type === "ticket" && (r.id || r.key)) {
      navigate(`/tickets?key=${encodeURIComponent(String(r.id ?? r.key))}`);
    } else if (r.type === "wiki") {
      navigate(`/wiki?page=${encodeURIComponent(String(r.id))}`);
    } else if (r.url) {
      if (r.url.startsWith("/")) navigate(r.url);
      else window.open(r.url, "_blank");
    }

    setSearchFocused(false);
    setQuery("");
    setResults([]);
    setNovaAnswer(null);
  }

  function handleModeSwitch(m: SearchMode) {
    setMode(m);
    if (query.trim()) doSearch(query, m);
  }

  function clearSearch() {
    setQuery("");
    setResults([]);
    setNovaAnswer(null);
    setSearchError(false);
    inputRef.current?.focus();
  }

  function handleLogout() {
    setAnchorEl(null);
    logout();
    navigate("/login", { replace: true });
  }

  const initials =
    user?.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2) ?? "?";

  const roleColor = user ? ROLE_COLORS[user.role] : undefined;
  const isDark = colorMode === "dark";
  return (
    <header className={styles.topbar}>
      {/* ── Left ── */}
      <div className={styles.left}>
        {/* Desktop sidebar collapse toggle */}
        {/* <Tooltip title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} placement="bottom"> */}
        <IconButton
          size="small"
          onClick={onSidebarToggle}
          className={`${styles.iconBtn} ${styles.sidebarToggle}`}
          aria-label="Toggle sidebar"
        >
          {sidebarCollapsed ? (
            <RiMenuLine size={20} />
          ) : (
            <RiMenuFoldLine size={20} />
          )}
        </IconButton>
        {/* </Tooltip> */}

        {/* Mobile hamburger */}
        <Tooltip title="Menu" placement="bottom">
          <IconButton
            size="small"
            onClick={onMenuClick}
            className={`${styles.iconBtn} ${styles.hamburger}`}
            aria-label="Open menu"
          >
            <RiMenuLine size={20} />
          </IconButton>
        </Tooltip>

        {/* {sidebarCollapsed && (
          <div className={styles.logo} onClick={() => navigate("/my-work")}>
            <div className={styles.logoMark}>T</div>
            <span className={styles.logoName}>Trackly</span>
          </div>
        )} */}
      </div>

      {/* ── Centre — Inline Search ── */}
      <div className={styles.center} ref={dropdownRef}>
        <div
          className={`${styles.searchBar} ${searchFocused ? styles.searchBarFocused : ""}`}
        >
          <RiSearchLine
            size={15}
            color="var(--text-3)"
            style={{ flexShrink: 0 }}
          />
          <input
            ref={inputRef}
            className={styles.searchInput}
            placeholder="Search tickets, wiki, people…"
            value={query}
            onChange={handleInput}
            onFocus={() => setSearchFocused(true)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          {loading && (
            <CircularProgress
              size={13}
              sx={{ color: "var(--accent)", flexShrink: 0 }}
            />
          )}
          {query && !loading && (
            <button
              className={styles.clearBtn}
              onClick={clearSearch}
              tabIndex={-1}
            >
              <RiCloseLine size={13} />
            </button>
          )}

          {/* Mode pills */}
          <div className={styles.modePills}>
            <button
              className={`${styles.modePill} ${mode === "semantic" ? styles.modePillActive : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                handleModeSwitch("semantic");
              }}
              tabIndex={-1}
            >
              Search
            </button>
            {/* <button
              className={`${styles.modePill} ${mode === "nova" ? styles.modePillActive : ""}`}
              onMouseDown={(e) => { e.preventDefault(); handleModeSwitch("nova"); }}
              tabIndex={-1}
            >
              <span className={styles.novaGlow} />
              EOS
            </button> */}
          </div>

          {!searchFocused && <kbd className={styles.kbd}>⌘K</kbd>}
        </div>

        {/* ── Dropdown ── */}
        {searchFocused && (
          <div className={styles.dropdown}>
            {/* NOVA answer */}
            {novaAnswer && (
              <div className={styles.novaAnswer}>
                <div className={styles.novaBadge}>
                  <RiSparklingLine size={11} />
                  EOS
                </div>
                <p className={styles.novaText}>{novaAnswer}</p>
              </div>
            )}

            {/* Results */}
            {results.length > 0 && (
              <div className={styles.resultsList}>
                <div className={styles.resultsLabel}>
                  {results.length} result{results.length !== 1 ? "s" : ""}
                </div>
                {results.map((r, i) => (
                  <button
                    key={`${r.type}-${r.id}`}
                    className={`${styles.resultItem} ${i === selIdx ? styles.resultItemActive : ""}`}
                    onMouseDown={() => handleResultClick(r)}
                  >
                    <span className={styles.resultIcon}>
                      {r.type === "ticket" ? (
                        <RiTicketLine size={15} />
                      ) : (
                        <RiArticleLine size={15} />
                      )}
                    </span>
                    <div className={styles.resultBody}>
                      <div className={styles.resultTitle}>
                        {r.key && (
                          <span className={styles.resultKey}>{r.key}</span>
                        )}
                        <span>{r.title}</span>
                      </div>
                      {r.snippet && (
                        <p className={styles.resultSnippet}>{r.snippet}</p>
                      )}
                    </div>
                    <div className={styles.resultMeta}>
                      <span
                        className={`badge ${r.type === "ticket" ? "badge-blue" : "badge-purple"}`}
                        style={{ fontSize: "10px", flexShrink: 0 }}
                      >
                        {r.type}
                      </span>
                      <span className={styles.resultScore}>
                        {(r.score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Empty / error state */}
            {!loading && query && results.length === 0 && (
              <div className={styles.emptyState}>
                {searchError
                  ? "Search temporarily unavailable — try again"
                  : <>No results for "<strong>{query}</strong>"</>}
              </div>
            )}

            {/* Hint (no query yet) */}
            {!query && (
              <div className={styles.hintArea}>
                <div className={styles.hintRow}>
                  <kbd className={styles.kbdSmall}>↑↓</kbd> navigate
                  <kbd className={styles.kbdSmall}>↵</kbd> open
                  <kbd className={styles.kbdSmall}>Esc</kbd> close
                </div>
                <div className={styles.hintRow}>
                  <RiSparklingLine size={12} color="var(--accent)" />
                  <span>Switch to EOS for AI-powered answers</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right ── */}
      <div className={styles.right}>
        {/* ── Commented-out controls — preserved ─────────────────────────
        <TimerWidget />
        <div className={styles.sep} />
        <DateRangePicker />
        <div className={styles.sep} />
        ──────────────────────────────────────────────────────────────── */}


        {/* Theme toggle */}
        <Tooltip title={isDark ? "Light mode" : "Dark mode"} placement="bottom">
          <IconButton
            size="small"
            onClick={toggleMode}
            className={styles.iconBtn}
          >
            {isDark ? <RiSunLine size={20} /> : <RiMoonLine size={20} />}
          </IconButton>
        </Tooltip>

        {/* Notifications */}
        <Tooltip title="Notifications" placement="bottom">
          <IconButton
            size="small"
            onClick={onNotifToggle}
            className={`${styles.iconBtn} ${notifOpen ? styles.iconBtnActive : ""}`}
          >
            <Badge
              badgeContent={unreadCount || undefined}
              max={99}
              sx={{
                "& .MuiBadge-badge": {
                  background: "var(--accent)",
                  color: "#fff",
                  fontSize: "9px",
                  minWidth: "16px",
                  height: "16px",
                  padding: "0 4px",
                },
              }}
            >
              <RiNotification3Line size={20} />
            </Badge>
          </IconButton>
        </Tooltip>

        {/* User avatar + menu */}
        {user && (
          <>
            <Tooltip title={user.name} placement="bottom">
              <Avatar
                onClick={(e) => setAnchorEl(e.currentTarget)}
                sx={{
                  width: 32,
                  height: 32,
                  fontSize: "11px",
                  fontWeight: 800,
                  cursor: "pointer",
                  background: `linear-gradient(135deg, var(--accent), var(--accent-2))`,
                  border: "2px solid transparent",
                  transition: "border-color 0.15s",
                  "&:hover": { borderColor: "var(--accent-border)" },
                }}
              >
                {initials}
              </Avatar>
            </Tooltip>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              transformOrigin={{ horizontal: "right", vertical: "top" }}
              anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
              slotProps={{
                paper: {
                  sx: {
                    mt: 1,
                    minWidth: 200,
                    background: "var(--surface)",
                    border: "1px solid var(--border-2)",
                    boxShadow: "var(--shadow-lg)",
                  },
                },
              }}
            >
              <div className={styles.menuHeader}>
                <div className={styles.menuName}>{user.name}</div>
                <div
                  className={styles.menuRole}
                  style={
                    roleColor
                      ? { color: roleColor.text, background: roleColor.bg }
                      : {}
                  }
                >
                  {user.role.replace(/_/g, " ")}
                </div>
              </div>
              <Divider sx={{ borderColor: "var(--border)" }} />
              <MenuItem
                onClick={() => {
                  setAnchorEl(null);
                  navigate("/settings");
                }}
                sx={{
                  fontSize: "13px",
                  color: "var(--text-2)",
                  "&:hover": {
                    color: "var(--text)",
                    background: "var(--surface-2)",
                  },
                }}
              >
                <ListItemIcon sx={{ color: "inherit", minWidth: 32 }}>
                  <RiUserLine size={20} />
                </ListItemIcon>
                Settings
              </MenuItem>
              <MenuItem
                onClick={handleLogout}
                sx={{
                  fontSize: "13px",
                  color: "var(--red)",
                  "&:hover": { background: "var(--red-glow)" },
                }}
              >
                <ListItemIcon sx={{ color: "inherit", minWidth: 32 }}>
                  <RiLogoutBoxRLine size={20} />
                </ListItemIcon>
                Sign out
              </MenuItem>
            </Menu>
          </>
        )}
      </div>
    </header>
  );
}
