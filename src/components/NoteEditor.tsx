import { type ClipboardEvent, type CSSProperties, type KeyboardEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { parseNoteMarkdown, serializeNoteFrontmatter, wikiLinkTargets } from "../lib/documents";
import type { KnowledgeDocument, NoteMetadata, SaveState } from "../lib/types";
import { LinkPreviewBubble, type PreviewTarget } from "./LinkPreviewBubble";

interface NoteEditorProps {
  documents: KnowledgeDocument[];
  loading: boolean;
  markdown: string;
  metadata: NoteMetadata | null;
  saveState: SaveState;
  title: string;
  onMarkdownChange: (markdown: string) => void;
  onOpenExternal: () => void;
  onPasteImage: (file: File) => Promise<string>;
  onReferenceOpen: (document: KnowledgeDocument) => void;
  onSave: () => void;
  onTitleChange: (title: string) => void;
}

interface BacklinkMatch {
  exact: boolean;
  query: string;
  start: number;
}

interface SuggestionPosition {
  left: number;
  top: number;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderEditorHighlights(value: string) {
  return escapeHtml(value).replace(/\[\[([^\]]+)\]\]/g, (_match: string, inner: string) => `[[<span class="editor-wiki-link">${inner}</span>]]`);
}

function findDocumentForHref(href: string, documents: KnowledgeDocument[]) {
  const normalizedHref = href.trim().toLowerCase();
  return documents.find((doc) => doc.source.trim().toLowerCase() === normalizedHref || doc.title.trim().toLowerCase() === normalizedHref);
}

function renderInline(value: string, documents: KnowledgeDocument[]) {
  const html = escapeHtml(value)
    .replace(/!\[([^\]]*)\]\((attachments\/images\/[^)]+)\)/g, (_match: string, alt: string, src: string) => {
      const name = src.split("/").at(-1) ?? "";
      return `<img alt="${escapeHtml(alt)}" src="/api/notes/attachments/images/${encodeURIComponent(name)}" />`;
    })
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match: string, target: string, label: string | undefined) => {
      const text = label || target;
      const document = documents.find((doc) => doc.title.toLowerCase() === target.trim().toLowerCase());
      if (!document) return `<span class="wiki-link">${escapeHtml(text)}</span>`;
      return `<button class="wiki-link" type="button" data-doc-id="${document.id}">${escapeHtml(text)}</button>`;
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match: string, label: string, href: string) => {
      const document = findDocumentForHref(href, documents);
      if (document) return `<button class="wiki-link" type="button" data-doc-id="${document.id}">${label}</button>`;
      if (/^https?:\/\//i.test(href)) return `<a href="${href}" target="_blank" rel="noreferrer">${label}</a>`;
      return `<a href="${href}">${label}</a>`;
    })
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noreferrer">$2</a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return html;
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
  const lines = body.split("\n");
  const html: string[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let paragraphLines: string[] = [];

  function closeList() {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = null;
  }

  function closeParagraph() {
    if (!paragraphLines.length) return;
    html.push(`<p>${paragraphLines.map((line) => renderInline(line, documents)).join("<br />")}</p>`);
    paragraphLines = [];
  }

  for (const line of lines) {
    if (line.startsWith("```")) {
      closeParagraph();
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
      closeParagraph();
      closeList();
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    if (unordered) {
      closeParagraph();
      if (listType !== "ul") {
        closeList();
        html.push("<ul>");
        listType = "ul";
      }
      html.push(`<li>${renderInline(unordered[1] ?? "", documents)}</li>`);
      continue;
    }

    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ordered) {
      closeParagraph();
      if (listType !== "ol") {
        closeList();
        html.push("<ol>");
        listType = "ol";
      }
      html.push(`<li>${renderInline(ordered[1] ?? "", documents)}</li>`);
      continue;
    }

    closeList();
    if (line.startsWith("### ")) {
      closeParagraph();
      html.push(`<h3>${renderInline(line.slice(4), documents)}</h3>`);
    } else if (line.startsWith("## ")) {
      closeParagraph();
      html.push(`<h2>${renderInline(line.slice(3), documents)}</h2>`);
    } else if (line.startsWith("# ")) {
      closeParagraph();
      html.push(`<h1>${renderInline(line.slice(2), documents)}</h1>`);
    } else if (line.startsWith("> ")) {
      closeParagraph();
      html.push(`<blockquote>${renderInline(line.slice(2), documents)}</blockquote>`);
    } else if (line.startsWith("[^")) {
      closeParagraph();
      html.push(`<p class="note-footnote">${renderInline(line, documents)}</p>`);
    } else {
      paragraphLines.push(line);
    }
  }

  closeParagraph();
  closeList();
  if (inCode) html.push(`${highlightCode(codeLines.join("\n"))}</code></pre>`);
  const cited = documents.filter((doc) => wikiLinkTargets(body).some((target) => target.toLowerCase() === doc.title.toLowerCase()));
  if (cited.length) {
    html.push('<section class="note-citations"><div class="note-citations-title">Citations</div>');
    cited.forEach((doc, index) => {
      html.push(
        `<button class="note-citation" type="button" data-doc-id="${doc.id}"><span class="note-citation-index">${index + 1}</span><span class="note-citation-main"><strong>${escapeHtml(doc.title)}</strong><small>${escapeHtml(doc.source || doc.type)}</small></span><span class="note-citation-type">${escapeHtml(doc.type)}</span></button>`,
      );
    });
    html.push("</section>");
  }
  return html.join("\n");
}

