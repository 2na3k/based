export type DocumentType = "pdf" | "doc" | "xlsx" | "web" | "paper" | "note";
export type ViewMode = "list" | "card";
export type SortMode = "recent" | "alpha" | "type";
export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
export type OpenApp = "system" | "vscode" | "zed" | "obsidian";
export type OpenAppConfig = Record<DocumentType, OpenApp>;
export type ConnectorId = "raindrop";
export type ConnectorAuthKind = "oauth2" | "apiKey" | "none";

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
  openApps: OpenAppConfig;
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

export interface NoteImageUpload {
  markdownPath: string;
  renderUrl: string;
}

export interface ConnectorDefinition {
  id: ConnectorId;
  name: string;
  description: string;
  authKind: ConnectorAuthKind;
  capabilities: ConnectorCapabilities;
  importLabel: string;
  helpLabel?: string;
  helpUrl?: string;
  configFields: ConnectorConfigField[];
}

export interface ConnectorCapabilities {
  supportsBrokerOAuth: boolean;
  supportsTokenFallback: boolean;
  canImport: boolean;
}

export interface ConnectorConfigField {
  name: string;
  label: string;
  type: "text" | "password";
  required: boolean;
  placeholder?: string;
}

export interface ConnectorStatus {
  id: ConnectorId;
  configured: boolean;
  connected: boolean;
  needsConfig: boolean;
  redirectOrigin?: string;
  tokenExpiresAt?: string;
}

export interface ConnectorListItem {
  definition: ConnectorDefinition;
  status: ConnectorStatus;
}

export interface ConnectorListResponse {
  connectors: ConnectorListItem[];
}

export interface ConnectorConfigInput {
  clientId?: string;
  clientSecret?: string;
  apiKey?: string;
  redirectOrigin?: string;
}

export interface ConnectorImportResult {
  connectorId: ConnectorId;
  documents: KnowledgeDocument[];
  importedCount: number;
  skippedCount: number;
  totalFetched: number;
}

export interface ConnectorOAuthExchangeInput {
  transferCode: string;
}
