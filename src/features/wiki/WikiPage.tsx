import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  fetchWikiSpaces, fetchWikiPages, fetchWikiPage,
  createWikiSpace, createWikiPage, updateWikiPage,
  deleteWikiPage, fetchWikiVersions, restoreWikiVersion,
  extractMeetingActions, fetchWikiIntelligence, askWikiAssistant,
} from "@/services/api";
import { useWikiStore } from "@/store";
import type { WikiPage as WikiPageType } from "@/types";
import SideDrawer from "@/components/ui/SideDrawer";
import PageEditor from "./PageEditor";
import RelatedDocsWidget from "./RelatedDocsWidget";
import styles from "./WikiPage.module.css";

import { BiFileBlank } from "react-icons/bi";
import { MdAdd, MdHistory, MdDeleteOutline, MdClose, MdMenuBook } from "react-icons/md";
import { FaCircle } from "react-icons/fa";
import { MdOutlineKeyboardArrowRight } from "react-icons/md";
import {
  RiSparklingLine, RiTimeLine, RiAlertLine, RiCheckLine,
  RiLinkM, RiBarChartBoxLine, RiBrainLine, RiSendPlaneLine,
  RiSearchLine, RiLayoutRightLine, RiNodeTree,
  RiShieldCheckLine, RiFileTextLine, RiMapLine,
  RiLightbulbLine, RiTeamLine, RiGitMergeLine,
} from "react-icons/ri";

/* ══════════════════════════════════════════════════════════
   TEMPLATES
══════════════════════════════════════════════════════════ */
const PAGE_TEMPLATES = [
  { name: "PRD",          icon: "📋", content: "# Product Requirements Document\n\n## Overview\n\n## Goals\n\n## Non-Goals\n\n## Requirements\n\n## Success Metrics" },
  { name: "Runbook",      icon: "🔧", content: "# Runbook\n\n## Purpose\n\n## Prerequisites\n\n## Steps\n\n1. Step one\n2. Step two\n\n## Troubleshooting" },
  { name: "Sprint Retro", icon: "🔄", content: "# Sprint Retrospective\n\n## What Went Well ✅\n\n## What to Improve 🔧\n\n## Action Items 📝\n\n| Action | Owner | Due |" },
  { name: "Meeting Notes",icon: "📝", content: "# Meeting Notes\n\n**Date:** \n**Attendees:** \n\n## Agenda\n\n## Discussion\n\n## Action Items\n\n| Action | Owner | Due |" },
  { name: "ADR",          icon: "🏗️", content: "# Architecture Decision Record\n\n## Status\n\n## Context\n\n## Decision\n\n## Consequences" },
  { name: "Onboarding",   icon: "🚀", content: "# Onboarding Guide\n\n## Welcome\n\n## Setup\n\n## First Week\n\n## Resources\n\n## Your Manager" },
];

/* ══════════════════════════════════════════════════════════
   AI HELPERS  (deterministic from id)
══════════════════════════════════════════════════════════ */
type Freshness = "fresh" | "aging" | "stale";

const FRESH_COLOR: Record<Freshness, string> = {
  fresh: "var(--green)", aging: "var(--amber)", stale: "var(--red)",
};

function freshnessFromDate(dateStr?: string): Freshness {
  if (!dateStr) return "stale";
  const days = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)));
  if (days <= 30) return "fresh";
  if (days <= 75) return "aging";
  return "stale";
}

function processMeetingNotes(text: string): string {
  const lines = text.split("\n").filter(Boolean);
  const decisions = lines.filter(l => /decided|agreed|confirmed|approved/i.test(l)).slice(0, 3);
  const actions = lines.filter(l => /will|todo|action item|follow.?up/i.test(l)).slice(0, 4);
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return `# Meeting Notes\n\n> Structured by EOS · ${date}\n\n## Summary\n\n${lines.slice(0, 3).join(" ").slice(0, 220)}…\n\n## Key Decisions\n\n${decisions.length ? decisions.map(d => `- ${d.trim()}`).join("\n") : "- No explicit decisions detected"}\n\n## Action Items\n\n${actions.length ? actions.map(a => `- [ ] ${a.trim()}`).join("\n") : "- [ ] Review and distribute notes\n- [ ] Schedule follow-up"}\n\n## Follow-ups\n\n- [ ] Update related documentation\n- [ ] Share with stakeholders`;
}

type AITab = "health" | "map" | "insights" | "chat";

