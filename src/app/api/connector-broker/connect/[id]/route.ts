import { NextResponse } from "next/server";
import { createBrokerState, isAllowedReturnUrl } from "../../_lib/broker";
import { ConnectorError } from "../../../connectors/_lib/errors";
import { isConnectorId } from "../../../connectors/_lib/providers";
import { configuredRaindropOAuth, raindropAuthorizeUrl } from "../../../connectors/_lib/raindrop";

export const runtime = "nodejs";

interface BrokerRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: Request, context: BrokerRouteContext) {
  const { id } = await context.params;
  if (!isConnectorId(id)) return new Response("Connector not found", { status: 404 });

  const url = new URL(request.url);
  const returnUrl = url.searchParams.get("return_url") ?? "";
  const state = url.searchParams.get("state") ?? "";
  if (!returnUrl || !state || !isAllowedReturnUrl(returnUrl)) {
    return new Response("Invalid connector return URL", { status: 400 });
  }

  try {
    if (id !== "raindrop") return new Response("Connector broker is not implemented", { status: 501 });
    const { clientId } = configuredRaindropOAuth();
    const brokerState = createBrokerState({
      connectorId: id,
      returnUrl,
      state,
    });
    const callbackUrl = new URL(`/api/connector-broker/callback/${id}`, url.origin).toString();
    return NextResponse.redirect(raindropAuthorizeUrl(clientId, callbackUrl, brokerState));
  } catch (caught: unknown) {
    if (caught instanceof ConnectorError) return new Response(caught.message, { status: caught.status });
    return new Response(caught instanceof Error ? caught.message : "Could not start connector broker OAuth", { status: 500 });
  }
}
