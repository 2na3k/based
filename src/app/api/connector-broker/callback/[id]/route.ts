import { NextResponse } from "next/server";
import { appendReturnParams, createTransferCode, takeBrokerState } from "../../_lib/broker";
import { ConnectorError } from "../../../connectors/_lib/errors";
import { isConnectorId } from "../../../connectors/_lib/providers";
import { configuredRaindropOAuth, exchangeRaindropOAuthCode } from "../../../connectors/_lib/raindrop";

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
  const brokerState = url.searchParams.get("state") ?? "";
  const state = takeBrokerState(brokerState);
  if (!state || state.connectorId !== id) {
    return new Response("Invalid connector broker state", { status: 400 });
  }

  const error = url.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(
      appendReturnParams(state.returnUrl, {
        state: state.state,
        error,
      }),
    );
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(
      appendReturnParams(state.returnUrl, {
        state: state.state,
        error: "Missing authorization code",
      }),
    );
  }

  try {
    if (id !== "raindrop") return new Response("Connector broker is not implemented", { status: 501 });
    const { clientId, clientSecret } = configuredRaindropOAuth();
    const callbackUrl = new URL(`/api/connector-broker/callback/${id}`, url.origin).toString();
    const tokens = await exchangeRaindropOAuthCode({
      code,
      callbackUrl,
      clientId,
      clientSecret,
    });
    const transferCode = createTransferCode(id, tokens);
    return NextResponse.redirect(
      appendReturnParams(state.returnUrl, {
        state: state.state,
        transfer_code: transferCode,
      }),
    );
  } catch (caught: unknown) {
    const message = caught instanceof ConnectorError || caught instanceof Error ? caught.message : "Could not complete connector broker OAuth";
    return NextResponse.redirect(
      appendReturnParams(state.returnUrl, {
        state: state.state,
        error: message,
      }),
    );
  }
}
