import { writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma, rowToDocument, storedImagePath } from "../../../../_lib/storage";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: Request, context: RouteContext) {
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

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return new Response("Image file is required", { status: 400 });
  }

  const stored = storedImagePath(file.name || "pasted-image", file.type);
  await writeFile(stored.absolutePath, new Uint8Array(await file.arrayBuffer()));

  return NextResponse.json({
    markdownPath: stored.markdownPath,
    renderUrl: `/api/notes/attachments/images/${encodeURIComponent(stored.fileName)}`,
  });
}
