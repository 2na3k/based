import { NextResponse } from "next/server";
import { OPEN_APPS, prisma, readOpenApps, rowToDocument, storageInfo, TYPES, writeOpenApps } from "../_lib/storage";
import type { OpenAppConfig } from "../../lib/types";

export const runtime = "nodejs";

export async function GET() {
  const client = await prisma();
  const [rows, openApps] = await Promise.all([client.document.findMany({ orderBy: { createdAt: "desc" } }), readOpenApps()]);
  return NextResponse.json({ storage: storageInfo(), documents: rows.map(rowToDocument), openApps });
}

export async function PATCH(request: Request) {
  const payload: unknown = await request.json();
  if (typeof payload !== "object" || payload === null || !("openApps" in payload)) {
    return new Response("Invalid config payload", { status: 400 });
  }

  const input = payload as { openApps?: Partial<OpenAppConfig> };
  const current = await readOpenApps();
  const openApps = TYPES.reduce<OpenAppConfig>((next, type) => {
    const value = input.openApps?.[type];
    return {
      ...next,
      [type]: value && OPEN_APPS.includes(value) ? value : current[type],
    };
  }, current);
  const savedOpenApps = await writeOpenApps(openApps);
  const client = await prisma();
  const rows = await client.document.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ storage: storageInfo(), documents: rows.map(rowToDocument), openApps: savedOpenApps });
}
