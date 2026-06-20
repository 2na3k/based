import { NextResponse } from "next/server";
import { readConnectorAuth } from "./_lib/auth";
import { connectorListItem, connectorProviders } from "./_lib/providers";
import type { ConnectorListResponse } from "../../lib/types";

export const runtime = "nodejs";

export async function GET() {
  const connectors = await Promise.all(
    connectorProviders().map(async (provider) => connectorListItem(provider, await readConnectorAuth(provider.definition.id))),
  );
  const response: ConnectorListResponse = { connectors };
  return NextResponse.json(response);
}