/* ══════════════════════════════════════════════════════════
   KNOWLEDGE MAP PANEL
══════════════════════════════════════════════════════════ */
function KnowledgeMapPanel({ pages, activeId }: { pages: WikiPageType[]; activeId: string | null }) {
  const W = 220, H = 170;
  const cx = W / 2, cy = H / 2 - 8;
  const shown = pages.slice(0, 8);

  const nodes = shown.map((p, i) => {
    const isActive = p.id === activeId;
    if (isActive) return { ...p, x: cx, y: cy, isActive: true, color: "var(--accent)" };
    const angle = (i / shown.length) * 2 * Math.PI - Math.PI / 2;
    const r = 60 + ((p.title.length + i * 7) % 18);
    const freshness = freshnessFromDate(p.updated_at);
    return { ...p, x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, isActive: false, color: FRESH_COLOR[freshness] };
  });

  const active = nodes.find(n => n.isActive);

  return (
    <div className={styles.mapWrap}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {active && nodes.filter(n => !n.isActive).map(n => (
          <line key={n.id} x1={active.x} y1={active.y} x2={n.x} y2={n.y}
            stroke="var(--border-2)" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
        ))}
        {nodes.map(n => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r={n.isActive ? 10 : 6}
              fill={n.color} fillOpacity={n.isActive ? 0.22 : 0.15}
              stroke={n.color} strokeWidth={n.isActive ? 2 : 1.2} />
            {n.isActive && (
              <circle cx={n.x} cy={n.y} r={18} fill="none" stroke={n.color} strokeWidth="1" opacity="0.25" />
            )}
            <text x={n.x} y={n.y + (n.isActive ? 24 : 17)} textAnchor="middle"
              fontSize={n.isActive ? "8" : "7"} fill="var(--text-3)" fontFamily="inherit">
              {n.title.slice(0, 14)}
            </text>
          </g>
        ))}
        {nodes.length === 0 && (
          <text x={cx} y={cy} textAnchor="middle" fontSize="11" fill="var(--text-3)" fontFamily="inherit">
            No pages yet
          </text>
        )}
      </svg>
      <div className={styles.mapLegend}>
        <span className={styles.mapLegendItem}><span className={styles.mapDot} style={{ background: "var(--green)" }} />Fresh</span>
        <span className={styles.mapLegendItem}><span className={styles.mapDot} style={{ background: "var(--amber)" }} />Aging</span>
        <span className={styles.mapLegendItem}><span className={styles.mapDot} style={{ background: "var(--red)" }} />Stale</span>
      </div>
      {shown.length === 0 && <p className={styles.mapEmpty}>Add pages to see their connections</p>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════ */
export default function WikiPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeSpaceId, activePageId, setActiveSpace, setActivePage } = useWikiStore();
  const urlPageId = searchParams.get("page");

  // Unified page selection: keeps URL and Zustand store in sync.
  // Without updating the URL, the clearing useEffect immediately un-selects the page.
  const selectPage = useCallback((id: string | null) => {
    setActivePage(id);
    if (id) {
      setSearchParams({ page: id });
    } else {
      setSearchParams({});
    }
  }, [setActivePage, setSearchParams]);

  // UI state
  const [showNewSpace,      setShowNewSpace]      = useState(false);
  const [pageSearch,        setPageSearch]        = useState("");
  const [newSpaceName,      setNewSpaceName]      = useState("");
  const [showVersions,      setShowVersions]      = useState(false);
  const [showTemplates,     setShowTemplates]     = useState(false);
  const [showAIPanel,       setShowAIPanel]       = useState(false);
  const [autoSaveStatus,    setAutoSaveStatus]    = useState<"idle"|"saving"|"saved">("idle");
  const [aiTab,             setAiTab]             = useState<AITab>("health");

  // Chat
  const [aiInput,           setAiInput]           = useState("");
  const [aiHistory,         setAiHistory]         = useState<{cmd: string; reply: string}[]>([]);
  const [aiThinking,        setAiThinking]        = useState(false);

  // Meeting capture
  const [showCapture,       setShowCapture]       = useState(false);
  const [captureInput,      setCaptureInput]      = useState("");
  const [captureOutput,     setCaptureOutput]     = useState<string | null>(null);
  const [captureProcessing, setCaptureProcessing] = useState(false);

  // Onboarding path
  const [showOnboarding,    setShowOnboarding]    = useState(false);

  // Data queries
  const { data: spaces = [] } = useQuery({ queryKey: ["wiki-spaces"], queryFn: fetchWikiSpaces });
  const { data: pages  = [] } = useQuery({ queryKey: ["wiki-pages", activeSpaceId], queryFn: () => fetchWikiPages(activeSpaceId ?? undefined), enabled: activeSpaceId !== null });
  const { data: activePage   } = useQuery({ queryKey: ["wiki-page", activePageId],  queryFn: () => fetchWikiPage(activePageId!), enabled: activePageId !== null });
  const { data: urlPage      } = useQuery({ queryKey: ["wiki-page-from-url",urlPageId], queryFn: () => fetchWikiPage(urlPageId!), enabled: !!urlPageId });
  const { data: versions = [] } = useQuery({ queryKey: ["wiki-versions", activePageId], queryFn: () => fetchWikiVersions(activePageId!), enabled: activePageId !== null && showVersions });
  const { data: intelligence } = useQuery({
    queryKey: ["wiki-intelligence", activeSpaceId, activePageId],
    queryFn: () => fetchWikiIntelligence(activeSpaceId, activePageId),
    enabled: activeSpaceId !== null,
  });

  useEffect(() => { if (spaces.length > 0 && activeSpaceId === null) setActiveSpace(spaces[0].id); }, [spaces, activeSpaceId, setActiveSpace]);
  useEffect(() => {
    if (!urlPageId && activePageId !== null) {
      setActivePage(null);
    }
  }, [urlPageId, activePageId, setActivePage]);
  useEffect(() => {
    if (!urlPageId || !urlPage) return;
    if (activePageId !== urlPageId) setActivePage(urlPageId);
    if (activeSpaceId !== urlPage.space_id) setActiveSpace(urlPage.space_id);
  }, [urlPageId, urlPage, activePageId, activeSpaceId, setActivePage, setActiveSpace]);

  const createSpaceMut = useMutation({ mutationFn: () => createWikiSpace({ name: newSpaceName, description: "" }), onSuccess: (s) => { qc.invalidateQueries({ queryKey: ["wiki-spaces"] }); setActiveSpace(s.id); setShowNewSpace(false); setNewSpaceName(""); }, onError: (e: Error) => toast.error(e.message) });
  const createPageMut  = useMutation({ mutationFn: (p: { title: string; content: string; parent_id?: string }) => createWikiPage({ space_id: activeSpaceId!, ...p }), onSuccess: (p) => { qc.invalidateQueries({ queryKey: ["wiki-pages", activeSpaceId] }); selectPage(p.id); }, onError: (e: Error) => toast.error(e.message) });
  const updatePageMut  = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: { title?: string; content?: string } }) => updateWikiPage(id, payload), onSuccess: () => { qc.invalidateQueries({ queryKey: ["wiki-page", activePageId] }); qc.invalidateQueries({ queryKey: ["wiki-pages", activeSpaceId] }); setAutoSaveStatus("saved"); setTimeout(() => setAutoSaveStatus("idle"), 3000); }, onError: (e: Error) => { setAutoSaveStatus("idle"); toast.error(e.message || "Failed to save page"); } });
  const deletePageMut  = useMutation({ mutationFn: (id: string) => deleteWikiPage(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["wiki-pages", activeSpaceId] }); selectPage(null); } });
  const restoreMut     = useMutation({ mutationFn: ({ versionId }: { versionId: number }) => restoreWikiVersion(activePageId!, versionId), onSuccess: () => { qc.invalidateQueries({ queryKey: ["wiki-page", activePageId] }); toast.success("Version restored"); setShowVersions(false); } });

  const handleSave = useCallback((content: string, title: string) => {
    if (!activePageId) return;
    setAutoSaveStatus("saving");
    updatePageMut.mutate({ id: activePageId, payload: { content, title } });
  }, [activePageId, updatePageMut]);

  function handleNewPage(templateContent?: string) {
    createPageMut.mutate({ title: `New Page ${pages.length + 1}`, content: templateContent ?? "" });
    setShowTemplates(false);
  }

  async function submitAiChat(cmd: string) {
    if (!cmd.trim() || aiThinking) return;
    setAiThinking(true);
    setAiInput("");
    setAiTab("chat");
    try {
      const result = await askWikiAssistant(cmd, activePageId, activeSpaceId);
      setAiHistory(h => [{ cmd, reply: result.answer }, ...h].slice(0, 6));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "EOS is unavailable right now.";
      toast.error(msg);
    } finally {
      setAiThinking(false);
    }
  }

  async function handleCapture() {
    if (!captureInput.trim()) return;
    setCaptureProcessing(true);
    try {
      const result = await extractMeetingActions(captureInput);
      const structured = typeof result === "string" ? result : (result?.structured_md ?? result?.content ?? processMeetingNotes(captureInput));
      setCaptureOutput(structured);
    } catch {
      setCaptureOutput(processMeetingNotes(captureInput));
    } finally {
      setCaptureProcessing(false);
    }
  }

  function createFromCapture() {
    if (!captureOutput) return;
    createPageMut.mutate({ title: `Meeting Notes — ${new Date().toLocaleDateString()}`, content: captureOutput });
    setShowCapture(false);
    setCaptureInput("");
    setCaptureOutput(null);
    toast.success("Page created from meeting notes");
  }

  const activeSpace  = spaces.find(s => s.id === activeSpaceId);
  const filteredPages = pageSearch.trim()
    ? pages.filter(p => p.title.toLowerCase().includes(pageSearch.toLowerCase()))
    : pages;
  const treePages    = buildTree(filteredPages);
  const breadcrumbs  = activePageId ? getBreadcrumbs(pages, activePageId) : [];
  const pageInsights = intelligence?.page_health ?? null;
  const onboardingPath = intelligence?.onboarding_path ?? [];
  const spaceHealthById = new Map((intelligence?.spaces ?? []).map((s) => [s.space_id, s]));

  return (
    <div className={styles.page}>

      {/* ── Top bar ── */}
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandDot} />
          <span className={styles.brandTitle}>Wiki</span>
          {activeSpace && <span className={styles.brandSpace}>{activeSpace.name}</span>}
        </div>

        <div className={styles.searchWrap}>
          <RiSearchLine size={13} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search pages…"
            value={pageSearch}
            onChange={e => setPageSearch(e.target.value)}
            onKeyDown={e => e.key === "Escape" && setPageSearch("")}
          />
          {pageSearch && <button className={styles.searchClear} onClick={() => setPageSearch("")}>✕</button>}
        </div>

        <div className={styles.topbarRight}>
          <button className={styles.captureBtn} onClick={() => setShowCapture(true)} title="Structure meeting notes into a doc">
            <RiFileTextLine size={13} />Notes
          </button>
          {activePage && (
            <button className={`${styles.iconBtn} ${showAIPanel ? styles.iconBtnActive : ""}`} onClick={() => setShowAIPanel(v => !v)} title="Toggle AI panel">
              <RiLayoutRightLine size={15} />
            </button>
          )}
          {activeSpaceId && (
            <button className={styles.newPageBtn} onClick={() => setShowTemplates(true)}>
              <MdAdd size={14} />New Page
            </button>
          )}
        </div>
      </header>

      {/* ── Body: sidebar | main | ai panel ── */}
      <div className={styles.body}>

        {/* ── Left Sidebar ── */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarScroll}>

            {/* Spaces */}
            <div className={styles.sideSection}>
              <div className={styles.sideSectionHeader}>
                <span>Spaces</span>
                <button className={styles.sideSectionAdd} onClick={() => setShowNewSpace(true)}><MdAdd size={12} /></button>
              </div>
              {showNewSpace && (
                <div className={styles.newSpaceForm}>
                  <input className="input input-sm" placeholder="Space name…" value={newSpaceName}
                    onChange={e => setNewSpaceName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") createSpaceMut.mutate(); if (e.key === "Escape") setShowNewSpace(false); }}
                    autoFocus />
                  <button className="btn btn-primary btn-sm" onClick={() => createSpaceMut.mutate()} disabled={!newSpaceName.trim()}>Create</button>
                </div>
              )}
              <div className={styles.spaceList}>
                {spaces.map(s => {
                  const h = spaceHealthById.get(s.id)?.health ?? 25;
                  const c = h >= 75 ? "var(--green)" : h >= 50 ? "var(--amber)" : "var(--red)";
                  const circ = 2 * Math.PI * 8;
                  return (
                    <button key={s.id} className={`${styles.spaceItem} ${s.id === activeSpaceId ? styles.spaceItemActive : ""}`} onClick={() => setActiveSpace(s.id)}>
                      <div className={styles.spaceRing}>
                        <svg width="20" height="20" viewBox="0 0 20 20">
                          <circle cx="10" cy="10" r="8" fill="none" stroke="var(--surface-3)" strokeWidth="2.5" />
                          <circle cx="10" cy="10" r="8" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"
                            strokeDasharray={`${(h / 100) * circ} ${circ}`} transform="rotate(-90 10 10)" />
                        </svg>
                        <span className={styles.spaceRingNum} style={{ color: c }}>{h}</span>
                      </div>
                      <span className={styles.spaceName}>{s.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pages tree */}
            {activeSpaceId !== null && (
              <div className={styles.sideSection}>
                <div className={styles.sideSectionHeader}>
                  <span>Pages</span>
                  <button className={styles.sideSectionAdd} onClick={() => setShowTemplates(true)}><MdAdd size={12} /></button>
                </div>
                <div className={styles.pageTree}>
                  {treePages.map(p => (
                    <PageTreeItem key={p.id} page={p} activeId={activePageId} onSelect={selectPage} depth={0} />
                  ))}
                  {treePages.length === 0 && <p className={styles.emptyTree}>No pages yet — create one</p>}
                </div>
              </div>
            )}

            {/* EOS Quick Actions */}
            <div className={styles.eosActions}>
              <div className={styles.eosActionsLabel}><RiSparklingLine size={10} />EOS</div>
              {[
                { icon: <RiTimeLine size={11} />,    label: "Scan stale pages",        cmd: "Find stale pages in this wiki space" },
                { icon: <RiAlertLine size={11} />,   label: "Detect conflicts",         cmd: "Detect documentation conflicts for the active page" },
                { icon: <RiTeamLine size={11} />,    label: "Generate onboarding path", onboard: true },
                { icon: <RiLightbulbLine size={11} />,label: "Find coverage gaps",       cmd: "Find documentation coverage gaps in this wiki space" },
              ].map((a, i) => (
                <button key={i} className={styles.eosActionItem} onClick={() => {
                  if ("onboard" in a) { setShowOnboarding(true); return; }
                  setShowAIPanel(true);
                  void submitAiChat(a.cmd!);
                }}>
                  {a.icon}<span>{a.label}</span>
                </button>
              ))}
            </div>

          </div>
        </aside>

        {/* ── Main editor ── */}
        <main className={styles.main}>
          {activePage ? (
            <>
              <div className={styles.mainTopbar}>
                <div className={styles.breadcrumb}>
                  <MdMenuBook size={14} style={{ color: "var(--text-3)", flexShrink: 0 }} />
                  <span className={styles.breadcrumbSpace}>{activeSpace?.name}</span>
                  {breadcrumbs.map(b => (
                    <span key={b.id} className={styles.breadcrumbItem}>
                      <span className={styles.breadcrumbSep}>›</span>
                      <button className={styles.breadcrumbLink} onClick={() => selectPage(b.id)}>{b.title}</button>
                    </span>
                  ))}
                </div>
                <div className={styles.pageActions}>
                  <div className={styles.autoSave}>
                    {autoSaveStatus === "saving" && <><span className={styles.savingDot} />Saving…</>}
                    {autoSaveStatus === "saved"  && <><span className={styles.savedDot}  />Saved</>}
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowVersions(v => !v)}><MdHistory size={13} style={{ marginRight: 4 }} />History</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { if (confirm("Delete this page?")) deletePageMut.mutate(activePage.id); }}><MdDeleteOutline size={13} style={{ marginRight: 4 }} />Delete</button>
                </div>
              </div>

              {/* EOS freshness banner */}
              {pageInsights && (
                <div className={`${styles.eosBanner} ${styles[`eosBanner_${pageInsights.freshness}`]}`}>
                  <span className={styles.eosBannerDot} style={{ background: FRESH_COLOR[pageInsights.freshness] }} />
                  <RiSparklingLine size={11} className={styles.eosBannerIcon} />
                  <span className={styles.eosBannerText}>
                    {pageInsights.freshness === "stale"
                      ? `${pageInsights.days_old} days since last update · ${pageInsights.linked_tickets} ticket references found`
                      : pageInsights.has_conflict
                      ? "EOS detected a potential conflict with another page — review before editing"
                      : `EOS · ${pageInsights.score}% health · ${pageInsights.linked_tickets} linked tickets · backend analysis`}
                  </span>
                  <span className={styles.eosBannerBadge} style={{ color: FRESH_COLOR[pageInsights.freshness], borderColor: FRESH_COLOR[pageInsights.freshness] }}>
                    {pageInsights.freshness === "fresh" ? "Fresh" : pageInsights.freshness === "aging" ? "Aging" : "Needs update"}
                  </span>
                </div>
              )}

              {/* Smart History */}
              {showVersions && (
                <div className={styles.versionsPanel}>
                  <div className={styles.versionsPanelTitle}><RiGitMergeLine size={11} />Smart History · semantic diff enabled</div>
                  {versions.length === 0 && <p className={styles.emptyTree}>No versions recorded yet.</p>}
                  {versions.map(v => (
                    <div key={v.id} className={styles.versionItem}>
                      <div>
                        <span className={styles.versionNum}>v{v.version}</span>
                        <span className={styles.versionAuthor}>{v.author_name}</span>
                        <span className={styles.versionDate}>{new Date(v.created_at).toLocaleString()}</span>
                      </div>
                      <button className="btn btn-ghost btn-sm" onClick={() => restoreMut.mutate({ versionId: v.version })}>Restore</button>
                    </div>
                  ))}
                </div>
              )}

              <div
                className={styles.editorWrap}
                onClick={e => {
                  const target = e.target as HTMLElement;
                  const pageId = target.closest("[data-page-id]")?.getAttribute("data-page-id");
                  if (pageId) { selectPage(pageId); return; }
                  const ticketKey = target.closest("[data-ticket-key]")?.getAttribute("data-ticket-key");
                  if (ticketKey) navigate(`/backlog?search=${encodeURIComponent(ticketKey)}`);
                }}
              >
                <PageEditor key={activePage.id} initialTitle={activePage.title} initialContent={activePage.content_md ?? activePage.content_html ?? ""} onSave={handleSave} pages={pages} />
              </div>
            </>
          ) : (
            /* ── Empty state ── */
            <div className={styles.emptyState}>
              <div className={styles.emptyEOS}>
                <span className={styles.emptyRing} />
                <span className={styles.emptyRing2} />
                <RiSparklingLine size={26} className={styles.emptyIcon} />
              </div>
              <h2 className={styles.emptyTitle}>{activeSpaceId ? "Select a page" : "Choose a space"}</h2>
              <p className={styles.emptyDesc}>{activeSpaceId ? "Pick a page from the sidebar or create something new." : "Select a space from the sidebar to start writing."}</p>

              {activeSpaceId && (
                <>
                  <div className={styles.emptyActions}>
                    <button className={styles.emptyPrimary} onClick={() => handleNewPage()}>
                      <MdAdd size={14} />New blank page
                    </button>
                    <button className={styles.emptySecondary} onClick={() => setShowTemplates(true)}>
                      <RiFileTextLine size={13} />Use template
                    </button>
                    <button className={styles.emptySecondary} onClick={() => setShowCapture(true)}>
                      <RiFileTextLine size={13} />Structure notes
                    </button>
                    <button className={styles.emptySecondary} onClick={() => setShowOnboarding(true)}>
                      <RiTeamLine size={13} />Onboarding path
                    </button>
                  </div>

                  <div className={styles.emptyFeatures}>
                    <div className={styles.emptyFeatureItem}><RiSparklingLine size={12} /><span>EOS auto-scans every page for freshness and conflicts</span></div>
                    <div className={styles.emptyFeatureItem}><RiNodeTree size={12} /><span>Knowledge map shows how your pages connect</span></div>
                    <div className={styles.emptyFeatureItem}><RiGitMergeLine size={12} /><span>Smart history with semantic diff across versions</span></div>
                    <div className={styles.emptyFeatureItem}><RiFileTextLine size={12} /><span>Structure meeting notes into clean wiki pages</span></div>
                  </div>
                </>
              )}

              <div className={styles.emptyStats}>
                <div className={styles.emptyStat}><span className={styles.emptyStatVal}>{pages.length}</span><span className={styles.emptyStatLbl}>pages</span></div>
                <div className={styles.emptyStat}><span className={styles.emptyStatVal}>{spaces.length}</span><span className={styles.emptyStatLbl}>spaces</span></div>
                <div className={styles.emptyStat}><span className={styles.emptyStatVal} style={{ color: "var(--accent)" }}>EOS</span><span className={styles.emptyStatLbl}>active</span></div>
              </div>
            </div>
          )}
        </main>

      </div>

      {/* ── AI Drawer ── */}
      {activePage && pageInsights && (
        <SideDrawer
          open={showAIPanel}
          onClose={() => setShowAIPanel(false)}
          size="lg"
          title="EOS Assistant"
          subtitle={activePage.title}
          avatar={<RiSparklingLine size={18} color="var(--accent)" />}
          badge={<span style={{ color: "var(--accent)", fontSize: 12, fontWeight: 600 }}>Wiki</span>}
          stats={[
            { label: "Health", value: `${pageInsights.score}%`, color: pageInsights.score >= 75 ? "var(--green)" : pageInsights.score >= 50 ? "var(--amber)" : "var(--red)" },
            { label: "Freshness", value: pageInsights.freshness },
            { label: "Links", value: String(pageInsights.related_count) },
          ]}
        >
          <div className={styles.aiTabs}>
            {([
              { id: "health",   icon: <RiBarChartBoxLine size={12} />, label: "Health" },
              { id: "map",      icon: <RiMapLine size={12} />,         label: "Map" },
              { id: "insights", icon: <RiLightbulbLine size={12} />,   label: "Insights" },
              { id: "chat",     icon: <RiBrainLine size={12} />,       label: "Ask EOS" },
            ] as { id: AITab; icon: React.ReactNode; label: string }[]).map(t => (
              <button key={t.id} className={`${styles.aiTab} ${aiTab === t.id ? styles.aiTabActive : ""}`} onClick={() => setAiTab(t.id)}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {aiTab === "health" && (
            <div className={styles.aiTabContent}>
              <div className={styles.healthGaugeRow}>
                {(() => {
                  const s = pageInsights.score;
                  const c = s >= 75 ? "var(--green)" : s >= 50 ? "var(--amber)" : "var(--red)";
                  const circ = 2 * Math.PI * 24;
                  return (
                    <svg width="58" height="58" viewBox="0 0 58 58">
                      <circle cx="29" cy="29" r="24" fill="none" stroke="var(--surface-3)" strokeWidth="4.5" />
                      <circle cx="29" cy="29" r="24" fill="none" stroke={c} strokeWidth="4.5" strokeLinecap="round"
                        strokeDasharray={`${(s / 100) * circ} ${circ}`} transform="rotate(-90 29 29)"
                        style={{ transition: "stroke-dasharray 0.8s ease" }} />
                      <text x="29" y="34" textAnchor="middle" fontSize="14" fontWeight="800" fill={c} fontFamily="inherit">{s}</text>
                    </svg>
                  );
                })()}
                <div className={styles.healthMeta}>
                  <div className={styles.healthScoreLabel}>Doc Health</div>
                  {[
                    { label: "Freshness",   val: pageInsights.freshness === "fresh" ? 92 : pageInsights.freshness === "aging" ? 58 : 24 },
                    { label: "Coverage",    val: Math.round((pageInsights.coverage.headings + pageInsights.coverage.examples + pageInsights.coverage.links + pageInsights.coverage.diagrams) / 4) },
                    { label: "Cross-links", val: Math.min(100, 20 + pageInsights.related_count * 16) },
                  ].map(m => (
                    <div key={m.label} className={styles.healthMetaRow}>
                      <span className={styles.healthMetaLabel}>{m.label}</span>
                      <div className={styles.healthMetaTrack}>
                        <div className={styles.healthMetaFill} style={{ width: `${m.val}%`, background: m.val >= 70 ? "var(--green)" : m.val >= 45 ? "var(--amber)" : "var(--red)" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.coverageSection}>
                <div className={styles.coverageSectionLabel}>Content Coverage</div>
                <div className={styles.coverageRow}>
                  {([
                    ["Headings", pageInsights.coverage.headings],
                    ["Examples", pageInsights.coverage.examples],
                    ["Links", pageInsights.coverage.links],
                    ["Diagrams", pageInsights.coverage.diagrams],
                  ] as [string, number][]).map(([l, v]) => (
                    <div key={l} className={styles.coverageItem}>
                      <div className={styles.coverageRing} style={{ background: `conic-gradient(${v >= 75 ? "var(--green)" : v >= 50 ? "var(--amber)" : "var(--red)"} ${v}%, var(--surface-3) 0)` }} />
                      <span className={styles.coverageLabel}>{l}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.complianceRow}>
                <RiShieldCheckLine size={11} color={pageInsights.compliance.passed ? "var(--green)" : "var(--amber)"} />
                <span className={styles.complianceText}>
                  {pageInsights.compliance.passed
                    ? "Compliance check passed · no sensitive data detected"
                    : `Potential sensitive strings detected: ${pageInsights.compliance.matches.join(", ")}`}
                </span>
              </div>
            </div>
          )}

          {aiTab === "map" && (
            <div className={styles.aiTabContent}>
              <div className={styles.mapHeader}>
                <span className={styles.mapHeaderLabel}>Knowledge Map</span>
                <span className={styles.mapHeaderSub}>{pages.length} pages · {spaces.length} spaces</span>
              </div>
              <KnowledgeMapPanel pages={pages} activeId={activePageId} />
              <div className={styles.mapStats}>
                <div className={styles.mapStatItem}>
                  <span className={styles.mapStatVal}>{intelligence?.map_stats.fresh ?? 0}</span>
                  <span className={styles.mapStatLbl}>fresh</span>
                </div>
                <div className={styles.mapStatItem}>
                  <span className={styles.mapStatVal} style={{ color: "var(--amber)" }}>{intelligence?.map_stats.aging ?? 0}</span>
                  <span className={styles.mapStatLbl}>aging</span>
                </div>
                <div className={styles.mapStatItem}>
                  <span className={styles.mapStatVal} style={{ color: "var(--red)" }}>{intelligence?.map_stats.stale ?? 0}</span>
                  <span className={styles.mapStatLbl}>stale</span>
                </div>
              </div>
            </div>
          )}

          {aiTab === "insights" && (
            <div className={styles.aiTabContent}>
              <div className={styles.insightsList}>
                {pageInsights.freshness === "stale" && (
                  <div className={styles.insightItem} style={{ borderLeftColor: "var(--red)" }}>
                    <RiTimeLine size={11} color="var(--red)" />
                    <div>
                      <div className={styles.insightTitle}>Page needs update</div>
                      <div className={styles.insightDesc}>{pageInsights.days_old}d old · {pageInsights.linked_tickets} linked tickets found</div>
                    </div>
                  </div>
                )}
                {pageInsights.has_conflict && (
                  <div className={styles.insightItem} style={{ borderLeftColor: "var(--amber)" }}>
                    <RiAlertLine size={11} color="var(--amber)" />
                    <div>
                      <div className={styles.insightTitle}>Potential conflict</div>
                      <div className={styles.insightDesc}>Another page has conflicting information — review recommended</div>
                    </div>
                  </div>
                )}
                <div className={styles.insightItem} style={{ borderLeftColor: "var(--accent)" }}>
                  <RiLinkM size={11} color="var(--accent)" />
                  <div>
                    <div className={styles.insightTitle}>{pageInsights.related_count} related pages discovered</div>
                    <div className={styles.insightDesc}>Related pages can be linked to improve discoverability</div>
                  </div>
                </div>
                <div className={styles.insightItem} style={{ borderLeftColor: "var(--green)" }}>
                  <RiCheckLine size={11} color="var(--green)" />
                  <div>
                    <div className={styles.insightTitle}>{pageInsights.compliance.passed ? "Compliance check passed" : "Review sensitive strings"}</div>
                    <div className={styles.insightDesc}>
                      {pageInsights.compliance.passed ? "No sensitive data patterns detected" : "Potential secrets or tokens may be present in this page"}
                    </div>
                  </div>
                </div>
              </div>

              {activePageId && (
                <RelatedDocsWidget
                  pageId={activePageId}
                  onSelect={setActivePage}
                  onTicketSelect={key => navigate(`/backlog?search=${encodeURIComponent(key)}`)}
                />
              )}
            </div>
          )}

          {aiTab === "chat" && (
            <div className={`${styles.aiTabContent} ${styles.chatTabContent}`}>
              {aiHistory.length === 0 && !aiThinking && (
                <div className={styles.chatSuggestions}>
                  <div className={styles.chatSuggestionsLabel}>Quick actions</div>
                  {["Summarize this page", "Find stale pages", "Detect conflicts", "Show coverage gaps", "Generate onboarding path"].map(s => (
                    <button key={s} className={styles.chatSuggestion} onClick={() => void submitAiChat(s)}>{s}</button>
                  ))}
                </div>
              )}

              {aiHistory.length > 0 && (
                <div className={styles.chatHistory}>
                  {[...aiHistory].reverse().map((h, i) => (
                    <div key={i} className={styles.chatExchange}>
                      <div className={styles.chatUser}>{h.cmd}</div>
                      <div className={styles.chatEOS}>
                        <RiSparklingLine size={9} style={{ flexShrink: 0, marginTop: 2, color: "var(--accent)" }} />
                        <span className={styles.chatEOSText}>{h.reply}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {aiThinking && (
                <div className={styles.chatThinking}>
                  <span className={styles.thinkDot} /><span className={styles.thinkDot} /><span className={styles.thinkDot} />
                </div>
              )}

              <div className={styles.chatInputRow}>
                <input className={styles.chatInput} placeholder="Ask anything about your wiki…" value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && void submitAiChat(aiInput)} />
                <button className={styles.chatSendBtn} onClick={() => void submitAiChat(aiInput)} disabled={!aiInput.trim() || aiThinking}>
                  <RiSendPlaneLine size={13} />
                </button>
              </div>
            </div>
          )}
        </SideDrawer>
      )}

      {/* ── Template Modal ── */}
      {showTemplates && (
        <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && setShowTemplates(false)}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Choose a Template</h3>
              <button className={styles.modalClose} onClick={() => setShowTemplates(false)}><MdClose /></button>
            </div>
            <div className={styles.templateGrid}>
              <div className={styles.templateCard} onClick={() => handleNewPage()}>
                <span className={styles.templateIcon}><BiFileBlank /></span>
                <span className={styles.templateName}>Blank</span>
              </div>
              {PAGE_TEMPLATES.map(tpl => (
                <div key={tpl.name} className={styles.templateCard} onClick={() => handleNewPage(tpl.content)}>
                  <span className={styles.templateIcon}>{tpl.icon}</span>
                  <span className={styles.templateName}>{tpl.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Meeting Capture Modal ── */}
      {showCapture && (
        <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && setShowCapture(false)}>
          <div className={`${styles.modal} ${styles.captureModal}`}>
            <div className={styles.modalHeader}>
              <div>
                <h3>Structure Meeting Notes</h3>
                <p className={styles.modalSub}>Paste raw notes or a transcript — EOS will turn them into a clean wiki draft</p>
              </div>
              <button className={styles.modalClose} onClick={() => { setShowCapture(false); setCaptureOutput(null); setCaptureInput(""); }}><MdClose /></button>
            </div>

            {!captureOutput ? (
              <>
                <textarea className={styles.captureTextarea} placeholder="Paste meeting notes, bullet points, or a full transcript…" value={captureInput} onChange={e => setCaptureInput(e.target.value)} rows={8} />
                <div className={styles.captureActions}>
                  <button className={styles.captureBtn2} onClick={handleCapture} disabled={!captureInput.trim() || captureProcessing}>
                    {captureProcessing ? <><span className={styles.thinkDot} /><span className={styles.thinkDot} /><span className={styles.thinkDot} /></> : <><RiSparklingLine size={13} />Structure with EOS</>}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.captureOutput}>
                  <div className={styles.captureOutputLabel}><RiSparklingLine size={11} />EOS structured this for you</div>
                  <pre className={styles.captureOutputPre}>{captureOutput}</pre>
                </div>
                <div className={styles.captureActions}>
                  <button className={styles.captureBtn2} onClick={createFromCapture}>
                    <MdAdd size={13} />Create page from this
                  </button>
                  <button className={styles.captureBtnSecondary} onClick={() => setCaptureOutput(null)}>
                    Edit notes
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Onboarding Path Modal ── */}
      {showOnboarding && (
        <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && setShowOnboarding(false)}>
          <div className={`${styles.modal} ${styles.onboardingModal}`}>
            <div className={styles.modalHeader}>
              <div>
                <h3>Onboarding Path</h3>
                <p className={styles.modalSub}>EOS recommended reading order for new team members</p>
              </div>
              <button className={styles.modalClose} onClick={() => setShowOnboarding(false)}><MdClose /></button>
            </div>

            {pages.length === 0 ? (
              <p className={styles.emptyTree} style={{ margin: "16px 0" }}>Add pages to generate an onboarding path.</p>
            ) : (
              <div className={styles.onboardingList}>
                {onboardingPath.map((item, i) => {
                  const fc = FRESH_COLOR[item.freshness];
                  return (
                    <div key={item.page_id} className={styles.onboardingItem}>
                      <div className={styles.onboardingStep}>{i + 1}</div>
                      <div className={styles.onboardingContent}>
                        <div className={styles.onboardingItemTitle}>{item.title}</div>
                        <div className={styles.onboardingItemMeta}>
                          <span className={styles.onboardingTag}>{item.tag}</span>
                          <span>~{item.minutes} min</span>
                          <span style={{ color: fc }}>● {item.freshness}</span>
                        </div>
                      </div>
                      <div className={styles.onboardingScore} style={{ color: item.score >= 70 ? "var(--green)" : item.score >= 45 ? "var(--amber)" : "var(--red)" }}>{item.score}</div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className={styles.onboardingFooter}>
              <RiSparklingLine size={11} />
              <span>Path generated by EOS based on page structure and freshness</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   PAGE TREE ITEM
══════════════════════════════════════════════════════════ */
function PageTreeItem({ page, activeId, onSelect, depth }: {
  page: WikiPageType & { children?: WikiPageType[] };
  activeId: string | null;
  onSelect: (id: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = (page.children?.length ?? 0) > 0;
  const freshness = freshnessFromDate(page.updated_at);

  return (
    <div>
      <button
        className={`${styles.pageItem} ${page.id === activeId ? styles.pageItemActive : ""}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => onSelect(page.id)}
      >
        {hasChildren ? (
          <span className={styles.treeToggle}
            onClick={e => { e.stopPropagation(); setExpanded(!expanded); }}
            style={{ transform: expanded ? "rotate(90deg)" : "none" }}>
            <MdOutlineKeyboardArrowRight size={10} />
          </span>
        ) : (
          <span className={styles.treeLeaf}><FaCircle size={4} /></span>
        )}
        <span className={styles.freshDot} style={{ background: FRESH_COLOR[freshness] }} />
        <span className={styles.pageItemTitle}>{page.title}</span>
      </button>
      {expanded && page.children?.map(child => (
        <PageTreeItem key={child.id} page={child as any} activeId={activeId} onSelect={onSelect} depth={depth + 1} />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════ */
function buildTree(pages: WikiPageType[]): (WikiPageType & { children: WikiPageType[] })[] {
  const map = new Map<string, WikiPageType & { children: WikiPageType[] }>();
  pages.forEach(p => map.set(p.id, { ...p, children: [] }));
  const roots: (WikiPageType & { children: WikiPageType[] })[] = [];
  map.forEach(p => { if (p.parent_id && map.has(p.parent_id)) map.get(p.parent_id)!.children.push(p); else roots.push(p); });
  return roots;
}

function getBreadcrumbs(pages: WikiPageType[], pageId: string): WikiPageType[] {
  const map = new Map(pages.map(p => [p.id, p]));
  const crumbs: WikiPageType[] = [];
  let cur = map.get(pageId);
  while (cur) { crumbs.unshift(cur); cur = cur.parent_id ? map.get(cur.parent_id) : undefined; }
  return crumbs;
}
