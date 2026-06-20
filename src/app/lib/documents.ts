import type { DocumentType, KnowledgeDocument, NoteMetadata } from "./types";

export const TYPE_LABELS: Record<DocumentType, string> = {
  pdf: "PDF",
  doc: "Doc",
  xlsx: "XLSX",
  web: "Web",
  paper: "Paper",
  note: "Note",
};

export const FILTER_TYPES: DocumentType[] = ["pdf", "doc", "xlsx", "web", "paper", "note"];
export const DEFAULT_NOTE_TITLE = "Untitled";

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

export function slugifyNoteTitle(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "untitled";
}

function escapeYaml(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function parseYamlString(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return trimmed;
}

function parseYamlTags(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return parseTags(trimmed);
  return trimmed
    .slice(1, -1)
    .split(",")
    .map((tag) => parseYamlString(tag.trim()).replace(/^#/, ""))
    .filter(Boolean);
}

export function defaultNoteMetadata(input?: Partial<NoteMetadata>): NoteMetadata {
  return {
    name: input?.name?.trim() || DEFAULT_NOTE_TITLE,
    description: input?.description ?? "",
    tags: input?.tags ?? [],
    created: input?.created || new Date().toISOString(),
  };
}

export function serializeNoteFrontmatter(metadata: NoteMetadata): string {
  const tags = metadata.tags.map((tag) => `"${escapeYaml(tag)}"`).join(", ");
  return [
    "---",
    `name: "${escapeYaml(metadata.name)}"`,
    `description: "${escapeYaml(metadata.description)}"`,
    `tags: [${tags}]`,
    `created: "${escapeYaml(metadata.created)}"`,
    "---",
    "",
  ].join("\n");
}

export function parseNoteMarkdown(markdown: string): { metadata: NoteMetadata; body: string } {
  if (!markdown.startsWith("---\n")) {
    return { metadata: defaultNoteMetadata(), body: markdown };
  }

  const closeIndex = markdown.indexOf("\n---", 4);
  if (closeIndex === -1) {
    return { metadata: defaultNoteMetadata(), body: markdown };
  }

  const frontmatter = markdown.slice(4, closeIndex).split("\n");
  const values: Partial<NoteMetadata> = {};
  for (const line of frontmatter) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key === "name") values.name = parseYamlString(value);
    if (key === "description") values.description = parseYamlString(value);
    if (key === "tags") values.tags = parseYamlTags(value);
    if (key === "created") values.created = parseYamlString(value);
  }

  const bodyStart = markdown.slice(closeIndex + 4).startsWith("\n") ? closeIndex + 5 : closeIndex + 4;
  return {
    metadata: defaultNoteMetadata(values),
    body: markdown.slice(bodyStart),
  };
}

export function mergeNoteMarkdown(markdown: string, metadata: NoteMetadata): string {
  const parsed = parseNoteMarkdown(markdown);
  return `${serializeNoteFrontmatter(metadata)}${parsed.body}`;
}

export function wikiLinkTargets(markdown: string): string[] {
  const targets = new Set<string>();
  for (const match of markdown.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
    const target = match[1]?.trim();
    if (target) targets.add(target);
  }
  return Array.from(targets);
}

export function markdownExcerptsForTarget(markdown: string, targetTitle: string): string[] {
  const target = targetTitle.toLowerCase();
  return markdown
    .split(/\n+/)
    .filter((line) => wikiLinkTargets(line).some((link) => link.toLowerCase() === target))
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);
}
