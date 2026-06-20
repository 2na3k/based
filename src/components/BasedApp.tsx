"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDocument,
  addWebDocument,
  createNote,
  deleteDocument,
  fetchConfig,
  fetchConnectors,
  fetchNote,
  importConnectorDocuments,
  openDocumentExternally,
  saveConnectorConfig,
  saveNote,
  updateDocument,
  updateOpenApps,
  uploadNoteImage,
} from "../lib/api";
import {
  inferType,
  parseNoteMarkdown,
  parseTags,
  serializeNoteFrontmatter,
  titleFromFile,
  titleFromUrl,
  uniqTags,
} from "../lib/documents";
import type {
  AppConfig,
  ConnectorConfigInput,
  ConnectorId,
  ConnectorImportResult,
  ConnectorListItem,
  DocumentType,
  KnowledgeDocument,
  NoteMetadata,
  OpenApp,
  OpenAppConfig,
  PendingSource,
  SaveState,
  SortMode,
  ViewMode,
} from "../lib/types";
import { CustomFilterPanel } from "./CustomFilterPanel";
import { ConnectorModal } from "./ConnectorModal";
import { DocumentGrid } from "./DocumentGrid";
import { DocumentActionsModal } from "./DocumentActionsModal";
import type { ActionsMenuPosition } from "./DocumentCard";
import { DocumentToolbar } from "./DocumentToolbar";
import { NoteEditor } from "./NoteEditor";
import { NewNoteModal } from "./NewNoteModal";
import { SettingsModal } from "./SettingsModal";
import { Sidebar } from "./Sidebar";
import { SourceChooserModal } from "./SourceChooserModal";
import { SourceFormModal } from "./SourceFormModal";
import { PreviewSidebar } from "./PreviewSidebar";
import { Toast } from "./Toast";
import { Topbar } from "./Topbar";

const PREVIEW_MIN_WIDTH = 360;
const PREVIEW_MAX_WIDTH = 900;
const DEFAULT_OPEN_APPS: OpenAppConfig = {
  pdf: "system",
  doc: "system",
  xlsx: "system",
  web: "system",
  paper: "system",
  note: "system",
};

type AppStyle = CSSProperties & {
  "--preview-width"?: string;
  "--sidebar-toggle-y"?: string;
};

interface WebTitleSuggestion {
  suggestedTitle: string;
}

interface ConnectorSyncMessage {
  type: "based:connector-sync";
  connectorId: string;
  status: "synced" | "error";
  message?: string;
  importedCount?: number;
  skippedCount?: number;
  totalFetched?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function connectorSyncMessageFromData(data: unknown): ConnectorSyncMessage | null {
  if (!isRecord(data) || data.type !== "based:connector-sync" || typeof data.connectorId !== "string") return null;
  if (data.status !== "synced" && data.status !== "error") return null;
  return {
    type: "based:connector-sync",
    connectorId: data.connectorId,
    status: data.status,
    message: typeof data.message === "string" ? data.message : undefined,
    importedCount: typeof data.importedCount === "number" ? data.importedCount : undefined,
    skippedCount: typeof data.skippedCount === "number" ? data.skippedCount : undefined,
    totalFetched: typeof data.totalFetched === "number" ? data.totalFetched : undefined,
  };
}

function isLocalConnectorOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

async function detectWebTitle(url: string, signal: AbortSignal): Promise<WebTitleSuggestion> {
  const params = new URLSearchParams({ url });
  const response = await fetch(`/api/documents/web/title?${params.toString()}`, { signal });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Could not detect link title");
  }
  return response.json() as Promise<WebTitleSuggestion>;
}

