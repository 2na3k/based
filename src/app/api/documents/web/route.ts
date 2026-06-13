import { NextResponse } from "next/server";
import { prisma, rowToDocument, tagsFromUnknown, titleFromUrl } from "../../_lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload: unknown = await request.json();
  if (typeof payload !== "object" || payload === null) {
    return new Response("Invalid web source payload", { status: 400 });
  }

  const input = payload as { url?: unknown; title?: unknown; tags?: unknown };
  if (typeof input.url !== "string" || !URL.canParse(input.url)) {
    return new Response("Enter a valid URL", { status: 400 });
  }

  const sourceUrl = new URL(input.url);
  const normalizedUrl = sourceUrl.toString();
  const title = typeof input.title === "string" && input.title.trim() ? input.title.trim() : titleFromUrl(normalizedUrl);
  const tags = tagsFromUnknown(input.tags);
  const stamp = new Date().toISOString();

  const client = await prisma();
  const row = await client.document.create({
    data: {
      type: "web",
      title,
      source: normalizedUrl,
      tags: JSON.stringify(tags),
      createdAt: stamp,
      originalName: normalizedUrl,
      storedPath: normalizedUrl,
      size: 0,
      pinned: 0,
    },
  });

  return NextResponse.json(rowToDocument(row), { status: 201 });
}
