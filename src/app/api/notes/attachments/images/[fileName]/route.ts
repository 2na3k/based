import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { NextResponse } from "next/server";
import { attachmentImagePath } from "../../../../_lib/storage";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{
    fileName: string;
  }>;
}

function contentType(fileName: string) {
  const ext = extname(fileName).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/png";
}

export async function GET(_request: Request, context: RouteContext) {
  const { fileName } = await context.params;
  const file = await readFile(attachmentImagePath(fileName)).catch(() => null);
  if (!file) return new Response("Image not found", { status: 404 });
  return new NextResponse(file, {
    headers: {
      "content-type": contentType(fileName),
    },
  });
}
