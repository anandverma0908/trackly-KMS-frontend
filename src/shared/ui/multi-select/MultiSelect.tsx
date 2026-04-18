import { useState, useRef, useEffect } from "react";
import styles from "./MultiSelect.module.scss";

interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  searchable?: boolean;
  maxHeight?: number;
}

export default function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select…",
  searchable = true,
  maxHeight = 260,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase()),
  );

  function toggle(option: string) {
    onChange(
      selected.includes(option)
        ? selected.filter((s) => s !== option)
        : [...selected, option],
    );
  }

  function selectAll() {
    onChange(filtered.length === options.length ? [] : [...options]);
  }

  return (
    <div className={styles.root} ref={ref}>
      {/* Trigger */}
      <div
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <div className={styles.triggerLeft}>
          {selected.length === 0 ? (
            <span className={styles.placeholder}>{placeholder}</span>
          ) : selected.length === options.length ? (
            <span className={styles.allSelected}>
              All projects ({options.length})
            </span>
          ) : (
            <div className={styles.chips}>
              {selected.slice(0, 3).map((s) => (
                <span key={s} className={styles.chip}>
                  {s}
                  <button
                    className={styles.chipX}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(s);
                    }}
                  >
                    ✕
                  </button>
                </span>
              ))}
              {selected.length > 3 && (
                <span className={styles.chipMore}>
                  +{selected.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>

        <div className={styles.triggerRight}>
          {selected.length > 0 && (
            <button
              className={styles.clearAll}
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
              title="Clear all"
            >
              ✕
            </button>
          )}
          <span className={`${styles.arrow} ${open ? styles.arrowUp : ""}`}>
            ›
          </span>
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <div className={styles.dropdown} style={{ maxHeight }}>
          {/* Search */}
          {searchable && (
            <div className={styles.searchWrap}>
              <span className={styles.searchIcon}>🔍</span>
              <input
                className={styles.searchInput}
                placeholder="Search projects…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
              {search && (
                <button
                  className={styles.searchClear}
                  onClick={() => setSearch("")}
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Select all / count row */}
          <div className={styles.metaRow}>
            <button className={styles.metaBtn} onClick={selectAll}>
              {selected.length === options.length
                ? "Deselect all"
                : "Select all"}
            </button>
            <span className={styles.metaCount}>
              {selected.length} / {options.length} selected
            </span>
          </div>

          {/* Options list */}
          <div className={styles.list}>
            {filtered.length === 0 ? (
              <div className={styles.noResults}>No projects found</div>
            ) : (
              filtered.map((option) => {
                const isSelected = selected.includes(option);
                return (
                  <div
                    key={option}
                    className={`${styles.option} ${isSelected ? styles.optionSelected : ""}`}
                    onClick={() => toggle(option)}
                  >
                    <span
                      className={`${styles.checkbox} ${isSelected ? styles.checkboxActive : ""}`}
                    >
                      {isSelected && "✓"}
                    </span>
                    <span className={styles.optionLabel}>{option}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
