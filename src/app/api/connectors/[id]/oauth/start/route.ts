import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { readConnectorAuth, writeConnectorOAuthState } from "../../../_lib/auth";
import { ConnectorError } from "../../../_lib/errors";
import { connectorFromContext, requestOrigin, type ConnectorRouteContext } from "../../../_lib/routes";

export const runtime = "nodejs";

function appRedirect(request: Request, connectorId: string, message: string) {
  const url = new URL("/", new URL(request.url).origin);
  url.searchParams.set("connector", connectorId);
  url.searchParams.set("connectorStatus", "error");
  url.searchParams.set("connectorMessage", message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request, context: ConnectorRouteContext) {
  const connector = await connectorFromContext(context);
  if (connector instanceof Response) return connector;
  if (!connector.provider.brokerStartUrl && !connector.provider.oauthStartUrl) {
    return new Response("Connector does not support OAuth", { status: 400 });
  }

  try {
    const auth = await readConnectorAuth(connector.id);
    const state = randomUUID();
    await writeConnectorOAuthState(connector.id, state);
    const origin = requestOrigin(request);
    const callbackUrl = new URL(`/api/connectors/${connector.id}/oauth/callback`, origin).toString();
    const startUrl = connector.provider.brokerStartUrl?.(auth, callbackUrl, state) ?? connector.provider.oauthStartUrl?.(auth, callbackUrl, state);
    if (!startUrl) return new Response("Connector does not support OAuth", { status: 400 });
    return NextResponse.redirect(startUrl);
  } catch (caught: unknown) {
    if (caught instanceof ConnectorError) {
      return appRedirect(request, connector.id, caught.message);
    }
    return appRedirect(request, connector.id, caught instanceof Error ? caught.message : "Could not start connector OAuth");
  }
}
