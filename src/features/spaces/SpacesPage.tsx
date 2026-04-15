import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import Tooltip from "@mui/material/Tooltip";
import LinearProgress from "@mui/material/LinearProgress";
import { fetchPodSummary, fetchSprints, type PodSummary } from "@/services/api";
import { getPodColor } from "@/config/themes";
import type { Sprint } from "@/types";
import styles from "./SpacesPage.module.css";

import FolderIcon from "@mui/icons-material/Folder";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import SearchIcon from "@mui/icons-material/Search";
import GridViewIcon from "@mui/icons-material/GridView";
import TableRowsIcon from "@mui/icons-material/TableRows";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";

/* ── Derived pod card data ── */
interface PodCard {
  pod: string;
  color: string;
  totalTickets: number;
  completedTickets: number;
  inProgressTickets: number;
  blockedTickets: number;
  progress: number;
  hasActiveSprint: boolean;
  activeSprint?: Sprint;
  totalHours: number;
}

const DONE_KEYS = ["Done", "Closed", "Resolved"];
const ACTIVE_KEYS = ["In Progress", "In Development", "Development Ready"];
const BLOCK_KEYS = ["Blocked"];

function buildPodCard(p: PodSummary, sprints: Sprint[]): PodCard {
  const total = Object.values(p.statuses).reduce((a, b) => a + b, 0);
  const done = DONE_KEYS.reduce((a, k) => a + (p.statuses[k] ?? 0), 0);
  const active = ACTIVE_KEYS.reduce((a, k) => a + (p.statuses[k] ?? 0), 0);
  const blocked = BLOCK_KEYS.reduce((a, k) => a + (p.statuses[k] ?? 0), 0);
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  const podSprints = sprints.filter((s) => s.pod === p.pod);
  const activeSprint = podSprints.find((s) => s.status === "active");
  return {
    pod: p.pod,
    color: getPodColor(p.pod),
    totalTickets: total,
    completedTickets: done,
    inProgressTickets: active,
    blockedTickets: blocked,
    progress,
    hasActiveSprint: !!activeSprint,
    activeSprint,
    totalHours: p.total_hours,
  };
}