function backlinkMatch(value: string, cursor: number): BacklinkMatch | null {
  const beforeCursor = value.slice(0, cursor);
  const openIndex = beforeCursor.lastIndexOf("[[");
  if (openIndex === -1) return null;
  const closeIndex = beforeCursor.lastIndexOf("]]");
  if (closeIndex > openIndex) return null;
  const lineEnd = value.indexOf("\n", cursor);
  const afterCursor = value.slice(cursor, lineEnd === -1 ? value.length : lineEnd);
  const query = beforeCursor.slice(openIndex + 2);
  if (query.includes("\n") || query.includes("[")) return null;
  const closeAfterCursor = afterCursor.indexOf("]]");
  const exact = closeAfterCursor !== -1;
  const completedQuery = exact ? `${query}${afterCursor.slice(0, closeAfterCursor)}` : query;
  return { exact, query: completedQuery, start: openIndex };
}

function completedBacklinkAtCursor(value: string, cursor: number): string | null {
  const lineStart = value.lastIndexOf("\n", cursor - 1) + 1;
  const nextLine = value.indexOf("\n", cursor);
  const lineEnd = nextLine === -1 ? value.length : nextLine;
  const line = value.slice(lineStart, lineEnd);
  const localCursor = cursor - lineStart;
  for (const match of line.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (localCursor >= start && localCursor <= end) return match[1]?.trim() ?? null;
  }
  return null;
}

