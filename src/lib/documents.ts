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

function titleFromPath(url: URL): string {
  const segment = url.pathname
    .split("/")
    .filter(Boolean)
    .at(-1);
  if (!segment) return "";

  return decodeURIComponent(segment)
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

export function titleFromLink(value: string, pageTitle = ""): string {
  try {
    const url = new URL(value);
    const source = url.hostname.replace(/^www\./, "");
    const title = pageTitle.trim() || titleFromPath(url);
    return title ? `${source}-${title}` : source;
  } catch {
    return "";
  }
}

export function formatDate(doc: KnowledgeDocument): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(doc.createdAt));
}

export function formatMeta(doc: KnowledgeDocument): string {
  const date = formatDate(doc);
  if (doc.type === "web" && doc.size === 0) return date;
  const kb = Math.max(1, Math.round(doc.size / 1024));
  return `${date} · ${kb}kb`;
}

export function uniqTags(docs: KnowledgeDocument[]): string[] {
  return Array.from(new Set(docs.flatMap((doc) => doc.tags))).sort((a, b) => a.localeCompare(b));
}

export function parseTags(value: string): string[] {
  return value
    .split(/[,\s]+/)
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean);
}
