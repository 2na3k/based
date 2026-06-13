import { writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { isDocumentType, prisma, rowToDocument, storedDocumentPath, tagsFromUnknown } from "../_lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const title = form.get("title");
  const type = form.get("type");
  const tagsValue = form.get("tags");

  if (!(file instanceof File) || typeof title !== "string" || !title.trim() || !isDocumentType(type)) {
    return new Response("Invalid source payload", { status: 400 });
  }

  const parsedTags: unknown = typeof tagsValue === "string" ? JSON.parse(tagsValue) : [];
  const tags = tagsFromUnknown(parsedTags);
  const stamp = new Date().toISOString();
  const storedPath = storedDocumentPath(type, file.name);
  await writeFile(storedPath, new Uint8Array(await file.arrayBuffer()));

  const client = await prisma();
  const row = await client.document.create({
    data: {
      type,
      title: title.trim(),
      source: file.name,
      tags: JSON.stringify(tags),
      createdAt: stamp,
      originalName: file.name,
      storedPath,
      size: file.size,
      pinned: 0,
    },
  });

  return NextResponse.json(rowToDocument(row), { status: 201 });
}
