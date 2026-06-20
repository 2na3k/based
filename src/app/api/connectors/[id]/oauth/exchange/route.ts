import { NextResponse } from "next/server";
import { readConnectorAuth, writeConnectorOAuth } from "../../../_lib/auth";
import { ConnectorError } from "../../../_lib/errors";
import { transferCodeFromPayload } from "../../../_lib/providers";
import { connectorFromContext, type ConnectorRouteContext } from "../../../_lib/routes";

export const runtime = "nodejs";

export async function POST(request: Request, context: ConnectorRouteContext) {
  const connector = await connectorFromContext(context);
  if (connector instanceof Response) return connector;
  if (!connector.provider.brokerExchange) {
    return new Response("Connector does not support broker exchange", { status: 400 });
  }

  try {
    const transferCode = transferCodeFromPayload((await request.json()) as unknown);
    if (transferCode instanceof Response) return transferCode;
    const origin = new URL(request.url).origin;
    const auth = await readConnectorAuth(connector.id);
    const tokens = await connector.provider.brokerExchange(transferCode, origin);
    await writeConnectorOAuth(connector.id, tokens);
    return NextResponse.json(
      await connector.provider.importDocuments({
        ...auth,
        oauth: tokens,
        oauthState: undefined,
      }),
    );
  } catch (caught: unknown) {
    if (caught instanceof ConnectorError) {
      return new Response(caught.message, { status: caught.status });
    }
    return new Response(caught instanceof Error ? caught.message : "Could not exchange connector authorization", { status: 500 });
  }
}
