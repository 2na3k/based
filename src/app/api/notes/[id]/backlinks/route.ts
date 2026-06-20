import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { markdownExcerptsForTarget } from "../../../../lib/documents";
import { prisma, rowToDocument } from "../../../_lib/storage";
import type { DocumentBacklink } from "../../../../lib/types";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const documentId = Number(id);
  if (!Number.isInteger(documentId)) {
    return new Response("Invalid document id", { status: 400 });
  }

  const client = await prisma();
  const targetRow = await client.document.findUnique({ where: { id: documentId } });
  if (!targetRow) return new Response("Document not found", { status: 404 });
  const target = rowToDocument(targetRow);
  const rows = await client.document.findMany({ where: { type: "note" }, orderBy: { createdAt: "desc" } });
  const backlinks: DocumentBacklink[] = [];

  for (const row of rows) {
    if (row.id === target.id) continue;
    const document = rowToDocument(row);
    const markdown = await readFile(document.storedPath, "utf8").catch(() => "");
    const excerpts = markdownExcerptsForTarget(markdown, target.title);
    if (excerpts.length) backlinks.push({ document, excerpts });
  }

  return NextResponse.json({ backlinks });
}
