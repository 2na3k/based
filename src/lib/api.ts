import type { AppConfig, DocumentBacklink, DocumentType, KnowledgeDocument, NoteContent, NoteImageUpload, NoteMetadata } from "./types";

export async function fetchConfig(): Promise<AppConfig> {
  const response = await fetch("/api/config");
  if (!response.ok) {
    throw new Error("Could not load local knowledge base");
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
