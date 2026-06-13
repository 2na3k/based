export type DocumentType = "pdf" | "doc" | "xlsx" | "web" | "paper" | "note";
export type ViewMode = "list" | "card";
export type SortMode = "recent" | "alpha" | "type";
export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export interface KnowledgeDocument {
  id: number;
  type: DocumentType;
  title: string;
  source: string;
  tags: string[];
  createdAt: string;
  originalName: string;
  storedPath: string;
  size: number;
  pinned: boolean;
}

export interface StorageInfo {
  baseDir: string;
  configPath: string;
  storageDir: string;
  documentsDir: string;
  notesDir: string;
  attachmentsDir: string;
  imagesDir: string;
}

export interface AppConfig {
  storage: StorageInfo;
  documents: KnowledgeDocument[];
}

export interface PendingFileSource {
  kind: "file";
  file: File;
  inferredType: DocumentType;
}

export interface PendingWebSource {
  kind: "web";
}

export type PendingSource = PendingFileSource | PendingWebSource;

export interface NoteMetadata {
  name: string;
  description: string;
  tags: string[];
  created: string;
}

export interface NoteContent {
  document: KnowledgeDocument;
  markdown: string;
  metadata: NoteMetadata;
}

export interface DocumentBacklink {
  document: KnowledgeDocument;
  excerpts: string[];
}

export interface CitationFormat {
  template: string;
}

export interface NoteImageUpload {
  markdownPath: string;
  renderUrl: string;
}
