"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { addDocument, addWebDocument, deleteDocument, fetchConfig, updateDocument } from "../lib/api";
import {
  inferType,
  parseTags,
  titleFromFile,
  titleFromUrl,
  uniqTags,
} from "../lib/documents";
import type {
  AppConfig,
  DocumentType,
  KnowledgeDocument,
  PendingSource,
  SortMode,
  ViewMode,
} from "../lib/types";
import { DocumentGrid } from "./DocumentGrid";
import { DocumentActionsModal } from "./DocumentActionsModal";
import { DocumentToolbar } from "./DocumentToolbar";
import { SettingsModal } from "./SettingsModal";
import { Sidebar } from "./Sidebar";
import { SourceChooserModal } from "./SourceChooserModal";
import { SourceFormModal } from "./SourceFormModal";
import { PreviewSidebar } from "./PreviewSidebar";
import { Toast } from "./Toast";
import { Topbar } from "./Topbar";

const PREVIEW_MIN_WIDTH = 360;
const PREVIEW_MAX_WIDTH = 900;

type AppStyle = CSSProperties & {
  "--preview-width"?: string;
  "--sidebar-toggle-y"?: string;
};

export function BasedApp() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [storage, setStorage] = useState<AppConfig["storage"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilterGroup, setActiveFilterGroup] = useState<
    "documents" | "tags"
  >("documents");
  const [activeType, setActiveType] = useState<DocumentType | "all">("all");
  const [activeTag, setActiveTag] = useState<string>("all");
  const [searchQ, setSearchQ] = useState("");
  const [sortBy, setSortBy] = useState<SortMode>("recent");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sourceChooserOpen, setSourceChooserOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(true);
  const [toast, setToast] = useState("");
  const [previewDocument, setPreviewDocument] =
    useState<KnowledgeDocument | null>(null);
  const [previewWidth, setPreviewWidth] = useState<number | null>(null);
  const [sidebarToggleY, setSidebarToggleY] = useState(18);
  const [actionsDocument, setActionsDocument] = useState<KnowledgeDocument | null>(null);
  const [actionsTitle, setActionsTitle] = useState("");
  const [actionsTags, setActionsTags] = useState("");
  const [actionsSaving, setActionsSaving] = useState(false);
  const [actionsDeleting, setActionsDeleting] = useState(false);
  const [pending, setPending] = useState<PendingSource | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState<DocumentType>("pdf");
  const [formTags, setFormTags] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchConfig()
      .then((config) => {
        setStorage(config.storage);
        setDocuments(config.documents);
      })
      .catch((caught: unknown) =>
        setError(
          caught instanceof Error ? caught.message : "Could not load app",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSettingsOpen(false);
        setSourceChooserOpen(false);
        setPending(null);
        setPreviewDocument(null);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.getElementById("searchInput")?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const tags = useMemo(() => uniqTags(documents), [documents]);

  const filtered = useMemo(() => {
    const query = searchQ.trim().toLowerCase();
    const result = documents.filter((doc) => {
      const matchesType = activeType === "all" || doc.type === activeType;
      const matchesTag = activeTag === "all" || doc.tags.includes(activeTag);
      const matchesSearch =
        !query ||
        doc.title.toLowerCase().includes(query) ||
        doc.source.toLowerCase().includes(query) ||
        doc.tags.some((tag) => tag.toLowerCase().includes(query));
      return matchesType && matchesTag && matchesSearch;
    });

    return result.sort((a, b) => {
      if (sortBy === "alpha") return a.title.localeCompare(b.title);
      if (sortBy === "type")
        return a.type.localeCompare(b.type) || a.title.localeCompare(b.title);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [activeTag, activeType, documents, searchQ, sortBy]);

  function showMessage(message: string) {
    setToast(message);
  }

  function selectType(type: DocumentType | "all") {
    setActiveFilterGroup("documents");
    setActiveType(type);
    setActiveTag("all");
  }

  function selectTag(tag: string) {
    setActiveFilterGroup("tags");
    setActiveTag(tag);
    setActiveType("all");
  }

  function startPreviewResize(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = event.currentTarget.parentElement?.getBoundingClientRect().width ?? previewWidth ?? window.innerWidth * 0.45;

    function handlePointerMove(moveEvent: PointerEvent) {
      const nextWidth = startWidth + startX - moveEvent.clientX;
      const maxWidth = Math.min(PREVIEW_MAX_WIDTH, window.innerWidth * 0.72);
      setPreviewWidth(
        Math.min(maxWidth, Math.max(PREVIEW_MIN_WIDTH, nextWidth)),
      );
    }

    function handlePointerUp() {
      document.body.classList.remove("resizing-preview");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    document.body.classList.add("resizing-preview");
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function startSidebarToggleDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const button = event.currentTarget;
    const startY = event.clientY;
    const startTop = button.getBoundingClientRect().top;
    let dragged = false;

    function handlePointerMove(moveEvent: PointerEvent) {
      dragged = true;
      const nextY = startTop + moveEvent.clientY - startY;
      setSidebarToggleY(Math.min(window.innerHeight - 46, Math.max(8, nextY)));
    }

    function handlePointerUp() {
      document.body.classList.remove("dragging-sidebar-toggle");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      if (!dragged) {
        setSidebarCollapsed(false);
      }
    }

    document.body.classList.add("dragging-sidebar-toggle");
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function openActions(doc: KnowledgeDocument) {
    setActionsDocument(doc);
    setActionsTitle(doc.title);
    setActionsTags(doc.tags.join(", "));
  }

  function closeActions() {
    setActionsDocument(null);
    setActionsTitle("");
    setActionsTags("");
  }

  async function saveActions() {
    if (!actionsDocument || !actionsTitle.trim()) return;
    setActionsSaving(true);
    try {
      const updated = await updateDocument(actionsDocument.id, {
        title: actionsTitle.trim(),
        tags: parseTags(actionsTags),
      });
      setDocuments((current) => current.map((doc) => (doc.id === updated.id ? updated : doc)));
      setPreviewDocument((current) => (current?.id === updated.id ? updated : current));
      closeActions();
      showMessage("Source updated");
    } catch (caught: unknown) {
      showMessage(caught instanceof Error ? caught.message : "Could not update source");
    } finally {
      setActionsSaving(false);
    }
  }

  async function removeActionsDocument() {
    if (!actionsDocument) return;
    const documentId = actionsDocument.id;
    setActionsDeleting(true);
    try {
      await deleteDocument(documentId);
      setDocuments((current) => current.filter((doc) => doc.id !== documentId));
      setPreviewDocument((current) => (current?.id === documentId ? null : current));
      closeActions();
      showMessage("Source deleted");
    } catch (caught: unknown) {
      showMessage(caught instanceof Error ? caught.message : "Could not delete source");
    } finally {
      setActionsDeleting(false);
    }
  }

  function openPending(file: File) {
    const inferred = inferType(file);
    setPending({ kind: "file", file, inferredType: inferred });
    setFormTitle(titleFromFile(file));
    setFormType(inferred);
    setFormTags("");
    setFormUrl("");
    setSourceChooserOpen(false);
  }

  function openWebPending() {
    setPending({ kind: "web" });
    setFormTitle("");
    setFormType("web");
    setFormTags("");
    setFormUrl("");
    setSourceChooserOpen(false);
  }

  function handleFiles(files: FileList | null) {
    const file = files?.item(0);
    if (!file) return;
    openPending(file);
  }

  async function savePending() {
    if (
      !pending ||
      (pending.kind === "file" && !formTitle.trim()) ||
      (pending.kind === "web" && !formUrl.trim())
    )
      return;
    setSaving(true);
    try {
      const tags = parseTags(formTags);
      const title = formTitle.trim() || titleFromUrl(formUrl.trim());
      const doc =
        pending.kind === "web"
          ? await addWebDocument({ url: formUrl.trim(), title, tags })
          : await addDocument({
              file: pending.file,
              title,
              type: formType,
              tags,
            });
      setDocuments((current) => [doc, ...current]);
      setPending(null);
      showMessage("Source added");
    } catch (caught: unknown) {
      showMessage(
        caught instanceof Error ? caught.message : "Could not add source",
      );
    } finally {
      setSaving(false);
    }
  }

  const appStyle: AppStyle = {
    ...(previewWidth === null ? {} : { "--preview-width": `${previewWidth}px` }),
    "--sidebar-toggle-y": `${sidebarToggleY}px`,
  };

  return (
    <div
      className={`app${sidebarCollapsed ? " sidebar-collapsed" : ""}${previewDocument ? " preview-open" : ""}`}
      style={appStyle}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        handleFiles(event.dataTransfer.files);
      }}
    >
      <Sidebar
        activeFilterGroup={activeFilterGroup}
        activeTag={activeTag}
        activeType={activeType}
        documents={documents}
        sidebarCollapsed={sidebarCollapsed}
        tags={tags}
        tagsOpen={tagsOpen}
        theme={theme}
        onActiveTagChange={selectTag}
        onActiveTypeChange={selectType}
        onOpenSettings={() => setSettingsOpen(true)}
        onSidebarCollapsedChange={setSidebarCollapsed}
        onTagsOpenChange={setTagsOpen}
        onThemeChange={setTheme}
      />
      <button
        className="sidebar-restore"
        title="Show sidebar"
        aria-label="Show sidebar"
        onPointerDown={startSidebarToggleDrag}
      >
        &gt;
      </button>

      <main className="main">
        <Topbar
          fileInput={fileInput}
          searchQ={searchQ}
          onFilesChange={handleFiles}
          onOpenSourceChooser={() => setSourceChooserOpen(true)}
          onSearchChange={setSearchQ}
        />

        <section className="content">
          <DocumentToolbar
            activeType={activeType}
            sortBy={sortBy}
            viewMode={viewMode}
            onActiveTypeChange={selectType}
            onSortChange={setSortBy}
            onViewModeChange={setViewMode}
          />
          <DocumentGrid
            documents={filtered}
            error={error}
            loading={loading}
            selectedDocumentId={previewDocument?.id ?? null}
            viewMode={viewMode}
            onDocumentSelect={setPreviewDocument}
            onDocumentActions={openActions}
            onTagClick={selectTag}
          />
        </section>
      </main>

      <PreviewSidebar
        document={previewDocument}
        onClose={() => setPreviewDocument(null)}
        onResizeStart={startPreviewResize}
      />

      <SourceChooserModal
        fileInput={fileInput}
        open={sourceChooserOpen}
        onClose={() => setSourceChooserOpen(false)}
        onOpenWebPending={openWebPending}
      />
      <SettingsModal
        open={settingsOpen}
        storage={storage}
        theme={theme}
        onClose={() => setSettingsOpen(false)}
        onShowMessage={showMessage}
        onThemeChange={setTheme}
        onViewModeChange={setViewMode}
      />
      <SourceFormModal
        formTags={formTags}
        formTitle={formTitle}
        formType={formType}
        formUrl={formUrl}
        pending={pending}
        saving={saving}
        onClose={() => setPending(null)}
        onFormTagsChange={setFormTags}
        onFormTitleChange={setFormTitle}
        onFormTypeChange={setFormType}
        onFormUrlChange={setFormUrl}
        onSave={() => void savePending()}
      />
      <DocumentActionsModal
        deleting={actionsDeleting}
        document={actionsDocument}
        saving={actionsSaving}
        tags={actionsTags}
        title={actionsTitle}
        onClose={closeActions}
        onDelete={() => void removeActionsDocument()}
        onTagsChange={setActionsTags}
        onTitleChange={setActionsTitle}
        onUpdate={() => void saveActions()}
      />
      <Toast message={toast} />
    </div>
  );
}