export default function SpacesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: podSummaries = [], isLoading: loadingPods } = useQuery({
    queryKey: ["pod-summary"],
    queryFn: fetchPodSummary,
    staleTime: 1000 * 60 * 5,
  });

  const { data: sprints = [] } = useQuery({
    queryKey: ["sprints"],
    queryFn: fetchSprints,
    staleTime: 1000 * 60 * 5,
  });

  const cards = useMemo<PodCard[]>(() => {
    return podSummaries
      .map((p) => buildPodCard(p, sprints))
      .filter((c) => c.totalTickets > 0)
      .filter(
        (c) => !search || c.pod.toLowerCase().includes(search.toLowerCase()),
      )
      .sort((a, b) => b.totalTickets - a.totalTickets);
  }, [podSummaries, sprints, search]);

  const stats = useMemo(
    () => ({
      total: cards.length,
      withSprints: cards.filter((c) => c.hasActiveSprint).length,
      totalHours: Math.round(cards.reduce((a, c) => a + c.totalHours, 0)),
      totalTickets: cards.reduce((a, c) => a + c.totalTickets, 0),
    }),
    [cards],
  );

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={`${styles.header} fade-up`}>
        <div>
          <h1 className={styles.title}>Spaces</h1>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <div className={styles.searchWrap}>
            <SearchIcon sx={{ fontSize: 16, opacity: 0.5 }} />
            <input
              className={styles.searchInput}
              placeholder="Search pods…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className={styles.clearBtn} onClick={() => setSearch("")}>
                ✕
              </button>
            )}
          </div>
          <div className={styles.headerActions}>
            <div className={styles.viewToggle}>
              <Tooltip title="Grid view" arrow>
                <button
                  className={`${styles.viewBtn} ${viewMode === "grid" ? styles.viewBtnActive : ""}`}
                  onClick={() => setViewMode("grid")}
                >
                  <GridViewIcon fontSize="small" />
                </button>
              </Tooltip>
              <Tooltip title="List view" arrow>
                <button
                  className={`${styles.viewBtn} ${viewMode === "list" ? styles.viewBtnActive : ""}`}
                  onClick={() => setViewMode("list")}
                >
                  <TableRowsIcon fontSize="small" />
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className={`${styles.kpiStrip} fade-up`}>
        {[
          {
            icon: <FolderIcon sx={{ fontSize: 16 }} />,
            val: stats.total,
            label: "Total Pods",
            color: "var(--accent)",
          },
          {
            icon: <RocketLaunchIcon sx={{ fontSize: 16 }} />,
            val: stats.withSprints,
            label: "In Sprint",
            color: "var(--green)",
          },
          {
            icon: <TrendingUpIcon sx={{ fontSize: 16 }} />,
            val: stats.totalTickets.toLocaleString(),
            label: "Total Tickets",
            color: "var(--amber)",
          },
          {
            icon: <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />,
            val: `${stats.totalHours.toLocaleString()}h`,
            label: "Hours Logged",
            color: "var(--purple)",
          },
        ].map((k) => (
          <div
            key={k.label}
            className={styles.kpiCard}
            // style={{ "--kc": k.color } as React.CSSProperties}
          >
            <div className={styles.kpiTop}>
              <div className={styles.kpiLabel}>{k.label}</div>
              <div
                className={styles.kpiIcon}
                // style={{
                //   color: k.color,
                //   background: `color-mix(in srgb, ${k.color} 10%, transparent)`,
                //   borderColor: `color-mix(in srgb, ${k.color} 20%, transparent)`,
                // }}
              >
                {k.icon}
              </div>
            </div>
            <div className={styles.kpiBottom}>
              <div className={styles.kpiVal}>{k.val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Grid / List ── */}
      {loadingPods ? (
        <div className={styles.loading}>Loading spaces…</div>
      ) : cards.length === 0 ? (
        <div className={styles.empty}>
          {/* <div className={styles.emptyIcon}>🗂️</div> */}
          <div className={styles.emptyTitle}>No spaces found</div>
          <div className={styles.emptyDesc}>Try a different search</div>
        </div>
      ) : viewMode === "grid" ? (
        <div className={`${styles.grid} fade-up-2`}>
          {cards.map((card, i) => (
            <PodCard
              key={card.pod}
              card={card}
              delay={Math.min(i * 0.05, 0.4)}
              onClick={() => navigate(`/spaces/${card.pod}`)}
            />
          ))}
        </div>
      ) : (
        <div className={`${styles.listView} fade-up-2`}>
          {cards.map((card) => (
            <PodRow
              key={card.pod}
              card={card}
              onClick={() => navigate(`/spaces/${card.pod}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Pod Card ── */
function PodCard({
  card,
  delay,
  onClick,
}: {
  card: PodCard;
  delay: number;
  onClick: () => void;
}) {
  const { color } = card;
  const sprintColor = card.hasActiveSprint ? "var(--green)" : "var(--text-3)";
  const bars = [3, 5, 4, 6, 7, 5, 4].map((v, _i, a) => ({
    v,
    max: Math.max(...a),
  }));

  return (
    <motion.div
      className={styles.card}
      style={{ animationDelay: `${delay}s` }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onClick={onClick}
    >
      {/* <div className={styles.cardAccent} style={{ background: color }} /> */}

      <div className={styles.cardTop}>
        {/* <div
          className={styles.cardIcon}
          style={{ background: `${color}22`, border: `1px solid ${color}44` }}
        >
          <span style={{ fontSize: 20 }}>📦</span>
        </div> */}

        <div>
          <div className={styles.cardTitle}>{card.pod}</div>
          <div className={styles.cardDesc}>
            {card.totalTickets.toLocaleString()} total tickets ·{" "}
            {/* {Math.round(card.totalHours).toLocaleString()}h logged */}
          </div>
        </div>

        <div className={styles.cardStatusWrap}>
          <span
            className={styles.cardStatus}
            style={{ color: sprintColor, background: `${sprintColor}18` }}
          >
            {card.hasActiveSprint ? "Active Sprint" : "No Sprint"}
          </span>
          {/* <span
            className={styles.cardKey}
            style={{ color, background: `${color}18` }}
          >
            {card.pod}
          </span> */}

          <span className={styles.leadName}>
            {Math.round(card.totalHours).toLocaleString()}h
          </span>
        </div>
      </div>

      {card.activeSprint && (
        <div className={styles.tagRow}>
          <span
            className={styles.tag}
            style={{
              color: "var(--green)",
              background: "var(--green)18",
              borderColor: "var(--green)33",
            }}
          >
            {card.activeSprint.name}
          </span>
        </div>
      )}

      <div className={styles.progressSection}>
        <div className={styles.progressHeader}>
          <span className={styles.progressLabel}>Overall Progress</span>
          <span className={styles.progressVal} style={{ color }}>
            {card.progress}%
          </span>
        </div>
        <LinearProgress
          variant="determinate"
          value={card.progress}
          sx={{
            height: 4,
            borderRadius: 100,
            backgroundColor: "var(--surface-2)",
            "& .MuiLinearProgress-bar": {
              background: `linear-gradient(90deg, ${color}, ${color}cc)`,
              borderRadius: 100,
            },
          }}
        />
      </div>

      <div className={styles.ticketStats}>
        <div className={styles.tStat}>
          <span className={styles.tStatVal} style={{ color: "var(--green)" }}>
            {card.completedTickets.toLocaleString()}
          </span>
          <span className={styles.tStatLbl}>Done</span>
        </div>
        <div className={styles.tStatDivider} />
        <div className={styles.tStat}>
          <span className={styles.tStatVal} style={{ color: "var(--amber)" }}>
            {card.inProgressTickets.toLocaleString()}
          </span>
          <span className={styles.tStatLbl}>Active</span>
        </div>
        <div className={styles.tStatDivider} />
        <div className={styles.tStat}>
          <span className={styles.tStatVal} style={{ color: "var(--red)" }}>
            {card.blockedTickets.toLocaleString()}
          </span>
          <span className={styles.tStatLbl}>Blocked</span>
        </div>
        <div className={styles.tStatDivider} />
        <div className={styles.tStat}>
          <span className={styles.tStatVal}>
            {card.totalTickets.toLocaleString()}
          </span>
          <span className={styles.tStatLbl}>Total</span>
        </div>
      </div>

      {/* <div className={styles.cardFooter}>
        <div className={styles.memberAvatars}>
          <Tooltip title="Team members" arrow>
            <div className={styles.memberAvatar} style={{ background: color }}>
              <PeopleAltIcon sx={{ fontSize: 14 }} />
            </div>
          </Tooltip>
        </div>
        <div className={styles.cardLead}>
          <span className={styles.leadLabel}>Hours</span>
          <span className={styles.leadName}>
            {Math.round(card.totalHours).toLocaleString()}h
          </span>
        </div>
      </div> */}

      <div className={styles.sparkline}>
        {bars.map(({ v, max }, i) => (
          <div
            key={i}
            className={styles.sparkBar}
            style={{
              height: `${(v / max) * 100}%`,
              background: color,
              opacity: 0.6 + (i / bars.length) * 0.4,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

/* ── Pod Row (list view) ── */
function PodRow({ card, onClick }: { card: PodCard; onClick: () => void }) {
  const { color } = card;
  return (
    <div className={styles.listRow} onClick={onClick}>
      <div className={styles.listColorBar} style={{ background: color }} />
      <div className={styles.listKey} style={{ color }}>
        {card.pod}
      </div>
      <div className={styles.listInfo}>
        <div className={styles.listName}>{card.pod}</div>
        <div className={styles.listDesc}>
          {card.totalTickets.toLocaleString()} tickets ·{" "}
          {card.completedTickets.toLocaleString()} done
          {card.activeSprint ? ` · ${card.activeSprint.name} active` : ""}
        </div>
      </div>
      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div style={{ width: 100 }}>
          <LinearProgress
            variant="determinate"
            value={card.progress}
            sx={{
              height: 4,
              borderRadius: 100,
              backgroundColor: "var(--surface-2)",
              "& .MuiLinearProgress-bar": {
                background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                borderRadius: 100,
              },
            }}
          />
        </div>
        <span
          style={{
            fontSize: 12,
            color,
            fontWeight: 700,
            minWidth: 36,
            textAlign: "right",
          }}
        >
          {card.progress}%
        </span>
      </div>
    </div>
  );
}
