import { type ClipboardEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { citationFootnotes, parseNoteMarkdown, serializeNoteFrontmatter } from "../lib/documents";
import type { DocumentBacklink, KnowledgeDocument, NoteMetadata, SaveState } from "../lib/types";
import { NoteBacklinks } from "./NoteBacklinks";

interface NoteEditorProps {
  backlinks: DocumentBacklink[];
  backlinksLoading: boolean;
  documents: KnowledgeDocument[];
  loading: boolean;
  markdown: string;
  metadata: NoteMetadata | null;
  saveState: SaveState;
  title: string;
  onMarkdownChange: (markdown: string) => void;
  onPasteImage: (file: File) => Promise<string>;
  onSave: () => void;
  onTitleChange: (title: string) => void;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderInline(value: string) {
  return escapeHtml(value)
    .replace(/!\[([^\]]*)\]\((attachments\/images\/[^)]+)\)/g, (_match: string, alt: string, src: string) => {
      const name = src.split("/").at(-1) ?? "";
      return `<img alt="${escapeHtml(alt)}" src="/api/notes/attachments/images/${encodeURIComponent(name)}" />`;
    })
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match: string, target: string, label: string | undefined) => {
      const text = label || target;
      return `<span class="wiki-link">${escapeHtml(text)}</span>`;
    })
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function highlightCode(value: string) {
  return escapeHtml(value)
    .replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g, '<span class="code-token string">$1</span>')
    .replace(/(\/\/.*$|#.*$)/gm, '<span class="code-token comment">$1</span>')
    .replace(/\b(const|let|var|function|return|if|else|for|while|class|import|from|export|type|interface|async|await|try|catch|new|true|false|null|undefined)\b/g, '<span class="code-token keyword">$1</span>')
    .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="code-token number">$1</span>');
}

function renderMarkdown(markdown: string, documents: KnowledgeDocument[]) {
  const parsed = parseNoteMarkdown(markdown);
  const body = parsed.body.trim();
  const citations = citationFootnotes(body, documents);
  const source = citations ? `${body}\n\n${citations}` : body;
  const lines = source.split("\n");
  const html: string[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  let listType: "ul" | "ol" | null = null;

  function closeList() {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = null;
  }

  for (const line of lines) {
    if (line.startsWith("```")) {
      closeList();
      if (inCode) {
        html.push(`${highlightCode(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
      } else {
        html.push("<pre><code>");
      }
      inCode = !inCode;
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    if (unordered) {
      if (listType !== "ul") {
        closeList();
        html.push("<ul>");
        listType = "ul";
      }
      html.push(`<li>${renderInline(unordered[1] ?? "")}</li>`);
      continue;
    }

    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ordered) {
      if (listType !== "ol") {
        closeList();
        html.push("<ol>");
        listType = "ol";
      }
      html.push(`<li>${renderInline(ordered[1] ?? "")}</li>`);
      continue;
    }

    closeList();
    if (line.startsWith("### ")) html.push(`<h3>${renderInline(line.slice(4))}</h3>`);
    else if (line.startsWith("## ")) html.push(`<h2>${renderInline(line.slice(3))}</h2>`);
    else if (line.startsWith("# ")) html.push(`<h1>${renderInline(line.slice(2))}</h1>`);
    else if (line.startsWith("> ")) html.push(`<blockquote>${renderInline(line.slice(2))}</blockquote>`);
    else if (line.startsWith("[^")) html.push(`<p class="note-footnote">${renderInline(line)}</p>`);
    else html.push(`<p>${renderInline(line)}</p>`);
  }

  closeList();
  if (inCode) html.push(`${highlightCode(codeLines.join("\n"))}</code></pre>`);
  return html.join("\n");
}

export function NoteEditor({
  backlinks,
  backlinksLoading,
  documents,
  loading,
  markdown,
  metadata,
  saveState,
  title,
  onMarkdownChange,
  onPasteImage,
  onSave,
  onTitleChange,
}: NoteEditorProps) {
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const rendered = useMemo(() => renderMarkdown(markdown, documents), [documents, markdown]);
  const body = useMemo(() => parseNoteMarkdown(markdown).body, [markdown]);

  useEffect(() => {
    if (!editingTitle) setDraftTitle(title);
  }, [editingTitle, title]);

  useEffect(() => {
    if (!editingTitle) return;
    titleRef.current?.focus();
    titleRef.current?.select();
  }, [editingTitle]);

  function updateBody(nextBody: string) {
    if (!metadata) return;
    onMarkdownChange(`${serializeNoteFrontmatter(metadata)}${nextBody}`);
  }

  function updateBodyWithSelection(nextBody: string, selectionStart: number, selectionEnd = selectionStart) {
    updateBody(nextBody);
    window.requestAnimationFrame(() => {
      const input = textRef.current;
      if (!input) return;
      input.selectionStart = selectionStart;
      input.selectionEnd = selectionEnd;
      input.focus();
    });
  }

  async function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const image = Array.from(event.clipboardData.files).find((file) => file.type.startsWith("image/"));
    if (!image) return;
    event.preventDefault();
    const markdownPath = await onPasteImage(image);
    const input = textRef.current;
    const insertion = `![${image.name || "image"}](${markdownPath})`;
    if (!input) {
      updateBody(`${body}\n${insertion}`);
      return;
    }
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const next = `${body.slice(0, start)}${insertion}${body.slice(end)}`;
    updateBody(next);
    window.requestAnimationFrame(() => {
      input.selectionStart = start + insertion.length;
      input.selectionEnd = start + insertion.length;
      input.focus();
    });
  }

  function commitTitle() {
    const nextTitle = draftTitle.trim();
    if (nextTitle && nextTitle !== title) onTitleChange(nextTitle);
    setEditingTitle(false);
  }

  function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitTitle();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setDraftTitle(title);
      setEditingTitle(false);
    }
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const input = event.currentTarget;
    const start = input.selectionStart;
    const end = input.selectionEnd;

    if (event.key === "Tab") {
      event.preventDefault();
      const indent = "    ";
      const next = `${body.slice(0, start)}${indent}${body.slice(end)}`;
      updateBodyWithSelection(next, start + indent.length);
      return;
    }

    const pairs: Record<string, string> = {
      "(": ")",
      "[": "]",
      "{": "}",
      '"': '"',
      "`": "`",
    };
    const closer = pairs[event.key];
    if (closer) {
      event.preventDefault();
      const selected = body.slice(start, end);
      const next = `${body.slice(0, start)}${event.key}${selected}${closer}${body.slice(end)}`;
      updateBodyWithSelection(next, start + 1, end + 1);
      return;
    }

    if ((event.key === ")" || event.key === "]" || event.key === "}" || event.key === '"' || event.key === "`") && body.at(start) === event.key) {
      event.preventDefault();
      updateBodyWithSelection(body, start + 1);
    }
  }

  if (loading || !metadata) {
    return (
      <section className="note-workspace">
        <div className="empty">
          <p>Loading note...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="note-workspace">
      <div className="note-head">
        <div>
          <div className="note-kicker">Note mode</div>
          {editingTitle ? (
            <input
              ref={titleRef}
              className="note-title-input"
              value={draftTitle}
              onBlur={commitTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onKeyDown={handleTitleKeyDown}
            />
          ) : (
            <h1 title="Double-click to rename" onDoubleClick={() => setEditingTitle(true)}>
              {title}
            </h1>
          )}
        </div>
        <div className={`note-save-state ${saveState}`}>
          <span>{saveState === "dirty" ? "Unsaved" : saveState === "saving" ? "Saving..." : saveState === "error" ? "Save failed" : "Saved"}</span>
          <button className="btn-ghost" disabled={saveState === "saving"} onClick={onSave}>
            Save
          </button>
        </div>
      </div>
      <div className="note-editor-grid">
        <textarea
          ref={textRef}
          className="note-markdown-input"
          spellCheck
          value={body}
          onChange={(event) => updateBody(event.target.value)}
          onKeyDown={handleEditorKeyDown}
          onPaste={(event) => void handlePaste(event)}
        />
        <div className="note-rendered-wrap">
          <article className="note-rendered" dangerouslySetInnerHTML={{ __html: rendered }} />
          <NoteBacklinks backlinks={backlinks} loading={backlinksLoading} />
        </div>
      </div>
    </section>
  );
}
