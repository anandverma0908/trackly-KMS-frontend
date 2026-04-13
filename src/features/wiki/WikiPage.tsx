import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  fetchWikiSpaces, fetchWikiPages, fetchWikiPage,
  createWikiSpace, createWikiPage, updateWikiPage, deleteWikiPage,
  fetchWikiVersions, restoreWikiVersion,
} from "@/services/api";
import { useWikiStore } from "@/store";
import type { WikiPage as WikiPageType } from "@/types";
import PageEditor from "./PageEditor";
import RelatedDocsWidget from "./RelatedDocsWidget";
import styles from "./WikiPage.module.css";

const PAGE_TEMPLATES = [
  { name: "PRD",           icon: "📋", content: "# Product Requirements Document\n\n## Overview\n\n## Goals\n\n## Non-Goals\n\n## Requirements\n\n## Success Metrics" },
  { name: "Runbook",       icon: "🔧", content: "# Runbook\n\n## Purpose\n\n## Prerequisites\n\n## Steps\n\n1. Step one\n2. Step two\n\n## Troubleshooting" },
  { name: "Sprint Retro",  icon: "🔄", content: "# Sprint Retrospective\n\n## What Went Well ✅\n\n## What to Improve 🔧\n\n## Action Items 📝\n\n| Action | Owner | Due |" },
  { name: "Meeting Notes", icon: "📝", content: "# Meeting Notes\n\n**Date:** \n**Attendees:** \n\n## Agenda\n\n## Discussion\n\n## Action Items\n\n| Action | Owner | Due |" },
  { name: "ADR",           icon: "🏗️", content: "# Architecture Decision Record\n\n## Status\n\n## Context\n\n## Decision\n\n## Consequences" },
];

