import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import Placeholder from "@tiptap/extension-placeholder";
import { TicketLinkExtension } from "./extensions/TicketLinkExtension";
import { PageLinkExtension } from "./extensions/PageLinkExtension";
import type { WikiPage } from "@/types";
import styles from "./PageEditor.module.scss";

interface Props {
  initialTitle:   string;
  initialContent: string;
  onSave:         (content: string, title: string) => void;
  pages?:         WikiPage[];
}

const AUTO_SAVE_DELAY = 30_000;

export default function PageEditor({ initialTitle, initialContent, onSave, pages = [] }: Props) {
  const [title, setTitle]   = useState(initialTitle);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ticket link insert state
  const [showTicketInput, setShowTicketInput] = useState(false);
  const [ticketKeyInput, setTicketKeyInput]   = useState("");

  // Page link insert state
  const [showPagePicker, setShowPagePicker]   = useState(false);
  const [pageSearch, setPageSearch]           = useState("");

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
      Placeholder.configure({ placeholder: "Start writing… Use toolbar to insert ticket or page links" }),
      TicketLinkExtension,
      PageLinkExtension,
    ],
    content: initialContent || "",
    onUpdate: () => {
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
      autoSaveRef.current = setTimeout(() => {
        onSave(editor?.getHTML() ?? "", title);
      }, AUTO_SAVE_DELAY);
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
