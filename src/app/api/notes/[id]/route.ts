import { readFile, stat, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { NextResponse } from "next/server";
import { defaultNoteMetadata, mergeNoteMarkdown, parseNoteMarkdown } from "../../../../lib/documents";
import { prisma, renameNotePath, rowToDocument, tagsFromUnknown } from "../../_lib/storage";
import type { KnowledgeDocument, NoteMetadata } from "../../../../lib/types";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

async function findNote(context: RouteContext): Promise<KnowledgeDocument | Response> {
  const { id } = await context.params;
  const documentId = Number(id);
  if (!Number.isInteger(documentId)) {
    return new Response("Invalid note id", { status: 400 });
  }

  const client = await prisma();
  const row = await client.document.findUnique({ where: { id: documentId } });
  if (!row) return new Response("Note not found", { status: 404 });
  const document = rowToDocument(row);
  if (document.type !== "note") {
    return new Response("Document is not a note", { status: 415 });
  }
  return document;
}

function metadataFromInput(value: unknown, fallback: NoteMetadata): NoteMetadata {
  if (typeof value !== "object" || value === null) return fallback;
  const input = value as { name?: unknown; description?: unknown; tags?: unknown; created?: unknown };
  const tags = Array.isArray(input.tags) ? tagsFromUnknown(input.tags) : fallback.tags;
  return defaultNoteMetadata({
    name: typeof input.name === "string" ? input.name : fallback.name,
    description: typeof input.description === "string" ? input.description : fallback.description,
    tags,
    created: typeof input.created === "string" ? input.created : fallback.created,
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const document = await findNote(context);
  if (document instanceof Response) return document;

  const markdown = await readFile(document.storedPath, "utf8").catch(() => "");
  const parsed = parseNoteMarkdown(markdown);
  return NextResponse.json({ document, markdown, metadata: parsed.metadata });
}

export async function PUT(request: Request, context: RouteContext) {
  const document = await findNote(context);
  if (document instanceof Response) return document;

  const payload: unknown = await request.json().catch(() => null);
  if (typeof payload !== "object" || payload === null) {
    return new Response("Invalid note payload", { status: 400 });
  }
  const input = payload as { markdown?: unknown; metadata?: unknown };
  if (typeof input.markdown !== "string") {
    return new Response("Markdown is required", { status: 400 });
  }

  const parsed = parseNoteMarkdown(input.markdown);
  const metadata = metadataFromInput(input.metadata, parsed.metadata);
  const markdown = mergeNoteMarkdown(input.markdown, metadata);
  await writeFile(document.storedPath, markdown);
  const storedPath = await renameNotePath(document.storedPath, metadata.name);
  const fileName = basename(storedPath);
  const fileStat = await stat(storedPath);

  const client = await prisma();
  const row = await client.document.update({
    where: { id: document.id },
    data: {
      title: metadata.name,
      source: fileName,
      tags: JSON.stringify(metadata.tags),
      originalName: fileName,
      storedPath,
      size: fileStat.size,
    },
  });

  return NextResponse.json({ document: rowToDocument(row), markdown, metadata });
}
