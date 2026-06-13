"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDocument, addWebDocument, fetchConfig } from "../lib/api";
import { FILTER_TYPES, inferType, parseTags, titleFromFile, titleFromUrl, uniqTags } from "../lib/documents";
import type { AppConfig, DocumentType, KnowledgeDocument, PendingSource, SortMode, ViewMode } from "../lib/types";
import { DocumentGrid } from "./DocumentGrid";
import { DocumentToolbar } from "./DocumentToolbar";
import { SettingsModal } from "./SettingsModal";
import { Sidebar } from "./Sidebar";
import { SourceChooserModal } from "./SourceChooserModal";
import { SourceFormModal } from "./SourceFormModal";
import { Toast } from "./Toast";
import { Topbar } from "./Topbar";

export function BasedApp() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [storage, setStorage] = useState<AppConfig["storage"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilterGroup, setActiveFilterGroup] = useState<"documents" | "tags">("documents");
  const [activeType, setActiveType] = useState<DocumentType | "all">("all");
  const [activeTag, setActiveTag] = useState<string>("all");
  const [searchQ, setSearchQ] = useState("");
  const [sortBy, setSortBy] = useState<SortMode>("recent");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sourceChooserOpen, setSourceChooserOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(true);
  const [toast, setToast] = useState("");
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
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load app"))
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
  const counts = useMemo(() => {
    return FILTER_TYPES.reduce<Record<DocumentType, number>>(
      (acc, type) => ({ ...acc, [type]: documents.filter((doc) => doc.type === type).length }),
      { pdf: 0, doc: 0, xlsx: 0, web: 0, paper: 0, note: 0 },
    );
  }, [documents]);

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
      if (sortBy === "type") return a.type.localeCompare(b.type) || a.title.localeCompare(b.title);
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
    if (!pending || (pending.kind === "file" && !formTitle.trim()) || (pending.kind === "web" && !formUrl.trim())) return;
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
      showMessage(caught instanceof Error ? caught.message : "Could not add source");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`app${sidebarCollapsed ? " sidebar-collapsed" : ""}`}
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
        counts={counts}
        documents={documents}
        documentsOpen={documentsOpen}
        sidebarCollapsed={sidebarCollapsed}
        tags={tags}
        tagsOpen={tagsOpen}
        theme={theme}
        onActiveTagChange={selectTag}
        onActiveTypeChange={selectType}
        onDocumentsOpenChange={setDocumentsOpen}
        onOpenSettings={() => setSettingsOpen(true)}
        onSidebarCollapsedChange={setSidebarCollapsed}
        onTagsOpenChange={setTagsOpen}
        onThemeChange={setTheme}
      />

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
          <DocumentGrid documents={filtered} error={error} loading={loading} viewMode={viewMode} onShowMessage={showMessage} onTagClick={selectTag} />
        </section>
      </main>

      <SourceChooserModal fileInput={fileInput} open={sourceChooserOpen} onClose={() => setSourceChooserOpen(false)} onOpenWebPending={openWebPending} />
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
      <Toast message={toast} />
    </div>
  );
}
