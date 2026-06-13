import type { AppConfig, DocumentType, KnowledgeDocument } from "./types";

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
