import { readFile, stat } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma, rowToDocument } from "../../../_lib/storage";
import type { KnowledgeDocument } from "../../../../lib/types";

export const runtime = "nodejs";
const FILE_NOT_FOUND_MESSAGE = "The original PDF file is missing from local storage.";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

async function findPdfDocument(context: RouteContext): Promise<KnowledgeDocument | Response> {
  const { id } = await context.params;
  const documentId = Number(id);
  if (!Number.isInteger(documentId)) {
    return new Response("Invalid document id", { status: 400 });
  }

  const client = await prisma();
  const row = await client.document.findUnique({ where: { id: documentId } });
  if (!row) {
    return new Response("Document not found", { status: 404 });
  }

  const document = rowToDocument(row);
  if (document.type !== "pdf") {
    return new Response("Preview is only available for PDF files", { status: 415 });
  }

  return document;
}

function pdfHeaders(document: KnowledgeDocument, size: number): HeadersInit {
  return {
    "content-disposition": `inline; filename="${document.originalName.replace(/"/g, "")}"`,
    "content-length": String(size),
    "content-type": "application/pdf",
  };
}

export async function HEAD(_request: Request, context: RouteContext) {
  const document = await findPdfDocument(context);
  if (document instanceof Response) return document;

  try {
    const fileStat = await stat(document.storedPath);
    return new Response(null, { headers: pdfHeaders(document, fileStat.size) });
  } catch {
    return new Response(FILE_NOT_FOUND_MESSAGE, {
      status: 404,
      headers: {
        "x-preview-error": FILE_NOT_FOUND_MESSAGE,
      },
    });
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const document = await findPdfDocument(context);
  if (document instanceof Response) return document;

  try {
    const [file, fileStat] = await Promise.all([readFile(document.storedPath), stat(document.storedPath)]);
    return new NextResponse(file, {
      headers: pdfHeaders(document, fileStat.size),
    });
  } catch {
    return new Response(FILE_NOT_FOUND_MESSAGE, { status: 404 });
  }
}
