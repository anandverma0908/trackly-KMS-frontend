import { useEffect, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import Placeholder from "@tiptap/extension-placeholder";
import { RiSparklingLine, RiCloseLine } from "react-icons/ri";
import { novaGenerate, postWikiAwareness, fetchWikiAwareness } from "@/services/api";
import { useAuthStore } from "@/features/auth/useAuthStore";
import { TicketLinkExtension } from "./extensions/TicketLinkExtension";
import { PageLinkExtension } from "./extensions/PageLinkExtension";
import type { WikiPage } from "@/types";
import styles from "./PageEditor.module.css";

/* ── AI command actions ──────────────────────────────────────────────────── */
const AI_ACTIONS = [
  { id: "continue",    label: "Continue writing",       icon: "✦" },
  { id: "improve",     label: "Improve this",           icon: "✨" },
  { id: "runbook",     label: "Convert to runbook",     icon: "📋" },
  { id: "summarize",   label: "Summarize",              icon: "📝" },
  { id: "actions",     label: "Generate action items",  icon: "☑" },
  { id: "nontechnical",label: "Make non-technical",     icon: "👥" },
] as const;
type AiActionId = (typeof AI_ACTIONS)[number]["id"];

function buildAiPrompt(action: AiActionId, context: string, pageTitle: string): string {
  switch (action) {
    case "continue":
      return `You are a technical writer. Continue writing the following wiki page content for "${pageTitle}". Add 1-2 coherent paragraphs in the same style. Return only the new content (no intro, no heading):\n\n${context}`;
    case "improve":
      return `Improve the following wiki text for clarity and conciseness. Keep it technical and precise. Return only the improved text:\n\n${context}`;
    case "runbook":
      return `Convert the following documentation into a step-by-step runbook. Include: Prerequisites, Steps (numbered), Verification, and Rollback. Use markdown:\n\n${context}`;
    case "summarize":
      return `Write a concise 2-3 sentence TL;DR summary of the following wiki content. Start with the most important point:\n\n${context}`;
    case "actions":
      return `Extract all action items from the following content as a markdown checklist (- [ ] format). Group by owner if mentioned:\n\n${context}`;
    case "nontechnical":
      return `Rewrite the following technical documentation so a non-technical stakeholder can understand it. Avoid jargon, use plain language:\n\n${context}`;
  }
}

interface Props {
  initialTitle:   string;
  initialContent: string;
  onSave:         (content: string, title: string) => void;
  pages?:         WikiPage[];
  pageId?:        string;
}

const AUTO_SAVE_DELAY = 30_000;

export default function PageEditor({ initialTitle, initialContent, onSave, pages = [], pageId }: Props) {
  const [title, setTitle]   = useState(initialTitle);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ticket link insert state
  const [showTicketInput, setShowTicketInput] = useState(false);
  const [ticketKeyInput, setTicketKeyInput]   = useState("");

  // Page link insert state
  const [showPagePicker, setShowPagePicker]   = useState(false);
  const [pageSearch, setPageSearch]           = useState("");

  // /ai command state
  const [aiMenu, setAiMenu]       = useState<{ top: number; left: number } | null>(null);
  const aiMenuOpenRef             = useRef(false);
  const [aiTriggerPos, setAiTriggerPos] = useState<number>(0);
  const [aiLoading, setAiLoading] = useState(false);
  const aiMenuRef = useRef<HTMLDivElement>(null);

  // Live co-editing awareness
  const { user } = useAuthStore();
  const [activeUsers, setActiveUsers] = useState<Array<{ user_id: string; name: string; color: string }>>([]);
  const awarenessRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const USER_COLORS = ["#f59e0b", "#10B981", "#F59E0B", "#F43F5E", "#8B5CF6", "#06B6D4", "#EC4899", "#84CC16"];
  const myColor = USER_COLORS[(user?.name?.length ?? 0) % USER_COLORS.length];

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Link.configure({ openOnClick: false }),
      Image,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: "Start writing… Type /ai for EOS AI assistance, or use toolbar to insert links" }),
      TicketLinkExtension,
      PageLinkExtension,
    ],
    content: initialContent || "",
    onUpdate: ({ editor: ed }) => {
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
      autoSaveRef.current = setTimeout(() => {
        onSave(ed?.getHTML() ?? "", title);
      }, AUTO_SAVE_DELAY);

      // Detect /ai command
      const { from } = ed.state.selection;
      const textBefore = ed.state.doc.textBetween(Math.max(0, from - 3), from);
      if (textBefore === "/ai") {
        const coords = ed.view.coordsAtPos(from);
        const editorDom = ed.view.dom as HTMLElement;
        const editorRect = editorDom.closest(`.${styles.editor}`)?.getBoundingClientRect();
        setAiTriggerPos(from);
        setAiMenu({
          top: coords.bottom - (editorRect?.top ?? 0) + 8,
          left: coords.left - (editorRect?.left ?? 0),
        });
        aiMenuOpenRef.current = true;
      } else if (aiMenuOpenRef.current) {
        setAiMenu(null);
        aiMenuOpenRef.current = false;
      }
    },
  });

  useEffect(() => {
    return () => {
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        onSave(editor?.getHTML() ?? "", title);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editor, title, onSave]);

  /* ── Live co-editing awareness ── */
  useEffect(() => {
    if (!pageId || !user) return;
    let cancelled = false;

    async function poll() {
      if (cancelled || !pageId || !user) return;
      try {
        const data = await fetchWikiAwareness(pageId);
        setActiveUsers(data.filter((u) => u.user_id !== user.id).map((u) => ({
          user_id: u.user_id,
          name: u.name,
          color: u.color,
        })));
      } catch {
        /* ignore awareness errors */
      }
    }

    poll();
    const interval = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [pageId, user]);

  useEffect(() => {
    if (!editor || !pageId || !user) return;

    const handler = () => {
      const { from } = editor.state.selection;
      if (awarenessRef.current) clearTimeout(awarenessRef.current);
      awarenessRef.current = setTimeout(() => {
        postWikiAwareness(pageId, {
          user_id: user.id,
          name: user.name,
          color: myColor,
          cursor: from,
        }).catch(() => {});
      }, 500);
    };

    editor.on("selectionUpdate", handler);
    return () => { editor.off("selectionUpdate", handler); };
  }, [editor, pageId, user, myColor]);

  const handleAiAction = useCallback(async (actionId: AiActionId) => {
    if (!editor) return;
    setAiMenu(null);
    setAiLoading(true);

    // Delete the /ai trigger text (3 chars)
    editor.chain().focus().deleteRange({ from: aiTriggerPos - 3, to: aiTriggerPos }).run();

    // Get full page content as context
    const pageText = editor.getText();
    const prompt = buildAiPrompt(actionId, pageText || `Wiki page: ${title}`, title);

    try {
      const content = await novaGenerate(prompt);
      editor.chain().focus().insertContent(content || "Could not generate content.").run();
    } catch {
      editor.chain().focus().insertContent("[EOS could not generate content]").run();
    } finally {
      setAiLoading(false);
    }
  }, [editor, aiTriggerPos, title]);

  function handleInsertTicket() {
    const key = ticketKeyInput.trim().toUpperCase();
    if (!key || !editor) return;
    editor.chain().focus().insertTicketLink(key).run();
    setTicketKeyInput("");
    setShowTicketInput(false);
  }

  function handleInsertPage(page: WikiPage) {
    if (!editor) return;
    editor.chain().focus().insertPageLink(page.id, page.title).run();
    setShowPagePicker(false);
    setPageSearch("");
  }

  const filteredPages = pages.filter((p) =>
    p.title.toLowerCase().includes(pageSearch.toLowerCase())
  );

  if (!editor) return null;

  return (
    <div className={styles.editor}>
      {/* Active Users Bar */}
      {pageId && (
        <div className={styles.awarenessBar}>
          {activeUsers.length === 0 ? (
            <span className={styles.awarenessOnlyYou}>Only you are editing</span>
          ) : (
            <div className={styles.awarenessList}>
              {activeUsers.map((u) => (
                <span key={u.user_id} className={styles.awarenessUser}>
                  <span className={styles.awarenessDot} style={{ background: u.color }} />
                  {u.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Title */}
      <input
        className={styles.titleInput}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Untitled Page"
      />

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <ToolbarGroup>
          <ToolBtn
            label="B"
            bold
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold (Ctrl+B)"
          />
          <ToolBtn
            label="I"
            italic
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic (Ctrl+I)"
          />
          <ToolBtn
            label="S"
            strike
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Strikethrough"
          />
          <ToolBtn
            label={<code className={styles.codeLabel}>`</code>}
            active={editor.isActive("code")}
            onClick={() => editor.chain().focus().toggleCode().run()}
            title="Inline code"
          />
        </ToolbarGroup>

        <div className={styles.sep} />

        <ToolbarGroup>
          <ToolBtn label="H1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} />
          <ToolBtn label="H2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
          <ToolBtn label="H3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
        </ToolbarGroup>

        <div className={styles.sep} />

        <ToolbarGroup>
          <ToolBtn label="• List"  active={editor.isActive("bulletList")}  onClick={() => editor.chain().focus().toggleBulletList().run()} />
          <ToolBtn label="1. List" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
          <ToolBtn label="☑ Tasks" active={editor.isActive("taskList")}    onClick={() => editor.chain().focus().toggleTaskList().run()} />
        </ToolbarGroup>

        <div className={styles.sep} />

        <ToolbarGroup>
          <ToolBtn label="❝ Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
          <ToolBtn label="⎯ Rule"  active={false}                          onClick={() => editor.chain().focus().setHorizontalRule().run()} />
          <ToolBtn
            label="⊞ Table"
            active={editor.isActive("table")}
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          />
        </ToolbarGroup>

        <div className={styles.sep} />

        {/* Ticket Link */}
        <div className={styles.insertGroup}>
          <ToolBtn
            label="🎫 Ticket"
            active={showTicketInput}
            onClick={() => { setShowTicketInput(!showTicketInput); setShowPagePicker(false); }}
            title="Insert Ticket Link"
          />
          {showTicketInput && (
            <div className={styles.insertPopover}>
              <input
                className={`input input-sm ${styles.insertInput}`}
                placeholder="e.g. DPAI-123"
                value={ticketKeyInput}
                onChange={(e) => setTicketKeyInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleInsertTicket(); if (e.key === "Escape") setShowTicketInput(false); }}
                autoFocus
              />
              <button className="btn btn-primary btn-sm" onClick={handleInsertTicket} disabled={!ticketKeyInput.trim()}>
                Insert
              </button>
            </div>
          )}
        </div>

        {/* Page Link */}
        <div className={styles.insertGroup}>
          <ToolBtn
            label="📄 Page"
            active={showPagePicker}
            onClick={() => { setShowPagePicker(!showPagePicker); setShowTicketInput(false); }}
            title="Insert Page Link"
          />
          {showPagePicker && (
            <div className={styles.insertPopover}>
              <input
                className={`input input-sm ${styles.insertInput}`}
                placeholder="Search pages…"
                value={pageSearch}
                onChange={(e) => setPageSearch(e.target.value)}
                autoFocus
              />
              <div className={styles.pagePickerList}>
                {filteredPages.length === 0 && (
                  <div className={styles.pagePickerEmpty}>No pages found</div>
                )}
                {filteredPages.map((p) => (
                  <button
                    key={p.id}
                    className={styles.pagePickerItem}
                    onClick={() => handleInsertPage(p)}
                  >
                    📄 {p.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={styles.spacer} />

        <button
          className={styles.saveBtn}
          onClick={() => onSave(editor.getHTML(), title)}
          title="Save (Ctrl+S)"
        >
          Save
        </button>
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} className={styles.content} />

      {/* /ai command menu */}
      {aiMenu && (
        <div
          ref={aiMenuRef}
          className={styles.aiMenu}
          style={{ top: aiMenu.top, left: aiMenu.left }}
        >
          <div className={styles.aiMenuHeader}>
            <RiSparklingLine size={11} />
            <span>EOS AI Assistant</span>
            <button className={styles.aiMenuClose} onClick={() => { setAiMenu(null); aiMenuOpenRef.current = false; }}>
              <RiCloseLine size={13} />
            </button>
          </div>
          {AI_ACTIONS.map((action) => (
            <button
              key={action.id}
              className={styles.aiMenuItem}
              onClick={() => handleAiAction(action.id)}
            >
              <span className={styles.aiMenuItemIcon}>{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* AI loading overlay indicator */}
      {aiLoading && (
        <div className={styles.aiLoadingBar}>
          <RiSparklingLine size={11} />
          EOS is writing…
        </div>
      )}
    </div>
  );
}

function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return <div className={styles.toolbarGroup}>{children}</div>;
}

function ToolBtn({
  label, active, onClick, title, bold, italic, strike,
}: {
  label: React.ReactNode;
  active: boolean;
  onClick: () => void;
  title?: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
}) {
  return (
    <button
      className={`${styles.toolBtn} ${active ? styles.toolBtnActive : ""}`}
      onClick={onClick}
      title={title}
      style={{
        fontWeight: bold ? 700 : undefined,
        fontStyle:  italic ? "italic" : undefined,
        textDecoration: strike ? "line-through" : undefined,
      }}
    >
      {label}
    </button>
  );
}