export function NoteEditor({
  documents,
  loading,
  markdown,
  metadata,
  saveState,
  title,
  onMarkdownChange,
  onOpenExternal,
  onPasteImage,
  onReferenceOpen,
  onSave,
  onTitleChange,
}: NoteEditorProps) {
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const hitLayerRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef("");
  const historyRef = useRef<string[]>([""]);
  const historyIndexRef = useRef(0);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [renderEnabled, setRenderEnabled] = useState(true);
  const [backlinkQuery, setBacklinkQuery] = useState<BacklinkMatch | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [suggestionPosition, setSuggestionPosition] = useState<SuggestionPosition>({ left: 22, top: 48 });
  const [linkPreview, setLinkPreview] = useState<{ target: PreviewTarget; x: number; y: number } | null>(null);
  const rendered = useMemo(() => renderMarkdown(markdown, documents), [documents, markdown]);
  const body = useMemo(() => parseNoteMarkdown(markdown).body, [markdown]);
  const editorHighlights = useMemo(() => renderEditorHighlights(body), [body]);
  const backlinkSuggestions = useMemo(() => {
    if (!backlinkQuery) return [];
    const query = backlinkQuery.query.trim().toLowerCase();
    if (backlinkQuery.exact && documents.some((doc) => doc.title.toLowerCase() === query)) return [];
    return documents
      .filter((doc) => doc.title !== title)
      .filter((doc) => !query || doc.title.toLowerCase().includes(query) || doc.tags.some((tag) => tag.toLowerCase().includes(query)))
      .slice(0, 4);
  }, [backlinkQuery, documents, title]);

  useEffect(() => {
    bodyRef.current = body;
    if (historyRef.current.length === 1 && historyRef.current[0] === "") {
      historyRef.current = [body];
      historyIndexRef.current = 0;
    }
  }, [body]);

  useEffect(() => {
    if (!editingTitle) setDraftTitle(title);
  }, [editingTitle, title]);

  useEffect(() => {
    if (!editingTitle) return;
    titleRef.current?.focus();
    titleRef.current?.select();
  }, [editingTitle]);

  useEffect(() => {
    setActiveSuggestion(0);
  }, [backlinkQuery?.query, backlinkQuery?.start]);

  useEffect(() => {
    function handleGlobalMouseMove(event: globalThis.MouseEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        setLinkPreview(null);
        return;
      }
      const link = target.closest<HTMLElement>(
        ".editor-wiki-link, .wiki-link[data-doc-id], .note-citation[data-doc-id], a[href]",
      );
      if (!link) setLinkPreview(null);
    }
    window.addEventListener("mousemove", handleGlobalMouseMove);
    return () => window.removeEventListener("mousemove", handleGlobalMouseMove);
  }, []);

  function updateBody(nextBody: string) {
    if (!metadata) return;
    onMarkdownChange(`${serializeNoteFrontmatter(metadata)}${nextBody}`);
  }

  function rememberCurrentBody() {
    const current = bodyRef.current;
    const history = historyRef.current.slice(0, historyIndexRef.current + 1);
    if (history.at(-1) !== current) history.push(current);
    historyRef.current = history.slice(-120);
    historyIndexRef.current = historyRef.current.length - 1;
  }

  function applyBody(nextBody: string, selectionStart: number, selectionEnd = selectionStart, record = true) {
    if (record) rememberCurrentBody();
    bodyRef.current = nextBody;
    updateBody(nextBody);
    window.requestAnimationFrame(() => {
      const input = textRef.current;
      if (!input) return;
      input.selectionStart = selectionStart;
      input.selectionEnd = selectionEnd;
      input.focus();
      setBacklinkQuery(backlinkMatch(nextBody, selectionStart));
      setSuggestionPosition(caretPosition(input, selectionStart));
    });
  }

  function caretPosition(input: HTMLTextAreaElement, cursor: number): SuggestionPosition {
    const wrap = input.closest<HTMLElement>(".note-input-wrap");
    const inputRect = input.getBoundingClientRect();
    const wrapRect = wrap?.getBoundingClientRect() ?? inputRect;
    const computed = window.getComputedStyle(input);
    const mirror = document.createElement("div");
    const marker = document.createElement("span");
    const lineHeight = Number.parseFloat(computed.lineHeight) || 22;
    const paddingLeft = Number.parseFloat(computed.paddingLeft) || 0;
    const paddingTop = Number.parseFloat(computed.paddingTop) || 0;
    const maxLeft = Math.max(paddingLeft, input.clientWidth - 232);
    const maxTop = Math.max(paddingTop, input.clientHeight - 148);

    mirror.style.position = "fixed";
    mirror.style.left = `${inputRect.left}px`;
    mirror.style.top = `${inputRect.top}px`;
    mirror.style.width = `${input.clientWidth}px`;
    mirror.style.height = `${input.clientHeight}px`;
    mirror.style.padding = computed.padding;
    mirror.style.border = computed.border;
    mirror.style.boxSizing = computed.boxSizing;
    mirror.style.font = computed.font;
    mirror.style.letterSpacing = computed.letterSpacing;
    mirror.style.lineHeight = computed.lineHeight;
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.overflowWrap = "break-word";
    mirror.style.visibility = "hidden";
    mirror.style.pointerEvents = "none";
    mirror.textContent = input.value.slice(0, cursor);
    marker.textContent = "\u200b";
    mirror.append(marker);
    document.body.append(mirror);

    const markerRect = marker.getBoundingClientRect();
    mirror.remove();

    const rawLeft = markerRect.left - wrapRect.left - input.scrollLeft;
    const rawTop = markerRect.top - wrapRect.top - input.scrollTop;
    const fitsBelow = rawTop + lineHeight + 144 <= input.clientHeight;
    const top = fitsBelow ? rawTop + lineHeight + 6 : rawTop - 144;

    return {
      left: Math.min(maxLeft, Math.max(paddingLeft, rawLeft)),
      top: Math.min(maxTop, Math.max(paddingTop, top)),
    };
  }

  function updateBacklinkQuery() {
    const input = textRef.current;
    if (!input) return;
    setBacklinkQuery(backlinkMatch(bodyRef.current, input.selectionStart));
    setSuggestionPosition(caretPosition(input, input.selectionStart));
  }

  function syncHighlightScroll() {
    const input = textRef.current;
    const highlight = highlightRef.current;
    const hitLayer = hitLayerRef.current;
    if (!input) return;
    const x = `${input.scrollLeft}px`;
    const y = `${input.scrollTop}px`;
    highlight?.style.setProperty("--editor-scroll-x", x);
    highlight?.style.setProperty("--editor-scroll-y", y);
    hitLayer?.style.setProperty("--editor-scroll-x", x);
    hitLayer?.style.setProperty("--editor-scroll-y", y);
  }

  function resolvePreviewTarget(element: HTMLElement): PreviewTarget | null {
    const docId = element.dataset.docId;
    if (docId) {
      const matchedDocument = documents.find((doc) => doc.id === Number(docId));
      if (matchedDocument) return { kind: "document", document: matchedDocument };
    }
    const anchor = element.closest<HTMLAnchorElement>("a[href]");
    if (anchor) return { kind: "external", url: anchor.href };
    return null;
  }

  function resolveDocumentForWikiTitle(title: string): KnowledgeDocument | undefined {
    return documents.find((doc) => doc.title.toLowerCase() === title.trim().toLowerCase());
  }

  function handleHitLayerMouseMove(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      setLinkPreview(null);
      return;
    }
    const link = target.closest<HTMLElement>(".editor-wiki-link");
    if (!link) {
      setLinkPreview(null);
      return;
    }
    const document = resolveDocumentForWikiTitle(link.textContent ?? "");
    if (!document) {
      setLinkPreview(null);
      return;
    }
    setLinkPreview({ target: { kind: "document", document }, x: event.clientX, y: event.clientY });
  }

  function handleHitLayerDoubleClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const link = target.closest<HTMLElement>(".editor-wiki-link");
    if (!link) return;
    const document = resolveDocumentForWikiTitle(link.textContent ?? "");
    if (document) onReferenceOpen(document);
  }

  function handleHitLayerMouseDown(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.closest(".editor-wiki-link")) return;
    // Keep focus in the editor when clicking a wiki link.
    textRef.current?.focus();
  }

  function handleRenderedMouseMove(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      setLinkPreview(null);
      return;
    }
    const link = target.closest<HTMLElement>(".wiki-link[data-doc-id], .note-citation[data-doc-id], a[href]");
    if (!link) {
      setLinkPreview(null);
      return;
    }
    const previewTarget = resolvePreviewTarget(link);
    if (!previewTarget) {
      setLinkPreview(null);
      return;
    }
    setLinkPreview({ target: previewTarget, x: event.clientX, y: event.clientY });
  }

  function handleRenderedClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest<HTMLButtonElement>(".wiki-link[data-doc-id], .note-citation[data-doc-id]");
    if (!button) return;
    const documentId = Number(button.dataset.docId);
    const document = documents.find((doc) => doc.id === documentId);
    if (document) onReferenceOpen(document);
  }

  function openCompletedBacklink(event?: MouseEvent<HTMLTextAreaElement>) {
    event?.preventDefault();
    const input = textRef.current;
    if (!input) return;
    const target = completedBacklinkAtCursor(bodyRef.current, input.selectionStart);
    if (!target) return;
    const document = documents.find((doc) => doc.title.toLowerCase() === target.toLowerCase());
    if (document) onReferenceOpen(document);
    window.requestAnimationFrame(() => {
      const current = textRef.current;
      if (!current) return;
      const cursor = current.selectionEnd;
      current.selectionStart = cursor;
      current.selectionEnd = cursor;
      current.focus();
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
      applyBody(`${body}\n${insertion}`, body.length + insertion.length + 1);
      return;
    }
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const next = `${body.slice(0, start)}${insertion}${body.slice(end)}`;
    applyBody(next, start + insertion.length);
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

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      const history = historyRef.current;
      if (event.shiftKey) {
        const nextIndex = Math.min(history.length - 1, historyIndexRef.current + 1);
        historyIndexRef.current = nextIndex;
        applyBody(history[nextIndex] ?? bodyRef.current, (history[nextIndex] ?? bodyRef.current).length, undefined, false);
        return;
      }
      if (historyIndexRef.current === history.length - 1 && history.at(-1) !== bodyRef.current) {
        historyRef.current = [...history, bodyRef.current];
        historyIndexRef.current = historyRef.current.length - 1;
      }
      const nextIndex = Math.max(0, historyIndexRef.current - 1);
      historyIndexRef.current = nextIndex;
      applyBody(historyRef.current[nextIndex] ?? bodyRef.current, (historyRef.current[nextIndex] ?? bodyRef.current).length, undefined, false);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
      event.preventDefault();
      const history = historyRef.current;
      const nextIndex = Math.min(history.length - 1, historyIndexRef.current + 1);
      historyIndexRef.current = nextIndex;
      applyBody(history[nextIndex] ?? bodyRef.current, (history[nextIndex] ?? bodyRef.current).length, undefined, false);
      return;
    }

    if (backlinkQuery && backlinkSuggestions.length) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveSuggestion((index) => Math.min(backlinkSuggestions.length - 1, index + 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveSuggestion((index) => Math.max(0, index - 1));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        insertBacklink(backlinkSuggestions[activeSuggestion] ?? backlinkSuggestions[0]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setBacklinkQuery(null);
        return;
      }
    }

    if (event.key === "Tab") {
      event.preventDefault();
      const indent = "    ";
      const next = `${body.slice(0, start)}${indent}${body.slice(end)}`;
      applyBody(next, start + indent.length);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const next = `${body.slice(0, start)}\n${body.slice(end)}`;
      applyBody(next, start + 1);
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
      applyBody(next, start + 1, end + 1);
      return;
    }

    if ((event.key === ")" || event.key === "]" || event.key === "}" || event.key === '"' || event.key === "`") && body.at(start) === event.key) {
      event.preventDefault();
      applyBody(body, start + 1);
    }
  }

  function insertBacklink(document: KnowledgeDocument | undefined) {
    if (!document || !backlinkQuery) return;
    const input = textRef.current;
    const cursor = input?.selectionStart ?? body.length;
    const replaceEnd = body.slice(cursor, cursor + 2) === "]]" ? cursor + 2 : cursor;
    const insertion = `[[${document.title}]]`;
    const next = `${body.slice(0, backlinkQuery.start)}${insertion}${body.slice(replaceEnd)}`;
    setBacklinkQuery(null);
    applyBody(next, backlinkQuery.start + insertion.length);
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
          <button className="icon-btn" title="Open in another app" aria-label="Open note in another app" onClick={onOpenExternal}>
            <ExternalLink size={14} />
          </button>
          <button className={`btn-ghost note-render-toggle${renderEnabled ? " active" : ""}`} onClick={() => setRenderEnabled((enabled) => !enabled)}>
            Render {renderEnabled ? "on" : "off"}
          </button>
          <span>{saveState === "dirty" ? "Unsaved" : saveState === "saving" ? "Saving..." : saveState === "error" ? "Save failed" : "Saved"}</span>
          <button className="btn-ghost" disabled={saveState === "saving"} onClick={onSave}>
            Save
          </button>
        </div>
      </div>
      <div className={`note-editor-grid${renderEnabled ? "" : " render-off"}`}>
        <div className="note-input-wrap">
          <div
            ref={highlightRef}
            className="note-markdown-highlight"
            aria-hidden="true"
            style={{ "--editor-scroll-x": "0px", "--editor-scroll-y": "0px" } as CSSProperties}
          >
            <pre dangerouslySetInnerHTML={{ __html: editorHighlights || "\n" }} />
          </div>
          <textarea
            ref={textRef}
            className="note-markdown-input"
            spellCheck
            value={body}
            onChange={(event) => {
              applyBody(event.target.value, event.target.selectionStart, event.target.selectionEnd);
            }}
            onClick={updateBacklinkQuery}
            onDoubleClick={openCompletedBacklink}
            onKeyDown={handleEditorKeyDown}
            onKeyUp={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === "Escape") return;
              updateBacklinkQuery();
            }}
            onPaste={(event) => void handlePaste(event)}
            onScroll={syncHighlightScroll}
          />
          <div
            ref={hitLayerRef}
            className="note-markdown-hit-layer"
            aria-hidden="true"
            style={{ "--editor-scroll-x": "0px", "--editor-scroll-y": "0px" } as CSSProperties}
            onMouseMove={handleHitLayerMouseMove}
            onMouseLeave={() => setLinkPreview(null)}
            onMouseDown={handleHitLayerMouseDown}
            onDoubleClick={handleHitLayerDoubleClick}
          >
            <pre dangerouslySetInnerHTML={{ __html: editorHighlights || "\n" }} />
          </div>
          {backlinkQuery && backlinkSuggestions.length ? (
            <div className="backlink-suggestions" style={{ left: suggestionPosition.left, top: suggestionPosition.top }}>
              {backlinkSuggestions.map((document, index) => (
                <div key={document.id} className={`backlink-suggestion-row${index === activeSuggestion ? " active" : ""}`}>
                  <span>{document.title}</span>
                  <small>{document.type}</small>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        {renderEnabled ? (
          <div className="note-rendered-wrap">
            <article
              className="note-rendered"
              dangerouslySetInnerHTML={{ __html: rendered }}
              onClick={handleRenderedClick}
              onMouseMove={handleRenderedMouseMove}
              onMouseLeave={() => setLinkPreview(null)}
            />
          </div>
        ) : null}
      </div>
      {linkPreview && <LinkPreviewBubble target={linkPreview.target} x={linkPreview.x} y={linkPreview.y} />}
    </section>
  );
}
