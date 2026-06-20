import { stat, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { NextResponse } from "next/server";
import { defaultNoteMetadata, serializeNoteFrontmatter } from "../../lib/documents";
import { prisma, rowToDocument, storedNotePath, tagsFromUnknown } from "../_lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload: unknown = await request.json().catch(() => ({}));
  const input = typeof payload === "object" && payload !== null ? (payload as { title?: unknown; description?: unknown; tags?: unknown }) : {};
  const title = typeof input.title === "string" && input.title.trim() ? input.title.trim() : "Untitled";
  const description = typeof input.description === "string" ? input.description : "";
  const tags = tagsFromUnknown(input.tags);
  const created = new Date().toISOString();
  const metadata = defaultNoteMetadata({ name: title, description, tags, created });
  const markdown = serializeNoteFrontmatter(metadata);
  const storedPath = await storedNotePath(title);
  const fileName = basename(storedPath);

  await writeFile(storedPath, markdown);
  const fileStat = await stat(storedPath);
  const client = await prisma();
  const row = await client.document.create({
    data: {
      type: "note",
      title,
      source: fileName,
      tags: JSON.stringify(tags),
      createdAt: created,
      originalName: fileName,
      storedPath,
      size: fileStat.size,
      pinned: 0,
    },
  });

  return NextResponse.json({ document: rowToDocument(row), markdown, metadata }, { status: 201 });
}
