import { connectorProvider, isConnectorId, type ConnectorProvider } from "./providers";
import type { ConnectorId } from "../../../../lib/types";

export interface ConnectorRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export interface ResolvedConnector {
  id: ConnectorId;
  provider: ConnectorProvider;
}

export async function connectorFromContext(context: ConnectorRouteContext): Promise<ResolvedConnector | Response> {
  const { id } = await context.params;
  const provider = connectorProvider(id);
  if (!isConnectorId(id) || !provider) {
    return new Response("Connector not found", { status: 404 });
  }
  return { id, provider };
}

export function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  const protocol = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(/:$/, "");
  return `${protocol}://${host}`;
}
