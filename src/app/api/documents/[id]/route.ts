import { readFile, unlink, writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { mergeNoteMarkdown, parseNoteMarkdown } from "../../../../lib/documents";
import { prisma, rowToDocument, tagsFromUnknown } from "../../_lib/storage";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

async function documentIdFromContext(context: RouteContext): Promise<number | Response> {
  const { id } = await context.params;
  const documentId = Number(id);
  if (!Number.isInteger(documentId)) {
    return new Response("Invalid document id", { status: 400 });
  }
  return documentId;
}

export async function PATCH(request: Request, context: RouteContext) {
  const documentId = await documentIdFromContext(context);
  if (documentId instanceof Response) return documentId;

  const payload: unknown = await request.json();
  if (typeof payload !== "object" || payload === null) {
    return new Response("Invalid source payload", { status: 400 });
  }

  const input = payload as { title?: unknown; tags?: unknown };
  if (typeof input.title !== "string" || !input.title.trim()) {
    return new Response("Title is required", { status: 400 });
  }

  const client = await prisma();
  const existing = await client.document.findUnique({ where: { id: documentId } });
  if (!existing) {
    return new Response("Document not found", { status: 404 });
  }

  const tags = tagsFromUnknown(input.tags);
  if (existing.type === "note") {
    const markdown = await readFile(existing.storedPath, "utf8").catch(() => "");
    const parsed = parseNoteMarkdown(markdown);
    await writeFile(
      existing.storedPath,
      mergeNoteMarkdown(markdown, {
        ...parsed.metadata,
        name: input.title.trim(),
        tags,
      }),
    );
  }

  const row = await client.document.update({
    where: { id: documentId },
    data: {
      title: input.title.trim(),
      tags: JSON.stringify(tags),
    },
  });

  return NextResponse.json(rowToDocument(row));
}

export async function DELETE(_request: Request, context: RouteContext) {
  const documentId = await documentIdFromContext(context);
  if (documentId instanceof Response) return documentId;

  const client = await prisma();
  const existing = await client.document.findUnique({ where: { id: documentId } });
  if (!existing) {
    return new Response("Document not found", { status: 404 });
  }

  await client.document.delete({ where: { id: documentId } });
  if (existing.type !== "web") {
    await unlink(existing.storedPath).catch(() => undefined);
  }

  return new Response(null, { status: 204 });
}
