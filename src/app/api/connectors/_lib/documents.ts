import { prisma, rowToDocument, titleFromUrl } from "../../_lib/storage";
import type { Document } from "@prisma/client";
import type { KnowledgeDocument } from "../../../../lib/types";

export interface WebImportItem {
  url: string;
  title?: string;
  tags: string[];
  createdAt?: string;
}

export interface WebImportResult {
  documents: KnowledgeDocument[];
  skippedCount: number;
}

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}

function normalizeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    return url.toString();
  } catch {
    return null;
  }
}

function normalizedCreatedAt(value: string | undefined): string {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export function normalizeWebImportItem(item: WebImportItem): WebImportItem | null {
  const url = normalizeHttpUrl(item.url);
  if (!url) return null;
  return {
    url,
    title: item.title?.trim() || titleFromUrl(url),
    tags: uniqueTags(item.tags),
    createdAt: normalizedCreatedAt(item.createdAt),
  };
}

function rowTags(row: Document): string[] {
  return rowToDocument(row).tags;
}

function mergeDocumentTags(row: Document, tags: string[]): string[] {
  return uniqueTags([...rowTags(row), ...tags]);
}

export async function insertDedupedWebDocuments(items: WebImportItem[]): Promise<WebImportResult> {
  const client = await prisma();
  const existing = await client.document.findMany({ where: { type: "web" } });
  const existingByUrl = new Map(
    existing
      .map((document) => {
        const source = normalizeHttpUrl(document.source);
        return source ? ([source, document] as const) : null;
      })
      .filter((entry): entry is readonly [string, Document] => Boolean(entry)),
  );

  const normalized = items
    .map(normalizeWebImportItem)
    .filter((item): item is WebImportItem => Boolean(item));

  const importedRows = [];
  let skippedCount = items.length - normalized.length;

  for (const item of normalized) {
    const existingDocument = existingByUrl.get(item.url);
    if (existingDocument) {
      const nextTags = mergeDocumentTags(existingDocument, item.tags);
      if (nextTags.length !== rowTags(existingDocument).length) {
        await client.document.update({
          where: { id: existingDocument.id },
          data: { tags: JSON.stringify(nextTags) },
        });
      }
      skippedCount += 1;
      continue;
    }

    const row = await client.document.create({
      data: {
        type: "web",
        title: item.title ?? titleFromUrl(item.url),
        source: item.url,
        tags: JSON.stringify(item.tags),
        createdAt: item.createdAt ?? new Date().toISOString(),
        originalName: item.url,
        storedPath: item.url,
        size: 0,
        pinned: 0,
      },
    });
    existingByUrl.set(item.url, row);
    importedRows.push(row);
  }

  return {
    documents: importedRows.map(rowToDocument),
    skippedCount,
  };
}
