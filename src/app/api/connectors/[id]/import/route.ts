import { NextResponse } from "next/server";
import { readConnectorAuth } from "../../_lib/auth";
import { ConnectorError } from "../../_lib/errors";
import { connectorFromContext, type ConnectorRouteContext } from "../../_lib/routes";

export const runtime = "nodejs";

export async function POST(_request: Request, context: ConnectorRouteContext) {
  const connector = await connectorFromContext(context);
  if (connector instanceof Response) return connector;

  try {
    const auth = await readConnectorAuth(connector.id);
    return NextResponse.json(await connector.provider.importDocuments(auth));
  } catch (caught: unknown) {
    if (caught instanceof ConnectorError) {
      return new Response(caught.message, { status: caught.status });
    }
    return new Response(caught instanceof Error ? caught.message : "Could not import connector documents", { status: 500 });
  }
}
