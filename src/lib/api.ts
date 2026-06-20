import type {
  AppConfig,
  ConnectorConfigInput,
  ConnectorId,
  ConnectorImportResult,
  ConnectorListItem,
  ConnectorListResponse,
  DocumentBacklink,
  DocumentType,
  KnowledgeDocument,
  NoteContent,
  NoteImageUpload,
  NoteMetadata,
  OpenAppConfig,
} from "./types";

export async function fetchConfig(): Promise<AppConfig> {
  const response = await fetch("/api/config");
  if (!response.ok) {
    throw new Error("Could not load local knowledge base");
  }
  return response.json() as Promise<AppConfig>;
}

export async function fetchConnectors(): Promise<ConnectorListItem[]> {
  const response = await fetch("/api/connectors");
  if (!response.ok) {
    throw new Error("Could not load connectors");
  }
  const payload = (await response.json()) as ConnectorListResponse;
  return payload.connectors;
}

export async function saveConnectorConfig(id: ConnectorId, input: ConnectorConfigInput): Promise<ConnectorListItem> {
  const response = await fetch(`/api/connectors/${id}/config`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Could not save connector config");
  }

  return response.json() as Promise<ConnectorListItem>;
}

export async function importConnectorDocuments(id: ConnectorId): Promise<ConnectorImportResult> {
  const response = await fetch(`/api/connectors/${id}/import`, {
    method: "POST",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Could not import connector documents");
  }

  return response.json() as Promise<ConnectorImportResult>;
}

export async function updateOpenApps(openApps: OpenAppConfig): Promise<AppConfig> {
  const response = await fetch("/api/config", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ openApps }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Could not update open app settings");
  }

  return response.json() as Promise<AppConfig>;
}

export async function addDocument(input: {
  file: File;
  title: string;
  type: DocumentType;
  tags: string[];
}): Promise<KnowledgeDocument> {
  const form = new FormData();
  form.set("file", input.file);
  form.set("title", input.title);
  form.set("type", input.type);
  form.set("tags", JSON.stringify(input.tags));

  const response = await fetch("/api/documents", {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Could not add source");
  }

  return response.json() as Promise<KnowledgeDocument>;
}

export async function addWebDocument(input: {
  url: string;
  title: string;
  tags: string[];
}): Promise<KnowledgeDocument> {
  const response = await fetch("/api/documents/web", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Could not add web source");
  }

  return response.json() as Promise<KnowledgeDocument>;
}

export async function updateDocument(
  id: number,
  input: {
    title: string;
    tags: string[];
  },
): Promise<KnowledgeDocument> {
  const response = await fetch(`/api/documents/${id}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Could not update source");
  }

  return response.json() as Promise<KnowledgeDocument>;
}

export async function deleteDocument(id: number): Promise<void> {
  const response = await fetch(`/api/documents/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Could not delete source");
  }
}

export async function openDocumentExternally(id: number, app?: string): Promise<void> {
  const params = app ? `?app=${app}` : "";
  const response = await fetch(`/api/documents/${id}/open${params}`, {
    method: "POST",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Could not open source externally");
  }
}

export async function revealDocumentInFinder(id: number): Promise<void> {
  const response = await fetch(`/api/documents/${id}/reveal`, {
    method: "POST",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Could not show source in Finder");
  }
}

export async function createNote(input: {
  title?: string;
  description?: string;
  tags?: string[];
} = {}): Promise<NoteContent> {
  const response = await fetch("/api/notes", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Could not create note");
  }

  return response.json() as Promise<NoteContent>;
}

export async function fetchNote(documentId: number): Promise<NoteContent> {
  const response = await fetch(`/api/notes/${documentId}`);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Could not load note");
  }
  return response.json() as Promise<NoteContent>;
}

export async function saveNote(
  documentId: number,
  input: {
    markdown: string;
    metadata: NoteMetadata;
  },
): Promise<NoteContent> {
  const response = await fetch(`/api/notes/${documentId}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Could not save note");
  }

  return response.json() as Promise<NoteContent>;
}

export async function uploadNoteImage(documentId: number, file: File): Promise<NoteImageUpload> {
  const form = new FormData();
  form.set("file", file);
  const response = await fetch(`/api/notes/${documentId}/attachments/images`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Could not upload image");
  }

  return response.json() as Promise<NoteImageUpload>;
}

export async function fetchBacklinks(documentId: number): Promise<DocumentBacklink[]> {
  const response = await fetch(`/api/notes/${documentId}/backlinks`);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Could not load backlinks");
  }
  const payload = (await response.json()) as { backlinks?: DocumentBacklink[] };
  return payload.backlinks ?? [];
}
