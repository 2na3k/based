import type { DocumentType, KnowledgeDocument } from "./types";

export const TYPE_LABELS: Record<DocumentType, string> = {
  pdf: "PDF",
  doc: "Doc",
  xlsx: "XLSX",
  web: "Web",
  paper: "Paper",
  note: "Note",
};

export const FILTER_TYPES: DocumentType[] = ["pdf", "doc", "xlsx", "web", "paper", "note"];

export function inferType(file: File): DocumentType {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) return "xlsx";
  if (lower.endsWith(".doc") || lower.endsWith(".docx")) return "doc";
  return "note";
}

export function titleFromFile(file: File): string {
  return file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
}

export function titleFromUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function formatMeta(doc: KnowledgeDocument): string {
  const date = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(doc.createdAt));
  if (doc.type === "web" && doc.size === 0) return date;
  const kb = Math.max(1, Math.round(doc.size / 1024));
  return `${date} · ${kb}kb`;
}

export function uniqTags(docs: KnowledgeDocument[]): string[] {
  return Array.from(new Set(docs.flatMap((doc) => doc.tags))).sort((a, b) => a.localeCompare(b));
}

export function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean);
}
