import { NextResponse } from "next/server";
import { takeTransferCode } from "../../_lib/broker";
import { isConnectorId } from "../../../connectors/_lib/providers";

export const runtime = "nodejs";

interface BrokerRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: Request, context: BrokerRouteContext) {
  const { id } = await context.params;
  if (!isConnectorId(id)) return new Response("Connector not found", { status: 404 });

  const payload: unknown = await request.json().catch(() => null);
  if (typeof payload !== "object" || payload === null) {
    return new Response("Invalid connector broker exchange payload", { status: 400 });
  }
  const input = payload as { transferCode?: unknown };
  if (typeof input.transferCode !== "string" || !input.transferCode.trim()) {
    return new Response("Transfer code is required", { status: 400 });
  }

  const tokens = takeTransferCode(id, input.transferCode.trim());
  if (!tokens) return new Response("Transfer code is invalid or expired", { status: 401 });
  return NextResponse.json(tokens);
}
