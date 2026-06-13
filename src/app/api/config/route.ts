import { NextResponse } from "next/server";
import { prisma, rowToDocument, storageInfo } from "../_lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const client = await prisma();
  const rows = await client.document.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ storage: storageInfo(), documents: rows.map(rowToDocument) });
}