export default function WikiPage() {
  const qc = useQueryClient();
  const { activeSpaceId, activePageId, setActiveSpace, setActivePage } = useWikiStore();

  const [showNewSpace, setShowNewSpace]   = useState(false);
  const [newSpaceName, setNewSpaceName]   = useState("");
  const [showVersions, setShowVersions]   = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const { data: spaces = [] } = useQuery({
    queryKey: ["wiki-spaces"],
    queryFn: fetchWikiSpaces,
  });

  const { data: pages = [] } = useQuery({
    queryKey: ["wiki-pages", activeSpaceId],
    queryFn: () => fetchWikiPages(activeSpaceId ?? undefined),
    enabled: activeSpaceId !== null,
  });

  const { data: activePage } = useQuery({
    queryKey: ["wiki-page", activePageId],
    queryFn: () => fetchWikiPage(activePageId!),
    enabled: activePageId !== null,
  });

  const { data: versions = [] } = useQuery({
    queryKey: ["wiki-versions", activePageId],
    queryFn: () => fetchWikiVersions(activePageId!),
    enabled: activePageId !== null && showVersions,
  });

  // Auto-select first space
  useEffect(() => {
    if (spaces.length > 0 && activeSpaceId === null) {
      setActiveSpace(spaces[0].id);
    }
  }, [spaces, activeSpaceId, setActiveSpace]);

  const createSpaceMut = useMutation({
    mutationFn: () => createWikiSpace({ name: newSpaceName, description: "" }),
    onSuccess: (space) => {
      qc.invalidateQueries({ queryKey: ["wiki-spaces"] });
      setActiveSpace(space.id);
      setShowNewSpace(false);
      setNewSpaceName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createPageMut = useMutation({
    mutationFn: (payload: { title: string; content: string; parent_id?: number }) =>
      createWikiPage({ space_id: activeSpaceId!, ...payload }),
    onSuccess: (page) => {
      qc.invalidateQueries({ queryKey: ["wiki-pages", activeSpaceId] });
      setActivePage(page.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePageMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { title?: string; content?: string } }) =>
      updateWikiPage(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wiki-page", activePageId] });
      qc.invalidateQueries({ queryKey: ["wiki-pages", activeSpaceId] });
      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus("idle"), 3000);
    },
    onError: () => setAutoSaveStatus("idle"),
  });

  const deletePageMut = useMutation({
    mutationFn: (id: number) => deleteWikiPage(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wiki-pages", activeSpaceId] });
      setActivePage(null);
    },
  });

  const restoreMut = useMutation({
    mutationFn: ({ versionId }: { versionId: number }) =>
      restoreWikiVersion(activePageId!, versionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wiki-page", activePageId] });
      toast.success("Version restored");
      setShowVersions(false);
    },
  });

  const handleSave = useCallback((content: string, title: string) => {
    if (!activePageId) return;
    setAutoSaveStatus("saving");
    updatePageMut.mutate({ id: activePageId, payload: { content, title } });
  }, [activePageId, updatePageMut]);

  function handleNewPage(templateContent?: string) {
    const title = `New Page ${pages.length + 1}`;
    createPageMut.mutate({ title, content: templateContent ?? "" });
    setShowTemplates(false);
  }

  const activeSpace = spaces.find((s) => s.id === activeSpaceId);
  const treePages   = buildTree(pages);
  const breadcrumbs = getBreadcrumbs(pages, activePageId ?? 0);

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        {/* Spaces */}
        <div className={styles.spacesHeader}>
          <span className={styles.sidebarTitle}>Spaces</span>
          <button className={styles.addBtn} onClick={() => setShowNewSpace(true)} title="New Space">+</button>
        </div>

        {showNewSpace && (
          <div className={styles.newSpaceForm}>
            <input
              className="input input-sm"
              placeholder="Space name…"
              value={newSpaceName}
              onChange={(e) => setNewSpaceName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createSpaceMut.mutate(); if (e.key === "Escape") setShowNewSpace(false); }}
              autoFocus
            />
            <button className="btn btn-primary btn-sm" onClick={() => createSpaceMut.mutate()} disabled={!newSpaceName.trim()}>
              Create
            </button>
          </div>
        )}

        <div className={styles.spacesList}>
          {spaces.map((s) => (
            <button
              key={s.id}
              className={`${styles.spaceItem} ${s.id === activeSpaceId ? styles.spaceItemActive : ""}`}
              onClick={() => setActiveSpace(s.id)}
            >
              <span className={styles.spaceIcon}>📁</span>
              <span className={styles.spaceName}>{s.name}</span>
            </button>
          ))}
        </div>

        {/* Pages tree */}
        {activeSpaceId !== null && (
          <>
            <div className={styles.pagesHeader}>
              <span className={styles.sidebarTitle}>Pages</span>
              <button
                className={styles.addBtn}
                onClick={() => setShowTemplates(true)}
                title="New Page"
              >+</button>
            </div>

            <div className={styles.pageTree}>
              {treePages.map((p) => (
                <PageTreeItem
                  key={p.id}
                  page={p}
                  activeId={activePageId}
                  onSelect={setActivePage}
                  depth={0}
                />
              ))}
              {treePages.length === 0 && (
                <p className={styles.emptyTree}>No pages yet. Create one!</p>
              )}
            </div>
          </>
        )}
        {/* Related docs for active page */}
        {activePageId !== null && (
          <RelatedDocsWidget pageId={activePageId} onSelect={setActivePage} />
        )}
      </aside>

      {/* Main */}
      <main className={styles.main}>
        {activePage ? (
          <>
            {/* Breadcrumb */}
            <div className={styles.breadcrumb}>
              <span className={styles.breadcrumbPart}>{activeSpace?.name}</span>
              {breadcrumbs.map((b) => (
                <span key={b.id} className={styles.breadcrumbPart}>
                  <span className={styles.breadcrumbSep}>›</span>
                  <button
                    className={styles.breadcrumbLink}
                    onClick={() => setActivePage(b.id)}
                  >
                    {b.title}
                  </button>
                </span>
              ))}
            </div>

            {/* Page actions */}
            <div className={styles.pageActions}>
              <div className={styles.autoSave}>
                {autoSaveStatus === "saving" && <><span className={styles.savingDot} />Saving…</>}
                {autoSaveStatus === "saved"  && <><span className={styles.savedDot} />Saved</>}
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowVersions(!showVersions)}
              >
                History
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { if (confirm("Delete this page?")) deletePageMut.mutate(activePage.id); }}
              >
                Delete
              </button>
            </div>

            {/* Version history panel */}
            {showVersions && (
              <div className={styles.versionsPanel}>
                <div className={styles.versionsPanelTitle}>Version History</div>
                {versions.length === 0 && <p className={styles.emptyTree}>No versions saved yet.</p>}
                {versions.map((v) => (
                  <div key={v.id} className={styles.versionItem}>
                    <div>
                      <span className={styles.versionNum}>v{v.version}</span>
                      <span className={styles.versionAuthor}>{v.author}</span>
                      <span className={styles.versionDate}>{new Date(v.created_at).toLocaleString()}</span>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => restoreMut.mutate({ versionId: v.version })}
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Editor */}
            <PageEditor
              key={activePage.id}
              initialTitle={activePage.title}
              initialContent={activePage.content}
              onSave={handleSave}
              pages={pages}
            />
          </>
        ) : (
          <div className={styles.welcome}>
            <div className={styles.welcomeIcon}>📚</div>
            <h2 className={styles.welcomeTitle}>
              {activeSpaceId ? "Select a page" : "Select a space"}
            </h2>
            <p className={styles.welcomeDesc}>
              {activeSpaceId
                ? "Choose a page from the sidebar, or create a new one."
                : "Choose a space from the sidebar to get started."}
            </p>
            {activeSpaceId && (
              <button className="btn btn-primary" onClick={() => handleNewPage()}>
                + Create First Page
              </button>
            )}
          </div>
        )}
      </main>

      {/* Template Picker Modal */}
      {showTemplates && (
        <div className={styles.templateOverlay} onClick={(e) => e.target === e.currentTarget && setShowTemplates(false)}>
          <div className={styles.templateModal}>
            <div className={styles.templateHeader}>
              <h3>Choose a Template</h3>
              <button className={styles.closeBtn} onClick={() => setShowTemplates(false)}>✕</button>
            </div>
            <div className={styles.templateGrid}>
              <div className={styles.templateCard} onClick={() => handleNewPage()}>
                <span className={styles.templateIcon}>📄</span>
                <span className={styles.templateName}>Blank Page</span>
              </div>
              {PAGE_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.name}
                  className={styles.templateCard}
                  onClick={() => handleNewPage(tpl.content)}
                >
                  <span className={styles.templateIcon}>{tpl.icon}</span>
                  <span className={styles.templateName}>{tpl.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Page Tree Item ── */
function PageTreeItem({
  page, activeId, onSelect, depth,
}: {
  page: WikiPageType & { children?: WikiPageType[] };
  activeId: number | null;
  onSelect: (id: number) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = (page.children?.length ?? 0) > 0;

  return (
    <div className={styles.treeItem}>
      <button
        className={`${styles.pageItem} ${page.id === activeId ? styles.pageItemActive : ""}`}
        style={{ paddingLeft: 10 + depth * 14 }}
        onClick={() => onSelect(page.id)}
      >
        {hasChildren && (
          <span
            className={styles.treeToggle}
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            style={{ transform: expanded ? "rotate(90deg)" : "none" }}
          >›</span>
        )}
        {!hasChildren && <span className={styles.treeLeaf}>·</span>}
        <span className={styles.pageItemTitle}>{page.title}</span>
      </button>
      {expanded && page.children?.map((child) => (
        <PageTreeItem
          key={child.id}
          page={child as any}
          activeId={activeId}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

/* ── Helpers ── */
function buildTree(pages: WikiPageType[]): (WikiPageType & { children: WikiPageType[] })[] {
  const map = new Map<number, WikiPageType & { children: WikiPageType[] }>();
  pages.forEach((p) => map.set(p.id, { ...p, children: [] }));
  const roots: (WikiPageType & { children: WikiPageType[] })[] = [];
  map.forEach((p) => {
    if (p.parent_id && map.has(p.parent_id)) {
      map.get(p.parent_id)!.children.push(p);
    } else {
      roots.push(p);
    }
  });
  return roots;
}

function getBreadcrumbs(pages: WikiPageType[], pageId: number): WikiPageType[] {
  const map = new Map(pages.map((p) => [p.id, p]));
  const crumbs: WikiPageType[] = [];
  let cur = map.get(pageId);
  while (cur) {
    crumbs.unshift(cur);
    cur = cur.parent_id ? map.get(cur.parent_id) : undefined;
  }
  return crumbs;
}
