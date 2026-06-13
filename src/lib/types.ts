export type DocumentType = "pdf" | "doc" | "xlsx" | "web" | "paper" | "note";
export type ViewMode = "list" | "card";
export type SortMode = "recent" | "alpha" | "type";

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