export function BasedApp() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [connectors, setConnectors] = useState<ConnectorListItem[]>([]);
  const [storage, setStorage] = useState<AppConfig["storage"] | null>(null);
  const [openApps, setOpenApps] = useState<OpenAppConfig>(DEFAULT_OPEN_APPS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilterGroup, setActiveFilterGroup] = useState<
    "documents" | "tags"
  >("documents");
  const [activeType, setActiveType] = useState<DocumentType | "all">("all");
  const [activeTag, setActiveTag] = useState<string>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [sortBy, setSortBy] = useState<SortMode>("recent");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sourceChooserOpen, setSourceChooserOpen] = useState(false);
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteDescription, setNewNoteDescription] = useState("");
  const [newNoteTags, setNewNoteTags] = useState("");
  const [newNoteSaving, setNewNoteSaving] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [connectorsOpen, setConnectorsOpen] = useState(true);
  const [selectedConnectorId, setSelectedConnectorId] = useState<ConnectorId | null>(null);
  const [connectorSaving, setConnectorSaving] = useState(false);
  const [connectorImporting, setConnectorImporting] = useState(false);
  const [connectorImportResult, setConnectorImportResult] = useState<ConnectorImportResult | null>(null);
  const [tagsOpen, setTagsOpen] = useState(true);
  const [toast, setToast] = useState("");
  const [previewDocument, setPreviewDocument] =
    useState<KnowledgeDocument | null>(null);
  const [noteDocument, setNoteDocument] = useState<KnowledgeDocument | null>(null);
  const [noteMarkdown, setNoteMarkdown] = useState("");
  const [noteMetadata, setNoteMetadata] = useState<NoteMetadata | null>(null);
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteSaveState, setNoteSaveState] = useState<SaveState>("idle");
  const [previewWidth, setPreviewWidth] = useState<number | null>(null);
  const [sidebarToggleY, setSidebarToggleY] = useState(18);
  const [actionsDocument, setActionsDocument] = useState<KnowledgeDocument | null>(null);
  const [actionsPosition, setActionsPosition] = useState<ActionsMenuPosition | null>(null);
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
  const lastAutoTitle = useRef("");
  const lastSavedNote = useRef("");
  const currentNoteMarkdown = useRef("");
  const currentNoteMetadata = useRef<NoteMetadata | null>(null);
  const currentNoteDocumentId = useRef<number | null>(null);
  const connectorQueryHandled = useRef(false);
  const startupConnectorSyncHandled = useRef(false);
  const noteRevision = useRef(0);
  const noteSaving = useRef(false);

  useEffect(() => {
    Promise.all([fetchConfig(), fetchConnectors()])
      .then(([config, connectorList]) => {
        setStorage(config.storage);
        setDocuments(config.documents);
        setOpenApps(config.openApps ?? DEFAULT_OPEN_APPS);
        setConnectors(connectorList);
      })
      .catch((caught: unknown) =>
        setError(
          caught instanceof Error ? caught.message : "Could not load app",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  async function refreshAppState(): Promise<void> {
    const [config, connectorList] = await Promise.all([fetchConfig(), fetchConnectors()]);
    setStorage(config.storage);
    setDocuments(config.documents);
    setOpenApps(config.openApps ?? DEFAULT_OPEN_APPS);
    setConnectors(connectorList);
  }

  useEffect(() => {
    if (startupConnectorSyncHandled.current || !connectors.length) return;
    const importableConnectors = connectors.filter(
      (connector) =>
        connector.status.connected &&
        connector.definition.capabilities.canImport,
    );
    if (!importableConnectors.length) return;

    startupConnectorSyncHandled.current = true;
    const connectorNames = importableConnectors.map((connector) => connector.definition.name).join(", ");
    showMessage(`Syncing ${connectorNames}`);

    void Promise.all(
      importableConnectors.map((connector) => importConnectorDocuments(connector.definition.id)),
    )
      .then((results) => {
        const importedCount = results.reduce((total, result) => total + result.importedCount, 0);
        const skippedCount = results.reduce((total, result) => total + result.skippedCount, 0);
        const totalFetched = results.reduce((total, result) => total + result.totalFetched, 0);
        const lastResult = results.at(-1);
        if (lastResult) setConnectorImportResult(lastResult);
        showMessage(`Connector sync complete: ${importedCount} imported, ${skippedCount} skipped, ${totalFetched} fetched`);
        return refreshAppState();
      })
      .catch((caught: unknown) => {
        showMessage(caught instanceof Error ? caught.message : "Could not sync connectors");
      });
  }, [connectors]);

  useEffect(() => {
    function handleConnectorMessage(event: MessageEvent<unknown>) {
      if (event.origin !== window.location.origin && !isLocalConnectorOrigin(event.origin)) return;
      const message = connectorSyncMessageFromData(event.data);
      if (!message) return;
      const connector = connectors.find((item) => item.definition.id === message.connectorId);
      if (!connector) return;

      setSelectedConnectorId(connector.definition.id);
      if (message.status === "error") {
        showMessage(message.message || "Could not sync connector");
        return;
      }

      const result: ConnectorImportResult = {
        connectorId: connector.definition.id,
        documents: [],
        importedCount: message.importedCount ?? 0,
        skippedCount: message.skippedCount ?? 0,
        totalFetched: message.totalFetched ?? 0,
      };
      setConnectorImportResult(result);
      showMessage(`${connector.definition.name} synced: ${result.importedCount} imported, ${result.skippedCount} skipped`);
      void refreshAppState()
        .catch((caught: unknown) => showMessage(caught instanceof Error ? caught.message : "Could not refresh connector sync"));
    }

    window.addEventListener("message", handleConnectorMessage);
    return () => window.removeEventListener("message", handleConnectorMessage);
  }, [connectors]);

  useEffect(() => {
    if (connectorQueryHandled.current || !connectors.length) return;
    connectorQueryHandled.current = true;
    const params = new URLSearchParams(window.location.search);
    const connectorId = params.get("connector");
    const connectorStatus = params.get("connectorStatus");
    const connectorMessage = params.get("connectorMessage");
    const importedCount = Number(params.get("connectorImported") ?? 0);
    const skippedCount = Number(params.get("connectorSkipped") ?? 0);
    const totalFetched = Number(params.get("connectorFetched") ?? 0);
    const connector = connectors.find((item) => item.definition.id === connectorId);
    if (!connector) return;

    setSelectedConnectorId(connector.definition.id);
    if (connectorStatus === "synced") {
      const result = {
        connectorId: connector.definition.id,
        documents: [],
        importedCount: Number.isFinite(importedCount) ? importedCount : 0,
        skippedCount: Number.isFinite(skippedCount) ? skippedCount : 0,
        totalFetched: Number.isFinite(totalFetched) ? totalFetched : 0,
      };
      setConnectorImportResult(result);
      showMessage(`${connector.definition.name} synced: ${result.importedCount} imported, ${result.skippedCount} skipped`);
    }
    if (connectorStatus === "connected") showMessage(`${connector.definition.name} connected`);
    if (connectorStatus === "error") showMessage(connectorMessage || `Could not connect ${connector.definition.name}`);
    window.history.replaceState(null, "", window.location.pathname);
  }, [connectors]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    currentNoteMetadata.current = noteMetadata;
  }, [noteMetadata]);

  useEffect(() => {
    currentNoteDocumentId.current = noteDocument?.id ?? null;
  }, [noteDocument]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSettingsOpen(false);
        setSourceChooserOpen(false);
        setNewNoteOpen(false);
        setSelectedConnectorId(null);
        setPending(null);
        setPreviewDocument(null);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.getElementById("searchInput")?.focus();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        if (!noteDocument || !noteMetadata) return;
        event.preventDefault();
        void saveActiveNote();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [noteDocument, noteMarkdown, noteMetadata]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (pending?.kind !== "web" || !URL.canParse(formUrl)) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void detectWebTitle(formUrl, controller.signal)
        .then((suggestion) => {
          if (!suggestion.suggestedTitle) return;
          setFormTitle((current) => {
            if (current.trim() && current !== lastAutoTitle.current) return current;
            lastAutoTitle.current = suggestion.suggestedTitle;
            return suggestion.suggestedTitle;
          });
        })
        .catch(() => {
          const fallback = titleFromUrl(formUrl);
          if (!fallback) return;
          setFormTitle((current) => {
            if (current.trim() && current !== lastAutoTitle.current) return current;
            lastAutoTitle.current = fallback;
            return fallback;
          });
        });
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [formUrl, pending]);

  const tags = useMemo(() => uniqTags(documents), [documents]);
  const selectedConnector = useMemo(
    () => connectors.find((connector) => connector.definition.id === selectedConnectorId) ?? null,
    [connectors, selectedConnectorId],
  );

  useEffect(() => {
    if (!noteDocument || noteSaveState !== "dirty") return;
    const timer = window.setTimeout(() => {
      void saveActiveNote();
    }, 900);
    return () => window.clearTimeout(timer);
  }, [noteDocument, noteMarkdown, noteMetadata, noteSaveState]);

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

  function updateConnectorState(updated: ConnectorListItem) {
    setConnectors((current) =>
      current.map((connector) => (connector.definition.id === updated.definition.id ? updated : connector)),
    );
  }

  function openConnector(id: ConnectorId) {
    setSelectedConnectorId(id);
    setConnectorImportResult(null);
  }

  async function saveSelectedConnectorConfig(input: ConnectorConfigInput) {
    if (!selectedConnectorId) return;
    setConnectorSaving(true);
    try {
      const updated = await saveConnectorConfig(selectedConnectorId, input);
      updateConnectorState(updated);
      showMessage(`${updated.definition.name} config saved`);
    } catch (caught: unknown) {
      showMessage(caught instanceof Error ? caught.message : "Could not save connector config");
    } finally {
      setConnectorSaving(false);
    }
  }

  function connectSelectedConnector() {
    if (!selectedConnectorId) return;
    const connector = connectors.find((item) => item.definition.id === selectedConnectorId);
    const origin = connector?.status.redirectOrigin ?? window.location.origin;
    const startUrl = `${origin}/api/connectors/${selectedConnectorId}/oauth/start`;
    const popup = window.open(
      startUrl,
      `based-${selectedConnectorId}-oauth`,
      "popup,width=540,height=740",
    );
    if (!popup) {
      window.location.href = startUrl;
    }
  }

  async function importSelectedConnectorDocuments() {
    if (!selectedConnectorId) return;
    setConnectorImporting(true);
    try {
      const result = await importConnectorDocuments(selectedConnectorId);
      setConnectorImportResult(result);
      showMessage(`Imported ${result.importedCount}; skipped ${result.skippedCount}`);
      await refreshAppState();
    } catch (caught: unknown) {
      showMessage(caught instanceof Error ? caught.message : "Could not import connector documents");
    } finally {
      setConnectorImporting(false);
    }
  }

  function updateDocumentState(updated: KnowledgeDocument) {
    setDocuments((current) => current.map((doc) => (doc.id === updated.id ? updated : doc)));
    setPreviewDocument((current) => (current?.id === updated.id ? updated : current));
    setNoteDocument((current) => (current?.id === updated.id ? updated : current));
  }

  function selectType(type: DocumentType | "all") {
    setNoteDocument(null);
    setSelectedConnectorId(null);
    setActiveFilterGroup("documents");
    setActiveType(type);
    setActiveTag("all");
  }

  function selectTag(tag: string) {
    setNoteDocument(null);
    setSelectedConnectorId(null);
    setActiveFilterGroup("tags");
    setActiveTag(tag);
    setActiveType("all");
  }

  async function openNote(doc: KnowledgeDocument) {
    setPreviewDocument(null);
    setNoteDocument(doc);
    setNoteLoading(true);
    setNoteSaveState("idle");
    try {
      const content = await fetchNote(doc.id);
      setNoteDocument(content.document);
      noteRevision.current = 0;
      currentNoteMarkdown.current = content.markdown;
      setNoteMarkdown(content.markdown);
      setNoteMetadata(content.metadata);
      lastSavedNote.current = content.markdown;
      setNoteSaveState("saved");
    } catch (caught: unknown) {
      showMessage(caught instanceof Error ? caught.message : "Could not load note");
      setNoteDocument(null);
    } finally {
      setNoteLoading(false);
    }
  }

  function openAppForType(type: DocumentType): OpenApp | undefined {
    const app = openApps[type];
    return app === "system" ? undefined : app;
  }

  async function changeOpenApp(type: DocumentType, app: OpenApp) {
    const previous = openApps;
    const nextOpenApps = { ...openApps, [type]: app };
    setOpenApps(nextOpenApps);
    try {
      const config = await updateOpenApps(nextOpenApps);
      setOpenApps(config.openApps);
      showMessage("Open app settings updated");
    } catch (caught: unknown) {
      setOpenApps(previous);
      showMessage(caught instanceof Error ? caught.message : "Could not update open app settings");
    }
  }

  async function openActiveNoteExternally() {
    if (!noteDocument) return;

    try {
      await openDocumentExternally(noteDocument.id, openAppForType(noteDocument.type));
      showMessage("Opened note in editor");
    } catch (caught: unknown) {
      showMessage(caught instanceof Error ? caught.message : "Could not open note externally");
    }
  }

  async function openActionsDocumentExternally() {
    if (!actionsDocument) return;

    if (actionsDocument.type === "web") {
      window.open(actionsDocument.source, "_blank", "noopener,noreferrer");
      closeActions();
      return;
    }

    try {
      await openDocumentExternally(actionsDocument.id, openAppForType(actionsDocument.type));
      showMessage(actionsDocument.type === "note" ? "Opened note in editor" : "Opened source file");
      closeActions();
    } catch (caught: unknown) {
      showMessage(caught instanceof Error ? caught.message : "Could not open source externally");
    }
  }

  function selectDocument(doc: KnowledgeDocument) {
    if (doc.type === "note") {
      void openNote(doc);
      return;
    }
    setNoteDocument(null);
    noteRevision.current = 0;
    currentNoteMarkdown.current = "";
    setNoteMarkdown("");
    setNoteMetadata(null);
    setPreviewDocument(doc);
  }

  function openRenderedReference(doc: KnowledgeDocument) {
    if (doc.type === "web") {
      window.open(doc.source, "_blank", "noopener,noreferrer");
      return;
    }
    if (doc.type === "note") {
      void openNote(doc);
      return;
    }
    setPreviewDocument(doc);
  }

  function openNewNote() {
    setNewNoteTitle("");
    setNewNoteDescription("");
    setNewNoteTags("");
    setNewNoteOpen(true);
  }

  async function createNewNote() {
    if (!newNoteTitle.trim()) return;
    setNewNoteSaving(true);
    try {
      const content = await createNote({
        title: newNoteTitle.trim(),
        description: newNoteDescription.trim(),
        tags: parseTags(newNoteTags),
      });
      setDocuments((current) => [content.document, ...current]);
      setNoteDocument(content.document);
      noteRevision.current = 0;
      currentNoteMarkdown.current = content.markdown;
      setNoteMarkdown(content.markdown);
      setNoteMetadata(content.metadata);
      lastSavedNote.current = content.markdown;
      setNoteSaveState("saved");
      setPreviewDocument(null);
      setNewNoteOpen(false);
      setNewNoteTitle("");
      setNewNoteDescription("");
      setNewNoteTags("");
      showMessage("Note created");
    } catch (caught: unknown) {
      showMessage(caught instanceof Error ? caught.message : "Could not create note");
    } finally {
      setNewNoteSaving(false);
    }
  }

  async function saveActiveNote() {
    const documentId = currentNoteDocumentId.current;
    const metadataToSave = currentNoteMetadata.current;
    if (!documentId || !metadataToSave || noteSaving.current) return;
    const markdownToSave = currentNoteMarkdown.current;
    const revisionToSave = noteRevision.current;
    noteSaving.current = true;
    setNoteSaveState("saving");
    try {
      const content = await saveNote(documentId, {
        markdown: markdownToSave,
        metadata: metadataToSave,
      });
      if (currentNoteDocumentId.current !== documentId) return;
      updateDocumentState(content.document);
      if (noteRevision.current === revisionToSave && currentNoteMarkdown.current === markdownToSave) {
        currentNoteMarkdown.current = content.markdown;
        setNoteMarkdown(content.markdown);
        setNoteMetadata(content.metadata);
        lastSavedNote.current = content.markdown;
        setNoteSaveState("saved");
      } else {
        setNoteSaveState("dirty");
      }
    } catch (caught: unknown) {
      setNoteSaveState("error");
      showMessage(caught instanceof Error ? caught.message : "Could not save note");
    } finally {
      noteSaving.current = false;
    }
  }

  function changeNoteMarkdown(markdown: string) {
    noteRevision.current += 1;
    currentNoteMarkdown.current = markdown;
    setNoteMarkdown(markdown);
    setNoteSaveState(markdown === lastSavedNote.current ? "saved" : "dirty");
  }

  function renameNote(title: string) {
    if (!noteDocument || !noteMetadata) return;
    const metadata = { ...noteMetadata, name: title };
    const parsed = parseNoteMarkdown(noteMarkdown);
    const markdown = `${serializeNoteFrontmatter(metadata)}${parsed.body}`;
    setNoteDocument({ ...noteDocument, title });
    currentNoteMarkdown.current = markdown;
    setNoteMetadata(metadata);
    changeNoteMarkdown(markdown);
  }

  async function pasteNoteImage(file: File) {
    if (!noteDocument) throw new Error("Open a note before pasting images");
    const uploaded = await uploadNoteImage(noteDocument.id, file);
    showMessage("Image attached");
    return uploaded.markdownPath;
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

  function openActions(doc: KnowledgeDocument, position: ActionsMenuPosition) {
    setActionsDocument(doc);
    setActionsPosition(position);
    setActionsTitle(doc.title);
    setActionsTags(doc.tags.join(", "));
  }

  function closeActions() {
    setActionsDocument(null);
    setActionsPosition(null);
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
      updateDocumentState(updated);
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
      setNoteDocument((current) => (current?.id === documentId ? null : current));
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
    lastAutoTitle.current = "";
    setFormType("web");
    setFormTags("");
    setFormUrl("");
    setSourceChooserOpen(false);
  }

  function changeWebUrl(value: string) {
    setFormUrl(value);
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
        activeConnectorId={selectedConnectorId}
        activeTag={activeTag}
        activeType={activeType}
        connectors={connectors}
        connectorsOpen={connectorsOpen}
        sidebarCollapsed={sidebarCollapsed}
        tags={tags}
        tagsOpen={tagsOpen}
        theme={theme}
        onActiveTagChange={selectTag}
        onActiveTypeChange={selectType}
        onConnectorsOpenChange={setConnectorsOpen}
        onOpenConnector={openConnector}
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
          onNewNote={openNewNote}
          onOpenSourceChooser={() => setSourceChooserOpen(true)}
          onSearchChange={setSearchQ}
        />

        <section className="content">
          {noteDocument ? (
            <NoteEditor
              documents={documents}
              loading={noteLoading}
              markdown={noteMarkdown}
              metadata={noteMetadata}
              saveState={noteSaveState}
              title={noteDocument.title}
              onMarkdownChange={changeNoteMarkdown}
              onOpenExternal={() => void openActiveNoteExternally()}
              onPasteImage={pasteNoteImage}
              onReferenceOpen={openRenderedReference}
              onSave={() => void saveActiveNote()}
              onTitleChange={renameNote}
            />
          ) : (
            <>
              <DocumentToolbar
                filtersOpen={filtersOpen}
                sortBy={sortBy}
                viewMode={viewMode}
                onFiltersOpenChange={setFiltersOpen}
                onSortChange={setSortBy}
                onViewModeChange={setViewMode}
              />
              <CustomFilterPanel
                activeTag={activeTag}
                activeType={activeType}
                open={filtersOpen}
                tags={tags}
                onActiveTagChange={selectTag}
                onActiveTypeChange={selectType}
              />
              <DocumentGrid
                documents={filtered}
                error={error}
                loading={loading}
                selectedDocumentId={previewDocument?.id ?? null}
                viewMode={viewMode}
                onDocumentSelect={selectDocument}
                onDocumentActions={openActions}
                onTagClick={selectTag}
              />
            </>
          )}
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
      <NewNoteModal
        description={newNoteDescription}
        open={newNoteOpen}
        saving={newNoteSaving}
        tags={newNoteTags}
        title={newNoteTitle}
        onClose={() => setNewNoteOpen(false)}
        onDescriptionChange={setNewNoteDescription}
        onSave={() => void createNewNote()}
        onTagsChange={setNewNoteTags}
        onTitleChange={setNewNoteTitle}
      />
      <SettingsModal
        open={settingsOpen}
        storage={storage}
        theme={theme}
        openApps={openApps}
        onClose={() => setSettingsOpen(false)}
        onOpenAppChange={(type, app) => void changeOpenApp(type, app)}
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
        onFormUrlChange={changeWebUrl}
        onSave={() => void savePending()}
      />
      <ConnectorModal
        connector={selectedConnector}
        importing={connectorImporting}
        importResult={connectorImportResult}
        open={Boolean(selectedConnector)}
        saving={connectorSaving}
        onClose={() => setSelectedConnectorId(null)}
        onConnect={connectSelectedConnector}
        onImport={() => void importSelectedConnectorDocuments()}
        onSaveConfig={(input) => void saveSelectedConnectorConfig(input)}
      />
      <DocumentActionsModal
        deleting={actionsDeleting}
        document={actionsDocument}
        menuPosition={actionsPosition}
        saving={actionsSaving}
        tags={actionsTags}
        title={actionsTitle}
        onClose={closeActions}
        onDelete={() => void removeActionsDocument()}
        onOpenExternal={() => void openActionsDocumentExternally()}
        onTagsChange={setActionsTags}
        onTitleChange={setActionsTitle}
        onUpdate={() => void saveActions()}
      />
      <Toast message={toast} />
    </div>
  );
}
