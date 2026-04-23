import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { semanticSearch, novaQuery, triggerReindex } from "@/services/api";
import toast from "react-hot-toast";
import type { SearchResult, NovaQueryResponse } from "@/types";
import styles from "./SearchModal.module.css";

interface Props {
  onClose: () => void;
}

type SearchMode = "semantic" | "nova";

export default function SearchModal({ onClose }: Props) {
  const navigate = useNavigate();
  const [query, setQuery]             = useState("");
  const [mode, setMode]               = useState<SearchMode>("semantic");
  const [results, setResults]         = useState<SearchResult[]>([]);
  const [novaResponse, setNovaResponse] = useState<NovaQueryResponse | null>(null);
  const [loading, setLoading]         = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIdx]) {
      handleResultClick(results[selectedIdx]);
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
    onClose();
  }

  async function doSearch(q: string, searchMode: SearchMode = mode) {
    if (!q.trim()) {
      setResults([]);
      setNovaResponse(null);
      return;
    }
    setLoading(true);
    try {
      if (searchMode === "nova") {
        const res = await novaQuery(q);
        setNovaResponse(res);
        setResults(res.citations ?? []);
      } else {
        const res = await semanticSearch(q);
        setResults(res);
        setNovaResponse(null);
      }
      setSelectedIdx(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(v), 400);
  }

  function handleModeSwitch(nextMode: SearchMode) {
    setMode(nextMode);
    if (query.trim()) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      void doSearch(query, nextMode);
    }
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        {/* Search Input */}
        <div className={styles.inputRow}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Search tickets, pages, or ask EOS…"
            value={query}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
          />
          {loading && <span className={styles.spinner} />}
          <div className={styles.modes}>
            <button
              className={`${styles.modeBtn} ${mode === "semantic" ? styles.modeBtnActive : ""}`}
              onClick={() => handleModeSwitch("semantic")}
            >
              Semantic
            </button>
            <button
              className={`${styles.modeBtn} ${mode === "nova" ? styles.modeBtnActive : ""}`}
              onClick={() => handleModeSwitch("nova")}
            >
              <span className={styles.novaGlow} />
              EOS
            </button>
          </div>
        </div>

        {/* NOVA Answer */}
        {novaResponse && (
          <div className={styles.novaAnswer}>
            <div className={styles.novaBadge}>
              <span className={styles.novaGlow} />
              Powered by EOS
            </div>
            <p className={styles.answerText}>{novaResponse.answer}</p>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className={styles.results}>
            <div className={styles.resultsHeader}>
              {results.length} result{results.length > 1 ? "s" : ""}
            </div>
            {results.map((r, i) => (
              <SearchResultItem
                key={`${r.type}-${r.id}`}
                result={r}
                active={i === selectedIdx}
                onClick={() => handleResultClick(r)}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && query && results.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>🔍</span>
            <span>No results for "<strong>{query}</strong>"</span>
            <button
              style={{ marginTop: 8, fontSize: 11, padding: "4px 12px", background: "var(--accent-glow)", border: "1px solid var(--accent-border)", color: "var(--accent)", borderRadius: 6, cursor: "pointer" }}
              onClick={async () => {
                try {
                  await triggerReindex();
                  toast.success("Reindexing started — try your search again in a moment");
                } catch {
                  toast.error("Reindex failed");
                }
              }}
            >
              ✦ Re-index tickets for search
            </button>
          </div>
        )}

        {/* Hint */}
        {!query && (
          <div className={styles.hint}>
            <div className={styles.hintRow}>
              <kbd>↑↓</kbd> navigate
              <kbd>↵</kbd> open
              <kbd>Esc</kbd> close
            </div>
            <div className={styles.hintRow}>
              <span>Switch to <button className={styles.hintBtn} onClick={() => handleModeSwitch(mode === "nova" ? "semantic" : "nova")}>
                {mode === "nova" ? "Semantic" : "EOS"}
              </button> mode</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SearchResultItem({
  result, active, onClick,
}: {
  result:  SearchResult;
  active:  boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`${styles.result} ${active ? styles.resultActive : ""}`}
      onClick={onClick}
    >
      <span className={styles.resultIcon}>
        {result.type === "ticket" ? "🎫" : "📄"}
      </span>
      <div className={styles.resultBody}>
        <div className={styles.resultTitle}>
          {result.title}
        </div>
        {result.snippet && (
          <p className={styles.resultSnippet}>{result.snippet}</p>
        )}
        {result.space && (
          <span className={styles.resultSpace}>{result.space}</span>
        )}
      </div>
      <div className={styles.resultMeta}>
        <span className={`badge ${result.type === "ticket" ? "badge-blue" : "badge-purple"}`}>
          {result.type}
        </span>
        <span className={styles.resultScore}>{(result.score * 100).toFixed(0)}%</span>
      </div>
    </button>
  );
}
